-- =============================================================================
-- NPIS — Migration 009
-- Full reseed: clears every per-user / per-application row and reinserts a
-- fresh dataset with 10 citizens, 26 mukhtars (one per Lebanese district),
-- 2 officers, and two demo applications (Safi + Jad) already at status
-- 'Verified'.
--
-- Migration 007 renames 'Verified' → 'Fingerprint Required' for legacy rows;
-- the rows seeded here use 'Verified' deliberately to match the frontend
-- ApplicationStatus.VERIFIED enum value the demo flow expects.
--
-- Passwords hashed by backend/scripts/generateHashes.ts (bcrypt, saltRounds=10).
-- Safe to re-run: ON CONFLICT clauses + idempotent DELETEs.
-- =============================================================================

BEGIN;

-- ─── 1. Wipe per-entity rows in FK-safe order ────────────────────────────────
DELETE FROM application_status_history;
DELETE FROM resubmission_requests;
DELETE FROM biometric_data;
DELETE FROM mukhtar_forms;
DELETE FROM documents;
DELETE FROM notifications;
DELETE FROM passports;
DELETE FROM applications;
DELETE FROM citizen_profiles;
DELETE FROM mukhtar_profiles;
-- Wipe every user — no admin email preserved (none seeded prior).
DELETE FROM users;

-- ─── 2. Roles (idempotent, ensures gs_officer is present) ────────────────────
INSERT INTO roles (role_id, role_name, description)
VALUES
  (1, 'citizen',    'Regular citizen user'),
  (2, 'mukhtar',    'Mukhtar official'),
  (3, 'gs_officer', 'General Security officer')
ON CONFLICT (role_id) DO UPDATE
  SET role_name = EXCLUDED.role_name,
      description = EXCLUDED.description;

-- ─── 3. Citizens (10) ────────────────────────────────────────────────────────
-- UUID convention: c1c1c1c1-0000-0000-0000-00000000000X (X = 1..a)
INSERT INTO users (
  user_id, role_id, first_name, last_name, email, phone,
  password_hash, account_status, failed_attempts
)
VALUES
  ('c1c1c1c1-0000-0000-0000-000000000001', 1, 'Safi',    'Test', 'safi@gmail.com',
   '+96112345671', '$2b$10$tWJmchWkcVZzfsKK/NSH0OMXsr2iKlb1VxP9.mSXkDXDJlqaaq.4.', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000002', 1, 'Mahmoud', 'Test', 'mahmoud@gmail.com',
   '+96112345672', '$2b$10$AUOPpCZjzke9Mo8HABtsXenVR2jNTBh5498x45/194k9OMUgEz2TK', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000003', 1, 'Jad',     'Test', 'jad@gmail.com',
   '+96112345673', '$2b$10$0qrPyIHRZ48eMzH/K2RyO..947I1CiD.S5x/hGkDBRkP17YsGgkT6', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000004', 1, 'Yasser',  'Test', 'yasser@gmail.com',
   '+96112345674', '$2b$10$2GKSJICVP1mm0wTc.uyVOOK29n2cp7KibYHF462LyOVATA0LtCvGS', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000005', 1, 'Makram',  'Test', 'makram@gmail.com',
   '+96112345675', '$2b$10$6hsy8Fiz491fNGLT2BQ1oe/oyp02gYfysGDwBBDO1nGARrzp3PkLK', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000006', 1, 'Houssam', 'Test', 'houssam@gmail.com',
   '+96112345676', '$2b$10$8CJIZKMgIKsi6sqwm0R0B.l9VVvU9RY/hU12vMA9dZng656nBwBC2', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000007', 1, 'Wael',    'Test', 'wael@gmail.com',
   '+96112345677', '$2b$10$OTFXu7lI00J5rVhqmYqiee6TWiY.CWo6TR8Il4OPqHHw9iQfl0zFK', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000008', 1, 'Joel',    'Test', 'joel@gmail.com',
   '+96112345678', '$2b$10$GWxMEXSZ.mfisogeYtz5HufV.WPqci.f92nHov4AfnaSm4vwf5EgW', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-000000000009', 1, 'Rena',    'Test', 'rena@gmail.com',
   '+96112345679', '$2b$10$maiTuNfoUZyfVkz.Z3Qnm.Qbl8eXloELtQvurAJoVLGE4HW9AuOX6', 'active', 0),
  ('c1c1c1c1-0000-0000-0000-00000000000a', 1, 'Khaled',  'Test', 'khaled@gmail.com',
   '+96112345670', '$2b$10$EH/d1kH0vYj.RiZIwDTG8.h6UKSJU6HXJBPwUIdG77iIbemM3uYEy', 'active', 0);

-- Citizen profile rows: citizen_id = user_id by convention.
INSERT INTO citizen_profiles (citizen_id, user_id)
VALUES
  ('c1c1c1c1-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001'),
  ('c1c1c1c1-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000002'),
  ('c1c1c1c1-0000-0000-0000-000000000003', 'c1c1c1c1-0000-0000-0000-000000000003'),
  ('c1c1c1c1-0000-0000-0000-000000000004', 'c1c1c1c1-0000-0000-0000-000000000004'),
  ('c1c1c1c1-0000-0000-0000-000000000005', 'c1c1c1c1-0000-0000-0000-000000000005'),
  ('c1c1c1c1-0000-0000-0000-000000000006', 'c1c1c1c1-0000-0000-0000-000000000006'),
  ('c1c1c1c1-0000-0000-0000-000000000007', 'c1c1c1c1-0000-0000-0000-000000000007'),
  ('c1c1c1c1-0000-0000-0000-000000000008', 'c1c1c1c1-0000-0000-0000-000000000008'),
  ('c1c1c1c1-0000-0000-0000-000000000009', 'c1c1c1c1-0000-0000-0000-000000000009'),
  ('c1c1c1c1-0000-0000-0000-00000000000a', 'c1c1c1c1-0000-0000-0000-00000000000a');

-- ─── 4. Mukhtars (26 — one per Lebanese district) ────────────────────────────
-- UUID convention: bbbbbbbb-0000-0000-0000-0000000000XX (XX = 01..1a hex)
-- Email convention: mukhtar.<district-slug>@gmail.com (lowercased, spaces → -)
-- Shared bcrypt hash for 'Mukhtar123!'.
INSERT INTO users (
  user_id, role_id, first_name, last_name, email, phone,
  password_hash, account_status, failed_attempts
)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 2, 'Mukhtar', 'Beirut',           'mukhtar.beirut@gmail.com',           '+96170000001', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000002', 2, 'Mukhtar', 'Metn',             'mukhtar.metn@gmail.com',             '+96170000002', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000003', 2, 'Mukhtar', 'Baabda',           'mukhtar.baabda@gmail.com',           '+96170000003', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000004', 2, 'Mukhtar', 'Aley',             'mukhtar.aley@gmail.com',             '+96170000004', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000005', 2, 'Mukhtar', 'Chouf',            'mukhtar.chouf@gmail.com',            '+96170000005', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000006', 2, 'Mukhtar', 'Jbeil',            'mukhtar.jbeil@gmail.com',            '+96170000006', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000007', 2, 'Mukhtar', 'Kesrouan',         'mukhtar.kesrouan@gmail.com',         '+96170000007', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000008', 2, 'Mukhtar', 'Batroun',          'mukhtar.batroun@gmail.com',          '+96170000008', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000009', 2, 'Mukhtar', 'Koura',            'mukhtar.koura@gmail.com',            '+96170000009', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000000a', 2, 'Mukhtar', 'Zgharta',          'mukhtar.zgharta@gmail.com',          '+96170000010', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 2, 'Mukhtar', 'Bcharre',          'mukhtar.bcharre@gmail.com',          '+96170000011', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 2, 'Mukhtar', 'Tripoli',          'mukhtar.tripoli@gmail.com',          '+96170000012', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000000d', 2, 'Mukhtar', 'Miniyeh-Danniyeh', 'mukhtar.miniyeh-danniyeh@gmail.com', '+96170000013', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000000e', 2, 'Mukhtar', 'Akkar',            'mukhtar.akkar@gmail.com',            '+96170000014', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000000f', 2, 'Mukhtar', 'Hermel',           'mukhtar.hermel@gmail.com',           '+96170000015', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000010', 2, 'Mukhtar', 'Baalbek',          'mukhtar.baalbek@gmail.com',          '+96170000016', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000011', 2, 'Mukhtar', 'Zahle',            'mukhtar.zahle@gmail.com',            '+96170000017', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000012', 2, 'Mukhtar', 'West Bekaa',       'mukhtar.west-bekaa@gmail.com',       '+96170000018', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000013', 2, 'Mukhtar', 'Rachaya',          'mukhtar.rachaya@gmail.com',          '+96170000019', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000014', 2, 'Mukhtar', 'Sidon',            'mukhtar.sidon@gmail.com',            '+96170000020', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000015', 2, 'Mukhtar', 'Tyre',             'mukhtar.tyre@gmail.com',             '+96170000021', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000016', 2, 'Mukhtar', 'Jezzine',          'mukhtar.jezzine@gmail.com',          '+96170000022', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000017', 2, 'Mukhtar', 'Nabatieh',         'mukhtar.nabatieh@gmail.com',         '+96170000023', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000018', 2, 'Mukhtar', 'Bint Jbeil',       'mukhtar.bint-jbeil@gmail.com',       '+96170000024', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-000000000019', 2, 'Mukhtar', 'Hasbaya',          'mukhtar.hasbaya@gmail.com',          '+96170000025', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0),
  ('bbbbbbbb-0000-0000-0000-00000000001a', 2, 'Mukhtar', 'Marjeyoun',        'mukhtar.marjeyoun@gmail.com',        '+96170000026', '$2b$10$.Uc31Fmr2DOyNoYHkFMS3ezy4GY3HlopUXHAOIINXPviwY3Q0x8gm', 'active', 0);

-- mukhtar_profiles: mukhtar_id = user_id by convention.
-- Each mukhtar's `district` column is what the FR-24 routing logic matches on.
INSERT INTO mukhtar_profiles (mukhtar_id, user_id, village, district, is_active, created_at)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Beirut',           'Beirut',           true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Metn',             'Metn',             true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'Baabda',           'Baabda',           true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000004', 'Aley',             'Aley',             true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000005', 'Chouf',            'Chouf',            true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000006', 'Jbeil',            'Jbeil',            true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000007', 'Kesrouan',         'Kesrouan',         true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000008', 'Batroun',          'Batroun',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000009', 'Koura',            'Koura',            true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000a', 'Zgharta',          'Zgharta',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Bcharre',          'Bcharre',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000c', 'bbbbbbbb-0000-0000-0000-00000000000c', 'Tripoli',          'Tripoli',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000d', 'bbbbbbbb-0000-0000-0000-00000000000d', 'Miniyeh-Danniyeh', 'Miniyeh-Danniyeh', true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000e', 'bbbbbbbb-0000-0000-0000-00000000000e', 'Akkar',            'Akkar',            true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000f', 'bbbbbbbb-0000-0000-0000-00000000000f', 'Hermel',           'Hermel',           true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000010', 'bbbbbbbb-0000-0000-0000-000000000010', 'Baalbek',          'Baalbek',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000011', 'Zahle',            'Zahle',            true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000012', 'bbbbbbbb-0000-0000-0000-000000000012', 'West Bekaa',       'West Bekaa',       true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000013', 'bbbbbbbb-0000-0000-0000-000000000013', 'Rachaya',          'Rachaya',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000014', 'bbbbbbbb-0000-0000-0000-000000000014', 'Sidon',            'Sidon',            true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000015', 'bbbbbbbb-0000-0000-0000-000000000015', 'Tyre',             'Tyre',             true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000016', 'bbbbbbbb-0000-0000-0000-000000000016', 'Jezzine',          'Jezzine',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000017', 'bbbbbbbb-0000-0000-0000-000000000017', 'Nabatieh',         'Nabatieh',         true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000018', 'bbbbbbbb-0000-0000-0000-000000000018', 'Bint Jbeil',       'Bint Jbeil',       true, NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000019', 'bbbbbbbb-0000-0000-0000-000000000019', 'Hasbaya',          'Hasbaya',          true, NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000001a', 'bbbbbbbb-0000-0000-0000-00000000001a', 'Marjeyoun',        'Marjeyoun',        true, NOW());

-- ─── 5. Officers (2) ─────────────────────────────────────────────────────────
-- UUID convention: 0ff10ff1-0000-0000-0000-00000000000X
-- Shared bcrypt hash for 'Officer123!'.
INSERT INTO users (
  user_id, role_id, first_name, last_name, email, phone,
  password_hash, account_status, failed_attempts
)
VALUES
  ('0ff10ff1-0000-0000-0000-000000000001', 3, 'Officer', 'One', 'officer1@gmail.com',
   '+96171000001', '$2b$10$fZW50x1odX0X/N6iOkAxAeKaVAAFQsL3MarKEk7r6nwphbMF2yS3.', 'active', 0),
  ('0ff10ff1-0000-0000-0000-000000000002', 3, 'Officer', 'Two', 'officer2@gmail.com',
   '+96171000002', '$2b$10$fZW50x1odX0X/N6iOkAxAeKaVAAFQsL3MarKEk7r6nwphbMF2yS3.', 'active', 0);

-- ─── 6. Applications for Safi + Jad (status: Verified) ───────────────────────
-- Verified = post-ML, pre-fingerprint-collection state (frontend enum VERIFIED).
-- validity_id=1 → 5y/200 LBP; assigned to the Beirut mukhtar.
INSERT INTO applications (
  application_id, citizen_id, service_type_id, validity_id, assigned_mukhtar_id,
  assigned_branch_id, assigned_officer_id, application_type, current_status,
  payment_status, tracking_number, created_at
)
VALUES
  -- Safi — submitted 3 days ago
  ('a99a99a9-0000-0000-0000-000000000101',
   'c1c1c1c1-0000-0000-0000-000000000001',
   1, 1,
   'bbbbbbbb-0000-0000-0000-000000000001', -- Beirut mukhtar
   1, NULL,
   'new_passport', 'Verified', 'Paid',
   'NPIS-2026-000101',
   NOW() - INTERVAL '3 days'),
  -- Jad — submitted 5 days ago
  ('a99a99a9-0000-0000-0000-000000000102',
   'c1c1c1c1-0000-0000-0000-000000000003',
   1, 1,
   'bbbbbbbb-0000-0000-0000-000000000001', -- Beirut mukhtar
   1, NULL,
   'new_passport', 'Verified', 'Paid',
   'NPIS-2026-000102',
   NOW() - INTERVAL '5 days');

-- ─── 7. Documents (national ID front/back + passport photo) ──────────────────
INSERT INTO documents (application_id, document_type, file_url)
VALUES
  ('a99a99a9-0000-0000-0000-000000000101', 'national_id_front', 'https://placeholder.test/safi/id_front.jpg'),
  ('a99a99a9-0000-0000-0000-000000000101', 'national_id_back',  'https://placeholder.test/safi/id_back.jpg'),
  ('a99a99a9-0000-0000-0000-000000000101', 'passport_photo',    'https://placeholder.test/safi/passport_photo.jpg'),
  ('a99a99a9-0000-0000-0000-000000000102', 'national_id_front', 'https://placeholder.test/jad/id_front.jpg'),
  ('a99a99a9-0000-0000-0000-000000000102', 'national_id_back',  'https://placeholder.test/jad/id_back.jpg'),
  ('a99a99a9-0000-0000-0000-000000000102', 'passport_photo',    'https://placeholder.test/jad/passport_photo.jpg');

-- ─── 8. Biometric data (face capture passed) ─────────────────────────────────
INSERT INTO biometric_data (application_id, face_frame_urls, verification_status)
VALUES
  ('a99a99a9-0000-0000-0000-000000000101',
   '["https://placeholder.test/safi/face_center_1.jpg","https://placeholder.test/safi/face_left_1.jpg","https://placeholder.test/safi/face_right_1.jpg"]'::jsonb,
   'Verified'),
  ('a99a99a9-0000-0000-0000-000000000102',
   '["https://placeholder.test/jad/face_center_1.jpg","https://placeholder.test/jad/face_left_1.jpg","https://placeholder.test/jad/face_right_1.jpg"]'::jsonb,
   'Verified');

-- ─── 9. Mukhtar form payload (citizen-side address + district) ───────────────
INSERT INTO mukhtar_forms (application_id, form_data, signed)
VALUES
  ('a99a99a9-0000-0000-0000-000000000101',
   '{"address":"12 Hamra Street, Beirut","district":"Beirut","mukhtarName":"Mukhtar Beirut"}'::jsonb,
   false),
  ('a99a99a9-0000-0000-0000-000000000102',
   '{"address":"22 Verdun Road, Beirut","district":"Beirut","mukhtarName":"Mukhtar Beirut"}'::jsonb,
   false);

-- ─── 10. Application status history: PENDING_REVIEW → VERIFIED ───────────────
INSERT INTO application_status_history (
  application_id, old_status, new_status, change_reason, changed_at
)
VALUES
  ('a99a99a9-0000-0000-0000-000000000101', NULL,      'Pending',  'Application submitted',                              NOW() - INTERVAL '3 days'),
  ('a99a99a9-0000-0000-0000-000000000101', 'Pending', 'Verified', 'ML document and biometric verification passed',      NOW() - INTERVAL '2 days'),
  ('a99a99a9-0000-0000-0000-000000000102', NULL,      'Pending',  'Application submitted',                              NOW() - INTERVAL '5 days'),
  ('a99a99a9-0000-0000-0000-000000000102', 'Pending', 'Verified', 'ML document and biometric verification passed',      NOW() - INTERVAL '4 days');

COMMIT;
