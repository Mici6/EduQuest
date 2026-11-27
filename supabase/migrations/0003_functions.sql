-- Atomic voucher redemption for the PostgreSQL backend (mirrors redeemOffer()).
-- Row locks on the offer and an advisory lock per student serialise concurrent
-- redemptions; the idempotency key makes client retries safe.
CREATE OR REPLACE FUNCTION eq_redeem_offer(p_student TEXT, p_offer TEXT, p_request_key TEXT)
RETURNS TABLE (redemption_id TEXT, code TEXT, replayed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key TEXT := 'redeem:' || p_student || ':' || p_request_key;
  v_offer reward_offers%ROWTYPE;
  v_balance INTEGER;
  v_used INTEGER;
  v_tx TEXT := 'crd_' || gen_random_uuid();
  v_red TEXT := 'vch_' || gen_random_uuid();
  v_code TEXT := 'EQ-' || upper(substr(md5(random()::text), 1, 5)) || '-' || upper(substr(md5(random()::text), 1, 5));
BEGIN
  RETURN QUERY SELECT v.id, v.code, true FROM voucher_redemptions v JOIN credit_transactions c ON c.id = v.credit_tx_id WHERE c.idempotency_key = v_key;
  IF FOUND THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_student));
  SELECT * INTO v_offer FROM reward_offers WHERE id = p_offer FOR UPDATE;
  IF NOT FOUND OR v_offer.active = 0 THEN RAISE EXCEPTION 'offer unavailable'; END IF;
  IF v_offer.expires_on < to_char(now(), 'YYYY-MM-DD') THEN RAISE EXCEPTION 'offer expired'; END IF;
  IF v_offer.stock <= 0 THEN RAISE EXCEPTION 'out of stock'; END IF;
  SELECT COUNT(*) INTO v_used FROM voucher_redemptions WHERE offer_id = p_offer AND student_id = p_student;
  IF v_used >= v_offer.per_student_limit THEN RAISE EXCEPTION 'limit reached'; END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM credit_transactions WHERE user_id = p_student;
  IF v_balance < v_offer.credit_cost THEN RAISE EXCEPTION 'insufficient credits'; END IF;

  INSERT INTO credit_transactions (id, user_id, amount, kind, reason, source_type, source_id, idempotency_key, created_by)
  VALUES (v_tx, p_student, -v_offer.credit_cost, 'redeem', 'Voucher: ' || v_offer.title, 'voucher_redemption', p_offer, v_key, p_student);
  UPDATE reward_offers SET stock = stock - 1 WHERE id = p_offer;
  INSERT INTO voucher_redemptions (id, offer_id, student_id, credit_tx_id, code) VALUES (v_red, p_offer, p_student, v_tx, v_code);
  RETURN QUERY SELECT v_red, v_code, false;
END $$;

REVOKE ALL ON FUNCTION eq_redeem_offer(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Retention: delete closed support plans past their retention date (schedule daily with pg_cron).
CREATE OR REPLACE FUNCTION eq_purge_expired_support_records() RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM intervention_plans WHERE status = 'closed' AND retain_until < to_char(now(), 'YYYY-MM-DD');
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO audit_logs (id, actor_id, action, resource_type, metadata) VALUES ('aud_' || gen_random_uuid(), NULL, 'support.retention.purge', 'intervention_plans', jsonb_build_object('deleted', n)::text);
  RETURN n;
END $$;
