-- Row-level security for EduQuest on Supabase.
-- The application server uses the service role for domain operations and
-- enforces authorization in src/lib/auth/policy.ts. These policies are the
-- second line of defence for any direct client access (e.g. realtime or
-- read-only client queries with the anon key + user JWT).

CREATE OR REPLACE FUNCTION eq_uid() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() AND active
$$;
CREATE OR REPLACE FUNCTION eq_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM users WHERE auth_user_id = auth.uid() AND active
$$;
CREATE OR REPLACE FUNCTION eq_school() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM users WHERE auth_user_id = auth.uid() AND active
$$;
-- Does the current teacher teach a class this student belongs to?
CREATE OR REPLACE FUNCTION eq_teaches_student(student TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_memberships cm JOIN teaching_assignments ta ON ta.class_id = cm.class_id
    WHERE cm.user_id = student AND ta.teacher_id = eq_uid()
  )
$$;
CREATE OR REPLACE FUNCTION eq_in_caseload(student TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM support_caseload WHERE staff_id = eq_uid() AND student_id = student)
$$;
-- Academic record visibility: self, teachers of the student's classes, same-school admins, caseload staff.
CREATE OR REPLACE FUNCTION eq_can_read_academic(student TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT student = eq_uid()
      OR (eq_role() = 'teacher' AND eq_teaches_student(student))
      OR (eq_role() = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = student AND u.school_id = eq_school()))
      OR (eq_role() = 'support' AND eq_in_caseload(student))
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['schools','users','user_settings','subjects','classes','class_memberships','teaching_assignments','schedule_slots','grades','attendance',
    'assignments','submissions','announcements','events','notifications','documents','document_chunks','ai_conversations','ai_messages','ai_usage',
    'flashcard_sets','flashcards','flashcard_progress','quizzes','quiz_questions','quiz_attempts','study_sessions','levels','xp_transactions','achievements',
    'student_achievements','quests','quest_progress','credit_transactions','volunteering_activities','volunteering_registrations','reward_partners','reward_offers',
    'voucher_redemptions','support_caseload','support_indicators','support_reviews','intervention_plans','intervention_notes','subscription_plans',
    'school_subscriptions','contact_requests','audit_logs','meta']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Reference data readable within the school.
CREATE POLICY school_read ON schools FOR SELECT USING (id = eq_school());
CREATE POLICY subjects_read ON subjects FOR SELECT USING (school_id = eq_school());
CREATE POLICY classes_read ON classes FOR SELECT USING (school_id = eq_school());
CREATE POLICY levels_read ON levels FOR SELECT USING (true);
CREATE POLICY achievements_read ON achievements FOR SELECT USING (true);
CREATE POLICY quests_read ON quests FOR SELECT USING (school_id = eq_school());
CREATE POLICY plans_read ON subscription_plans FOR SELECT USING (true);

-- People: self, plus staff within the school (minimal columns are selected by the app).
CREATE POLICY users_read ON users FOR SELECT USING (id = eq_uid() OR (school_id = eq_school() AND eq_role() IN ('teacher','admin','support')));
CREATE POLICY settings_own ON user_settings FOR ALL USING (user_id = eq_uid()) WITH CHECK (user_id = eq_uid());

-- Academic records.
CREATE POLICY grades_read ON grades FOR SELECT USING (eq_can_read_academic(student_id));
CREATE POLICY grades_teacher_write ON grades FOR INSERT WITH CHECK (
  eq_role() = 'teacher' AND teacher_id = eq_uid()
  AND EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.teacher_id = eq_uid() AND ta.class_id = grades.class_id AND ta.subject_id = grades.subject_id));
CREATE POLICY attendance_read ON attendance FOR SELECT USING (eq_can_read_academic(student_id));
CREATE POLICY attendance_teacher_write ON attendance FOR INSERT WITH CHECK (
  eq_role() = 'teacher' AND EXISTS (SELECT 1 FROM teaching_assignments ta WHERE ta.teacher_id = eq_uid() AND ta.class_id = attendance.class_id AND ta.subject_id = attendance.subject_id));
CREATE POLICY submissions_read ON submissions FOR SELECT USING (eq_can_read_academic(student_id));
CREATE POLICY submissions_own ON submissions FOR INSERT WITH CHECK (student_id = eq_uid());

-- Notifications, AI conversations and study progress are private to their owner.
CREATE POLICY notifications_own ON notifications FOR SELECT USING (user_id = eq_uid());
CREATE POLICY notifications_mark ON notifications FOR UPDATE USING (user_id = eq_uid()) WITH CHECK (user_id = eq_uid());
CREATE POLICY conv_own ON ai_conversations FOR ALL USING (user_id = eq_uid()) WITH CHECK (user_id = eq_uid());
CREATE POLICY msg_own ON ai_messages FOR SELECT USING (EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = conversation_id AND c.user_id = eq_uid()));
CREATE POLICY fcp_own ON flashcard_progress FOR SELECT USING (user_id = eq_uid());
CREATE POLICY attempts_read ON quiz_attempts FOR SELECT USING (eq_can_read_academic(student_id));

-- Ledgers: readable by their owner; NO insert/update/delete policies for clients.
-- Rewards can only be written by server-side functions running as the service role.
CREATE POLICY xp_own ON xp_transactions FOR SELECT USING (user_id = eq_uid());
CREATE POLICY credits_own ON credit_transactions FOR SELECT USING (user_id = eq_uid());
CREATE POLICY vouchers_own ON voucher_redemptions FOR SELECT USING (student_id = eq_uid());

-- Marketplace & volunteering are visible within the school.
CREATE POLICY partners_read ON reward_partners FOR SELECT USING (school_id = eq_school());
CREATE POLICY offers_read ON reward_offers FOR SELECT USING (EXISTS (SELECT 1 FROM reward_partners p WHERE p.id = partner_id AND p.school_id = eq_school()));
CREATE POLICY activities_read ON volunteering_activities FOR SELECT USING (school_id = eq_school());
CREATE POLICY registrations_read ON volunteering_registrations FOR SELECT USING (
  student_id = eq_uid() OR EXISTS (SELECT 1 FROM volunteering_activities a WHERE a.id = activity_id AND (a.organizer_id = eq_uid() OR (eq_role() = 'admin' AND a.school_id = eq_school()))));

-- Student support: support staff with the student on their caseload ONLY.
-- Teachers, administrators and students have no policy and therefore no access.
CREATE POLICY caseload_own ON support_caseload FOR SELECT USING (staff_id = eq_uid());
CREATE POLICY indicators_support ON support_indicators FOR SELECT USING (eq_role() = 'support' AND eq_in_caseload(student_id));
CREATE POLICY reviews_support ON support_reviews FOR SELECT USING (EXISTS (SELECT 1 FROM support_indicators i WHERE i.id = indicator_id AND eq_role() = 'support' AND eq_in_caseload(i.student_id)));
CREATE POLICY plans_support ON intervention_plans FOR SELECT USING (eq_role() = 'support' AND eq_in_caseload(student_id));
CREATE POLICY notes_support ON intervention_notes FOR SELECT USING (EXISTS (SELECT 1 FROM intervention_plans p WHERE p.id = plan_id AND eq_role() = 'support' AND eq_in_caseload(p.student_id)));

-- Audit log: administrators of the school, read-only.
CREATE POLICY audit_admin ON audit_logs FOR SELECT USING (eq_role() = 'admin' AND EXISTS (SELECT 1 FROM users u WHERE u.id = actor_id AND u.school_id = eq_school()));
-- Tables without policies (documents content, chunks, contact_requests, meta, …) are server-only.
