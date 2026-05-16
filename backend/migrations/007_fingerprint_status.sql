-- =============================================================================
-- NPIS — Migration 007
-- Rename the 'Verified' application status to 'Fingerprint Required'.
-- After ML verification passes, the citizen must visit a General Security
-- branch for physical fingerprint collection before the Mukhtar can sign.
-- Safe to re-run.
-- =============================================================================

-- Update existing applications
UPDATE public.applications
SET current_status = 'Fingerprint Required'
WHERE current_status = 'Verified';

-- Update status history (both sides of the transition)
UPDATE public.application_status_history
SET old_status = 'Fingerprint Required'
WHERE old_status = 'Verified';

UPDATE public.application_status_history
SET new_status = 'Fingerprint Required'
WHERE new_status = 'Verified';
