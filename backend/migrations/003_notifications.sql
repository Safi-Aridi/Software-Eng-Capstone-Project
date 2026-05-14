-- =============================================================================
-- NPIS — Migration 003
-- Server-emitted notifications. Citizens, mukhtars, and officers all read from
-- this table; rows are created by ApplicationsService on status transitions.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(application_id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);
