-- =============================================================================
-- NPIS — Migration 004
-- Passport booklet records. Created at the ISSUED state by the GS Officer and
-- referenced by renewal applications via applications.renewing_passport_id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.passports (
  passport_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id),
  source_application_id UUID NOT NULL
    REFERENCES public.applications(application_id),
  booklet_number VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'CANCELLED')),
  issued_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  cancelled_at TIMESTAMP,
  cancelled_by_application_id UUID
    REFERENCES public.applications(application_id)
);

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS renewing_passport_id UUID
  REFERENCES public.passports(passport_id);

CREATE INDEX IF NOT EXISTS idx_passports_user_id
  ON passports(user_id);
CREATE INDEX IF NOT EXISTS idx_passports_status
  ON passports(status);
