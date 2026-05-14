-- =============================================================================
-- NPIS - Migration 002
-- Documents the existing resubmission_requests schema and adds useful indexes.
-- Safe to run multiple times.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.resubmission_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(application_id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(document_id),
  reason text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  requested_at timestamp without time zone NOT NULL DEFAULT now(),
  resolved_at timestamp without time zone
);

CREATE INDEX IF NOT EXISTS idx_resubmission_requests_application_id
  ON public.resubmission_requests(application_id);

CREATE INDEX IF NOT EXISTS idx_resubmission_requests_unresolved
  ON public.resubmission_requests(application_id, resolved)
  WHERE resolved = false;

