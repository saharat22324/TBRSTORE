-- TBR System: month-specific technician bonus headcounts.
-- Requires a verified pre-migration backup.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS monthly_bonus_settings (
  month_key TEXT PRIMARY KEY CHECK (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  headcount SMALLINT NOT NULL CHECK (headcount BETWEEN 1 AND 20),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE monthly_bonus_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS monthly_bonus_settings_team_read ON monthly_bonus_settings;
CREATE POLICY monthly_bonus_settings_team_read ON monthly_bonus_settings
  FOR SELECT TO authenticated
  USING (current_app_role() IN ('admin', 'supervisor'));

REVOKE ALL ON TABLE monthly_bonus_settings FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE monthly_bonus_settings FROM authenticated;
GRANT SELECT ON TABLE monthly_bonus_settings TO authenticated;

CREATE OR REPLACE FUNCTION save_monthly_bonus_headcount_atomic(p_month_key TEXT, p_headcount INTEGER)
RETURNS monthly_bonus_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_setting monthly_bonus_settings;
BEGIN
  IF auth.uid() IS NULL OR current_app_role() NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF COALESCE(p_month_key, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid bonus month';
  END IF;
  IF p_headcount IS NULL OR p_headcount NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Bonus headcount must be between 1 and 20';
  END IF;

  INSERT INTO monthly_bonus_settings(month_key, headcount, updated_by)
  VALUES(p_month_key, p_headcount, auth.uid())
  ON CONFLICT(month_key) DO UPDATE SET
    headcount = EXCLUDED.headcount,
    updated_by = auth.uid(),
    updated_at = NOW()
  RETURNING * INTO v_setting;

  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, entity_ref, details)
  VALUES(auth.uid(), 'BONUS_HEADCOUNT_SAVE', 'monthly_bonus_setting', v_setting.month_key,
    v_setting.month_key, jsonb_build_object('headcount', v_setting.headcount));
  RETURN v_setting;
END; $$;

REVOKE ALL ON FUNCTION save_monthly_bonus_headcount_atomic(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION save_monthly_bonus_headcount_atomic(TEXT, INTEGER) TO authenticated;

INSERT INTO schema_migrations(version, description, applied_by)
VALUES('20260901_monthly_bonus_headcounts', 'Store technician bonus headcounts by month', auth.uid())
ON CONFLICT(version) DO UPDATE SET description = EXCLUDED.description;

COMMIT;