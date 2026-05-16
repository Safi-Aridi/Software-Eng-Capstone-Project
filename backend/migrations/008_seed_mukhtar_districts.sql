-- =============================================================================
-- NPIS — Migration 008
-- Seed mukhtar districts so the citizen-side district/mukhtar pickers in
-- Step 4 of the application flow have data to show. Idempotent.
-- =============================================================================

-- 1. Backfill district + village on the existing test mukhtar (from 001).
UPDATE public.mukhtar_profiles
SET district = 'Beirut',
    village = 'Hamra'
WHERE user_id = 'a1b2c3d4-0000-0000-0000-000000000004';

-- 2. Seed 5 demo mukhtars — one per district.
--    Password hash matches the other test users (test123, bcrypt saltRounds=10).

INSERT INTO public.users (
  user_id, role_id, first_name, last_name, email, phone,
  password_hash, account_status, failed_attempts
)
VALUES
  ('b1b2c3d4-0000-0000-0000-000000000011', 2,
   'Mukhtar', 'Aley',    'mukhtar.aley@test.com',    '70200001',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('b1b2c3d4-0000-0000-0000-000000000012', 2,
   'Mukhtar', 'Baabda',  'mukhtar.baabda@test.com',  '70200002',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('b1b2c3d4-0000-0000-0000-000000000013', 2,
   'Mukhtar', 'Metn',    'mukhtar.metn@test.com',    '70200003',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('b1b2c3d4-0000-0000-0000-000000000014', 2,
   'Mukhtar', 'Tripoli', 'mukhtar.tripoli@test.com', '70200004',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('b1b2c3d4-0000-0000-0000-000000000015', 2,
   'Mukhtar', 'Sidon',   'mukhtar.sidon@test.com',   '70200005',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0)
ON CONFLICT (user_id) DO NOTHING;

-- Mukhtar profile convention: mukhtar_id = user_id.
INSERT INTO public.mukhtar_profiles (
  mukhtar_id, user_id, village, district, is_active, created_at
)
VALUES
  ('b1b2c3d4-0000-0000-0000-000000000011',
   'b1b2c3d4-0000-0000-0000-000000000011',
   'Aley',    'Aley',    true, NOW()),
  ('b1b2c3d4-0000-0000-0000-000000000012',
   'b1b2c3d4-0000-0000-0000-000000000012',
   'Baabda',  'Baabda',  true, NOW()),
  ('b1b2c3d4-0000-0000-0000-000000000013',
   'b1b2c3d4-0000-0000-0000-000000000013',
   'Metn',    'Metn',    true, NOW()),
  ('b1b2c3d4-0000-0000-0000-000000000014',
   'b1b2c3d4-0000-0000-0000-000000000014',
   'Tripoli', 'Tripoli', true, NOW()),
  ('b1b2c3d4-0000-0000-0000-000000000015',
   'b1b2c3d4-0000-0000-0000-000000000015',
   'Sidon',   'Sidon',   true, NOW())
ON CONFLICT (mukhtar_id) DO NOTHING;

-- Ensure the original test mukhtar (from migration 001) also has a profile row.
INSERT INTO public.mukhtar_profiles (
  mukhtar_id, user_id, village, district, is_active, created_at
)
VALUES
  ('a1b2c3d4-0000-0000-0000-000000000004',
   'a1b2c3d4-0000-0000-0000-000000000004',
   'Hamra', 'Beirut', true, NOW())
ON CONFLICT (mukhtar_id) DO NOTHING;
