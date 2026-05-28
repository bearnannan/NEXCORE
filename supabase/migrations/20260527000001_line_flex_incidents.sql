-- supabase/migrations/20260527000001_line_flex_incidents.sql
-- Evolved Incidents, SLA Rules, and LINE Notification attempts schema.

-- 1. Clean up old incidents table
DROP TABLE IF EXISTS public.incidents CASCADE;

-- 2. Create pg_crypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. Create System Settings Table for backup key overrides
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create Equipment SLA Rules Table
CREATE TABLE IF NOT EXISTS public.incident_equipment_sla_rules (
  equipment_type TEXT PRIMARY KEY,
  sla_duration_hours INTEGER NOT NULL CHECK (sla_duration_hours > 0),
  penalty_rate_baht NUMERIC(12, 2) NOT NULL CHECK (penalty_rate_baht >= 0),
  penalty_unit TEXT NOT NULL CHECK (penalty_unit IN ('hour', 'day')),
  allowed_priorities TEXT[] NOT NULL DEFAULT ARRAY['medium']::TEXT[],
  default_priority TEXT NOT NULL DEFAULT 'medium' CHECK (default_priority IN ('critical', 'high', 'medium', 'low')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Seed Equipment SLA Rules
INSERT INTO public.incident_equipment_sla_rules (
  equipment_type,
  sla_duration_hours,
  penalty_rate_baht,
  penalty_unit,
  allowed_priorities,
  default_priority
)
VALUES
  ('Base Station Control Center (BSSC) Capacity Expansion System', 3, 5000, 'hour', ARRAY['critical']::TEXT[], 'critical'),
  ('Dispatcher Console', 3, 5000, 'hour', ARRAY['critical']::TEXT[], 'critical'),
  ('SD-WAN Management System', 3, 5000, 'hour', ARRAY['critical']::TEXT[], 'critical'),
  ('Super High Frequency (SHF) Repeater Kit', 72, 10000, 'day', ARRAY['high', 'medium']::TEXT[], 'high'),
  ('Gateway Kit for Analog Connection', 72, 10000, 'day', ARRAY['high', 'medium']::TEXT[], 'high'),
  ('1-Carrier Base Station (Outdoor)', 72, 10000, 'day', ARRAY['high', 'medium']::TEXT[], 'high'),
  ('L3 Switch Distribution Equipment', 72, 10000, 'day', ARRAY['high', 'medium']::TEXT[], 'high'),
  ('3 kVA Uninterruptible Power Supply (UPS)', 72, 10000, 'day', ARRAY['high', 'medium']::TEXT[], 'high'),
  ('Handheld Subscriber Radio (Portable Radio)', 96, 10000, 'day', ARRAY['low']::TEXT[], 'low'),
  ('Fixed Subscriber Radio (Mobile/Desktop Radio)', 96, 10000, 'day', ARRAY['low']::TEXT[], 'low')
ON CONFLICT (equipment_type) DO UPDATE SET
  sla_duration_hours = EXCLUDED.sla_duration_hours,
  penalty_rate_baht = EXCLUDED.penalty_rate_baht,
  penalty_unit = EXCLUDED.penalty_unit,
  allowed_priorities = EXCLUDED.allowed_priorities,
  default_priority = EXCLUDED.default_priority,
  updated_at = now();

-- 5. Create Evolved Incidents Table
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_no TEXT NOT NULL UNIQUE,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  station TEXT NOT NULL DEFAULT 'ไม่ระบุสถานี',
  reporter TEXT NOT NULL DEFAULT 'ไม่ระบุผู้แจ้งเหตุ',
  issue_description TEXT NOT NULL DEFAULT 'ไม่ระบุอาการเสีย',
  assignee TEXT NOT NULL DEFAULT 'รอดำเนินการ',
  repair_status TEXT NOT NULL DEFAULT 'รอดำเนินการ',
  reporter_phone TEXT NOT NULL DEFAULT '-',
  phone TEXT NOT NULL DEFAULT '-',
  priority TEXT NOT NULL DEFAULT 'medium',
  equipment_type TEXT,
  asset_id UUID,
  asset_type TEXT CHECK (asset_type IS NULL OR asset_type IN ('station', 'client')),
  asset_name TEXT,
  province TEXT,
  district TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  sla_duration_hours INTEGER,
  sla_due_at TIMESTAMP WITH TIME ZONE,
  penalty_rate_baht NUMERIC(12, 2),
  penalty_unit TEXT CHECK (penalty_unit IN ('hour', 'day')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  penalty_amount_baht NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_by TEXT,
  line_notification_sent_at TIMESTAMP WITH TIME ZONE,
  line_notification_error TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS incidents_reported_at_idx ON public.incidents (reported_at DESC);
CREATE INDEX IF NOT EXISTS incidents_repair_status_idx ON public.incidents (repair_status);
CREATE INDEX IF NOT EXISTS incidents_priority_idx ON public.incidents (priority);
CREATE INDEX IF NOT EXISTS incidents_station_idx ON public.incidents (station);
CREATE INDEX IF NOT EXISTS incidents_equipment_type_idx ON public.incidents (equipment_type);
CREATE INDEX IF NOT EXISTS incidents_sla_due_at_idx ON public.incidents (sla_due_at);
CREATE INDEX IF NOT EXISTS incidents_status_priority_idx ON public.incidents (repair_status, priority);
CREATE INDEX IF NOT EXISTS incidents_coordinates_idx ON public.incidents (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 6. Create Notification Attempts Logs Table
CREATE TABLE IF NOT EXISTS public.incident_notification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES public.incidents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('line_primary', 'line_backup', 'smtp_fallback', 'manual_resend')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  message TEXT NOT NULL DEFAULT '',
  status_code INTEGER,
  correlation_id TEXT,
  token_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_notification_attempts_incident_idx
  ON public.incident_notification_attempts (incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS incident_notification_attempts_status_idx
  ON public.incident_notification_attempts (status, created_at DESC);

-- 7. Private counters for yearly incident number generator (Format: INC-SHF-YYYY-XXXX)
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM public;
REVOKE ALL ON SCHEMA app_private FROM anon;
REVOKE ALL ON SCHEMA app_private FROM authenticated;

CREATE TABLE IF NOT EXISTS app_private.incident_no_counters (
  counter_year INTEGER PRIMARY KEY,
  next_counter INTEGER NOT NULL DEFAULT 0 CHECK (next_counter BETWEEN 0 AND 10000),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE app_private.incident_no_counters FROM public;
REVOKE ALL ON TABLE app_private.incident_no_counters FROM anon;
REVOKE ALL ON TABLE app_private.incident_no_counters FROM authenticated;

-- Function to generate next yearly incident number
CREATE OR REPLACE FUNCTION app_private.next_incident_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_private, public
AS $$
DECLARE
  target_year INTEGER := EXTRACT(year FROM CURRENT_DATE)::INTEGER;
  counter_value INTEGER;
BEGIN
  LOOP
    BEGIN
      INSERT INTO app_private.incident_no_counters (counter_year, next_counter)
      VALUES (target_year, 1)
      RETURNING 0 INTO counter_value;

      RETURN FORMAT('INC-SHF-%s-%s', target_year, LPAD(counter_value::TEXT, 4, '0'));
    EXCEPTION
      WHEN unique_violation THEN
        SELECT next_counter
        INTO counter_value
        FROM app_private.incident_no_counters
        WHERE counter_year = target_year
        FOR UPDATE;

        IF counter_value > 9999 THEN
          RAISE EXCEPTION 'Incident number counter exhausted for year %', target_year
            USING ERRCODE = '22000';
        END IF;

        UPDATE app_private.incident_no_counters
        SET
          next_counter = counter_value + 1,
          updated_at = now()
        WHERE counter_year = target_year;

        RETURN FORMAT('INC-SHF-%s-%s', target_year, LPAD(counter_value::TEXT, 4, '0'));
    END;
  END LOOP;
END;
$$;

-- Trigger to automatically assign yearly incident numbers on creation
CREATE OR REPLACE FUNCTION app_private.assign_incident_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app_private, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.incident_no := app_private.next_incident_no();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_incident_no ON public.incidents;
CREATE TRIGGER assign_incident_no
BEFORE INSERT ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION app_private.assign_incident_no();

-- 8. SLA calculations trigger function
CREATE OR REPLACE FUNCTION public.apply_incident_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  rule RECORD;
  effective_end_at TIMESTAMP WITH TIME ZONE;
  breach_units NUMERIC;
BEGIN
  SELECT *
  INTO rule
  FROM public.incident_equipment_sla_rules
  WHERE equipment_type = NEW.equipment_type;

  IF NOT FOUND THEN
    NEW.sla_duration_hours = NULL;
    NEW.sla_due_at = NULL;
    NEW.penalty_rate_baht = NULL;
    NEW.penalty_unit = NULL;
    NEW.penalty_amount_baht = 0;
    IF NEW.repair_status <> 'เสร็จสิ้น' THEN
      NEW.resolved_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  NEW.sla_duration_hours = rule.sla_duration_hours;
  NEW.sla_due_at = NEW.reported_at + MAKE_INTERVAL(hours => rule.sla_duration_hours);
  NEW.penalty_rate_baht = rule.penalty_rate_baht;
  NEW.penalty_unit = rule.penalty_unit;
  IF NEW.priority IS NULL OR NOT (NEW.priority = ANY(rule.allowed_priorities)) THEN
    NEW.priority = rule.default_priority;
  END IF;

  IF NEW.repair_status = 'เสร็จสิ้น' THEN
    NEW.resolved_at = COALESCE(NEW.resolved_at, now());
  ELSE
    NEW.resolved_at = NULL;
  END IF;

  effective_end_at = COALESCE(NEW.resolved_at, now());

  IF effective_end_at <= NEW.sla_due_at THEN
    NEW.penalty_amount_baht = 0;
  ELSIF rule.penalty_unit = 'hour' then
    breach_units = CEIL(EXTRACT(epoch FROM (effective_end_at - NEW.sla_due_at)) / 3600);
    NEW.penalty_amount_baht = breach_units * rule.penalty_rate_baht;
  ELSE
    breach_units = CEIL(EXTRACT(epoch FROM (effective_end_at - NEW.sla_due_at)) / 86400);
    NEW.penalty_amount_baht = breach_units * rule.penalty_rate_baht;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_incident_sla ON public.incidents;
CREATE TRIGGER apply_incident_sla
BEFORE INSERT OR UPDATE OF equipment_type, reported_at, repair_status, resolved_at, priority
ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.apply_incident_sla();

-- 9. Updated At Timestamp Triggers
CREATE OR REPLACE FUNCTION public.set_incidents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_incidents_updated_at ON public.incidents;
CREATE TRIGGER set_incidents_updated_at
BEFORE UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_incidents_updated_at();

-- 10. Enable Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_equipment_sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notification_attempts ENABLE ROW LEVEL SECURITY;

-- 11. Grant select, insert, update to authenticated operations operators
GRANT SELECT ON TABLE public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.system_settings TO authenticated;
GRANT SELECT ON TABLE public.incident_equipment_sla_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.incidents TO authenticated;
GRANT SELECT, INSERT ON TABLE public.incident_notification_attempts TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 12. Row Level Security Policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.system_settings;
CREATE POLICY "Allow authenticated read access" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write access" ON public.system_settings;
CREATE POLICY "Allow authenticated write access" ON public.system_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read equipment SLA rules" ON public.incident_equipment_sla_rules;
CREATE POLICY "Authenticated users can read equipment SLA rules"
  ON public.incident_equipment_sla_rules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read incidents" ON public.incidents;
CREATE POLICY "Authenticated users can read incidents"
  ON public.incidents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create incidents" ON public.incidents;
CREATE POLICY "Authenticated users can create incidents"
  ON public.incidents FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update incidents" ON public.incidents;
CREATE POLICY "Authenticated users can update incidents"
  ON public.incidents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read notification attempts" ON public.incident_notification_attempts;
CREATE POLICY "Authenticated users can read notification attempts"
  ON public.incident_notification_attempts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create notification attempts" ON public.incident_notification_attempts;
CREATE POLICY "Authenticated users can create notification attempts"
  ON public.incident_notification_attempts FOR INSERT TO authenticated WITH CHECK (true);

-- Seed System Settings
INSERT INTO public.system_settings (key, value)
VALUES 
  ('LINE_TOKEN', ''),
  ('GROUP_ID', ''),
  ('fallback_email_to', 'dopa-only-tm@forth.co.th')
ON CONFLICT (key) DO NOTHING;
