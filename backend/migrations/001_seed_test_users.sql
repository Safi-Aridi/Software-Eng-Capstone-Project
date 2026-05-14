-- =============================================================================
-- NPIS — Migration 001 (rewrite)
-- Seed test users into the existing public.users table.
-- All passwords are 'test123' bcrypt-hashed at saltRounds=10.
-- Safe to re-run: ON CONFLICT (user_id) DO NOTHING for users,
-- ON CONFLICT (citizen_id) DO NOTHING for profiles.
-- =============================================================================

INSERT INTO public.users (
  user_id, role_id, first_name, last_name, email, phone,
  password_hash, account_status, failed_attempts
)
VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 1,
   'Sara',   'Mansour',  'accepted.user@test.com', '70123001',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('a1b2c3d4-0000-0000-0000-000000000002', 1,
   'Ahmad',  'Khalil',   'pending.user@test.com',  '70123002',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('a1b2c3d4-0000-0000-0000-000000000003', 1,
   'Omar',   'Fayyad',   'rejected.user@test.com', '70123003',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('a1b2c3d4-0000-0000-0000-000000000004', 2,
   'Khalil', 'Raad',     'mukhtar.user@test.com',  '70123004',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0),
  ('a1b2c3d4-0000-0000-0000-000000000005', 3,
   'Rima',   'Sleiman',  'officer.user@test.com',  '70123005',
   '$2b$10$P9OtzsaB.5Q0Q9O8yoR68OzWZE7/g4gvAAqmjAkmmL5RiA6x3cYRK',
   'active', 0)
ON CONFLICT (user_id) DO NOTHING;

-- ─── Citizen profiles ────────────────────────────────────────────────────────
-- citizen_id = user_id by convention for these test users
INSERT INTO citizen_profiles (citizen_id, user_id)
VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'a1b2c3d4-0000-0000-0000-000000000001'),
  ('a1b2c3d4-0000-0000-0000-000000000002', 'a1b2c3d4-0000-0000-0000-000000000002'),
  ('a1b2c3d4-0000-0000-0000-000000000003', 'a1b2c3d4-0000-0000-0000-000000000003')
ON CONFLICT (citizen_id) DO NOTHING;
