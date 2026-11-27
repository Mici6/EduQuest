# EduQuest — Business Model Canvas

> Internal document. Partnerships listed are **potential** partner types, not existing agreements. Prices are not yet set; they live in the `subscription_plans` configuration.

| | |
|---|---|
| **Key partners** | Schools and school districts (customers *and* co-designers) · Teachers and student-support professionals · Local businesses offering sponsored vouchers (bookshops, cafés, sport, technology, culture) · Sponsors and foundations funding licences for disadvantaged schools · NGOs and volunteering organisations publishing activities · Education authorities · Technology providers: cloud hosting, Supabase (database/auth/storage), Anthropic (AI), identity providers for school SSO |
| **Key activities** | Product development of catalog, study tools, gamification and support module · AI quality and safety (grounding, provenance labels, review-before-publish) · School onboarding, data migration and teacher training · Partner acquisition and voucher verification · Privacy, security and compliance work (DPIAs, DPAs, audits) · Measuring engagement outcomes with schools, without promising results |
| **Key resources** | The platform (role-based dashboards, AI layer, document pipeline, ledgers) · Curriculum-aligned content created by teachers · Trust: privacy-by-design architecture and transparent rules · Partner network and voucher inventory · Education and AI expertise in the team |
| **Value propositions** | *Students*: one calm place for school life; AI help that explains rather than answers; progress that feels rewarding; real rewards for doing good. *Teachers*: faster grading/attendance, AI-drafted materials they control, class insights. *Schools*: a modern e-catalog plus engagement tools and an early-support workflow that keeps people in charge. *Businesses & sponsors*: visible, meaningful community engagement with young people. *Disadvantaged students*: essential features free through their school, credits that can't be taken away. |
| **Customer relationships** | Account management and onboarding for schools · Teacher training and in-app guidance · Student self-service with privacy controls · Partner dashboards and reporting (planned) · Feedback loops with pilot schools |
| **Channels** | Direct sales to schools and districts · Pilots with education authorities · Teacher networks and conferences · Partner referrals (NGOs, local business associations) · Website and live demo · App-store-like PWA install for students |
| **Customer segments** | **Payers**: schools/districts (B2B licence); students at non-participating schools (Standard subscription); optional Premium students; sponsors. **Users**: students (13–19), teachers, school administrators, authorised support staff. **Ecosystem**: local businesses and volunteering organisations. |
| **Cost structure** | Engineering and design · AI inference (controlled by per-user quotas and school limits) · Hosting, database, storage · Security audits, legal and data-protection work · School onboarding and support staff · Partner management |
| **Revenue streams** | B2B school licences (per-student or per-school contract) · Standard student subscription for schools not yet on EduQuest (priced for accessibility) · Optional Premium subscription (extra AI limits and customisation; never gates essentials) · Sponsored voucher programmes and partnerships with local businesses · Grants/sponsorship covering licences for disadvantaged schools |

## How the canvas maps to the product

- *Fair pricing*: `subscription_plans` (audience: school / student_standard / student_premium, AI allowance, features; price unset).
- *Partners*: `reward_partners.verification_status` (`sample` → `pending` → `verified`); the UI labels samples explicitly.
- *AI cost control*: `aiDailyLimit` per school and `AI_DAILY_REQUEST_LIMIT` per deployment; usage table `ai_usage`.
- *Trust*: audit log, permission matrix, append-only ledgers, human review in the support module.
