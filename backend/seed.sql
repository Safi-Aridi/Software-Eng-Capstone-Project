-- =============================================================================
-- NPIS Seed Data — feature/backend-integration
-- Run against the Supabase PostgreSQL database.
-- Uses fixed UUIDs for reproducibility across team environments.
-- Safe to re-run: ON CONFLICT DO NOTHING guards all inserts.
-- =============================================================================

-- Fixed UUIDs
-- citizen : a1b2c3d4-0000-0000-0000-000000000001
-- app 1   : a1b2c3d4-0001-0000-0000-000000000001  (new_passport, Mukhtar Signed, Paid)
-- app 2   : a1b2c3d4-0002-0000-0000-000000000001  (renewal, Pending, Pending)
-- app 3   : a1b2c3d4-0003-0000-0000-000000000001  (new_passport, Pending, Failed)

-- =============================================================================
-- 1. Roles
-- =============================================================================
INSERT INTO roles (role_id, role_name, description)
VALUES
  (1, 'citizen', 'Regular citizen user'),
  (2, 'mukhtar', 'Mukhtar official')
ON CONFLICT (role_id) DO NOTHING;

-- =============================================================================
-- 2. Users
-- =============================================================================
INSERT INTO users (
  user_id,
  role_id,
  first_name,
  last_name,
  email,
  phone,
  created_at
)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  1,
  'Test',
  'Citizen',
  'citizen.test@example.com',
  '+96112345678',
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 2.1. Mukhtar User
-- =============================================================================
INSERT INTO users (
  user_id,
  role_id,
  first_name,
  last_name,
  email,
  phone,
  created_at
)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000002',
  2,
  'Khalil',
  'Raad',
  'mukhtar.khalil@example.com',
  '+96187654321',
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- 3. Citizen Profile
-- =============================================================================
INSERT INTO citizen_profiles (
  citizen_id,
  user_id,
  date_of_birth,
  address,
  village,
  district,
  governorate,
  national_registry_number,
  phone_verified,
  created_at
)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'a1b2c3d4-0000-0000-0000-000000000001',
  '1990-01-01',
  '123 Hamra Street, Beirut',
  'Hamra',
  'Beirut',
  'Beirut',
  'NR-123456789',
  true,
  NOW()
)
ON CONFLICT (citizen_id) DO NOTHING;

-- =============================================================================
-- 5. Service Types
-- =============================================================================
INSERT INTO service_types (service_type_id, service_name, description)
VALUES
  (1, 'Passport Services', 'New passport and renewal services')
ON CONFLICT (service_type_id) DO NOTHING;

-- =============================================================================
-- 6. Branches
-- =============================================================================
INSERT INTO branches (
  branch_id,
  branch_name,
  location,
  district,
  governorate,
  processing_speed,
  status
)
VALUES
  (1, 'Beirut Central Branch', 'Hamra Street, Beirut', 'Beirut', 'Beirut', 3.5, 'Active')
ON CONFLICT (branch_id) DO NOTHING;

-- =============================================================================
-- 7. Passport validity options
-- =============================================================================
INSERT INTO passport_validity_options (validity_id, validity_years, fee_amount)
VALUES
  (1, 5,  200.00),
  (2, 10, 350.00)
ON CONFLICT (validity_id) DO NOTHING;

-- =============================================================================
-- 8. Applications
-- =============================================================================
INSERT INTO applications (
  application_id,
  citizen_id,
  service_type_id,
  validity_id,
  assigned_mukhtar_id,
  assigned_branch_id,
  assigned_officer_id,
  application_type,
  current_status,
  payment_status,
  tracking_number,
  created_at
)
VALUES
  (
    'a1b2c3d4-0001-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    1, 1, NULL, 1, NULL,
    'new_passport',
    'Mukhtar Signed',
    'Paid',
    'TRK-TEST-001',
    NOW()
  ),
  (
    'a1b2c3d4-0002-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    1, 2, NULL, 1, NULL,
    'renewal',
    'Pending',
    'Pending',
    'TRK-TEST-002',
    NOW()
  ),
  (
    'a1b2c3d4-0003-0000-0000-000000000001',
    'a1b2c3d4-0000-0000-0000-000000000001',
    1, 1, NULL, 1, NULL,
    'new_passport',
    'Pending',
    'Failed',
    'TRK-TEST-003',
    NOW()
  )
ON CONFLICT (application_id) DO NOTHING;

-- =============================================================================
-- 9. Documents
-- =============================================================================

-- App 1: identity_document + passport_photo
INSERT INTO documents (application_id, document_type, file_url)
VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'identity_document', 'https://placeholder.test/doc.jpg'),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'passport_photo',    'https://placeholder.test/doc.jpg')
ON CONFLICT DO NOTHING;

-- App 2: identity_document + passport_photo + old_passport
INSERT INTO documents (application_id, document_type, file_url)
VALUES
  ('a1b2c3d4-0002-0000-0000-000000000001', 'identity_document', 'https://placeholder.test/doc.jpg'),
  ('a1b2c3d4-0002-0000-0000-000000000001', 'passport_photo',    'https://placeholder.test/doc.jpg'),
  ('a1b2c3d4-0002-0000-0000-000000000001', 'old_passport',      'https://placeholder.test/doc.jpg')
ON CONFLICT DO NOTHING;

-- App 3: identity_document + passport_photo
INSERT INTO documents (application_id, document_type, file_url)
VALUES
  ('a1b2c3d4-0003-0000-0000-000000000001', 'identity_document', 'https://placeholder.test/doc.jpg'),
  ('a1b2c3d4-0003-0000-0000-000000000001', 'passport_photo',    'https://placeholder.test/doc.jpg')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 10. Mukhtar Profiles
-- =============================================================================
INSERT INTO mukhtar_profiles (
  mukhtar_id,
  user_id,
  village,
  district,
  governorate,
  office_address,
  branch_id,
  electronic_signature,
  is_active,
  created_at
)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000002',
  'a1b2c3d4-0000-0000-0000-000000000002',
  'Hamra',
  'Beirut',
  'Beirut',
  '123 Hamra Street, Beirut',
  1,
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  true,
  NOW()
)
ON CONFLICT (mukhtar_id) DO NOTHING;

-- =============================================================================
-- 11. Mukhtar form — App 1 only (already at Mukhtar Signed)
-- =============================================================================
INSERT INTO mukhtar_forms (
  form_id,
  application_id,
  form_data,
  signed_by,
  electronic_signature,
  signed,
  signed_at
)
VALUES (
  'a1b2c3d4-0001-0000-0000-000000000001',
  'a1b2c3d4-0001-0000-0000-000000000001',
  '{"address":"Hamra St","district":"Beirut","mukhtarName":"Khalil Raad"}',
  'a1b2c3d4-0000-0000-0000-000000000002',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  true,
  NOW()
)
ON CONFLICT (form_id) DO NOTHING;

-- =============================================================================
-- 12. Application status history (one entry per app reflecting current status)
-- =============================================================================
INSERT INTO application_status_history (
  history_id,
  application_id,
  old_status,
  new_status,
  change_reason,
  changed_at
)
VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'a1b2c3d4-0001-0000-0000-000000000001', 'Submitted', 'Mukhtar Signed', 'Application approved by Mukhtar', NOW()),
  ('a1b2c3d4-0002-0000-0000-000000000001', 'a1b2c3d4-0002-0000-0000-000000000001', NULL, 'Pending', 'Application submitted', NOW()),
  ('a1b2c3d4-0003-0000-0000-000000000001', 'a1b2c3d4-0003-0000-0000-000000000001', NULL, 'Pending', 'Application submitted', NOW())
ON CONFLICT (history_id) DO NOTHING;
