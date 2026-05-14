# SafarPass ML Integration Handoff

This README is for the ML service owner. It explains what the current
frontend/backend already produces, where that data lives, and which ML
endpoints the passport app is expected to call next.

The ML services are separate from the NestJS backend and run on a DigitalOcean
Droplet.

## Current ML Endpoints

Use these current endpoints from the ML side:

| Purpose | Method | URL |
| --- | --- | --- |
| Identity document extraction | POST | `http://64.227.163.65:8000/extract-id-data` |
| Face / visual verification pipeline | POST | `http://64.227.163.65:8001/visualize-pipeline` |

The PDF contract says the app should upload files to Supabase Storage first,
then call ML using JSON payloads containing URLs. The current app follows that
model.

## Current Integration Status

Implemented in the passport app:

- Passport application rows are created in the NestJS backend.
- Document files upload to Supabase Storage through the backend.
- Document URLs are stored in the `documents` table.
- New passport applications create the application row before liveness capture,
  so liveness frame paths use the real `application_id` UUID.
- Liveness captures 9 JPG face frames:
  - 3 center frames
  - 3 right-turn frames
  - 3 left-turn frames
- Face frames upload to the private `biometrics` Supabase bucket.
- Face frame storage paths are stored in `biometric_data.face_frame_urls`.

Not implemented yet:

- The NestJS backend does not yet call the ML endpoints.
- Backend does not yet generate signed download URLs for ML.
- Backend does not yet have an internal ML callback endpoint for verification
  results.
- Fingerprint capture is not active in this build.

## Frontend Document Shape

The old single `identityDocument` field has been replaced in the application
flow by either National ID or Civil Registry Extract.

### Option 1: National ID

The citizen must upload two image files:

| Frontend field | DB `documents.document_type` | ML field |
| --- | --- | --- |
| `frontUrl` | `national_id_front` | `front_url` |
| `backUrl` | `national_id_back` | `back_url` |

Both fields are strings after upload. They are not arrays.

### Option 2: Civil Registry Extract

The citizen uploads one file:

| Frontend field | DB `documents.document_type` | ML field |
| --- | --- | --- |
| `civilRegistryExtract` | `civil_registry_extract` | `document_url` or `civil_registry_url` |

The exact ML field name for the extract can be kept as `document_url` for the
extraction endpoint, because that matches the API contract PDF.

### Other documents

| Frontend field | DB `documents.document_type` | Notes |
| --- | --- | --- |
| `passportPhoto` | `passport_photo` | Image-only upload |
| `oldPassport` | `old_passport` | Renewal applications only |
| `identityDocument` | `identity_document` | Legacy fallback for old seeded/mock records |

## Backend Endpoints Already Available

The frontend calls these NestJS endpoints. They are all under the backend API
base URL, usually `http://localhost:5000/api` in development.

### Upload application document

```http
POST /api/documents/upload
Content-Type: multipart/form-data
Authorization: Bearer <citizen-jwt>
```

Form fields:

| Field | Type | Required |
| --- | --- | --- |
| `file` | binary | yes |
| `applicationId` | UUID string | yes |
| `documentType` | string | yes |

Supported `documentType` values:

- `national_id_front`
- `national_id_back`
- `civil_registry_extract`
- `passport_photo`
- `old_passport`
- `identity_document` legacy

Response shape:

```json
{
  "success": true,
  "applicationId": "313b6f93-3585-408c-b66b-51bacf2f086f",
  "documentType": "national_id_front",
  "fileUrl": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<path>",
  "storagePath": "<application_id>/<document_type>/<file_name>",
  "document": {}
}
```

The returned `fileUrl` is the URL ML should use for public document files.

### Create signed upload URL for biometric frame

```http
POST /api/storage/biometrics/upload-url
Content-Type: application/json
Authorization: Bearer <citizen-jwt>
```

Request:

```json
{
  "applicationId": "313b6f93-3585-408c-b66b-51bacf2f086f",
  "fileName": "face_center_1.jpg"
}
```

Response:

```json
{
  "signedUrl": "https://<project-ref>.supabase.co/storage/v1/object/upload/sign/...",
  "path": "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_1.jpg"
}
```

The frontend then uploads the JPG directly to Supabase with:

```http
PUT <signedUrl>
Content-Type: image/jpeg
```

### Save biometric frame paths

```http
PATCH /api/applications/:applicationId/biometric-frames
Content-Type: application/json
Authorization: Bearer <citizen-jwt>
```

Request:

```json
{
  "frameUrls": [
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_1.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_2.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_3.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_right_1.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_right_2.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_right_3.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_left_1.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_left_2.jpg",
    "313b6f93-3585-408c-b66b-51bacf2f086f/face_left_3.jpg"
  ]
}
```

Important: these are storage paths, not public URLs. The `biometrics` bucket is
private. Before calling ML, the backend must convert each path into a signed
download URL.

## Supabase Storage Buckets

| Bucket | Public | Used for | Stored in DB as |
| --- | --- | --- | --- |
| `documents` | yes | National ID, extract, passport photo, old passport | Public URL in `documents.file_url` |
| `biometrics` | no | Liveness face JPG frames | Storage path in `biometric_data.face_frame_urls` |

Relevant backend env vars:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_STORAGE_BUCKET=documents
SUPABASE_BIOMETRICS_BUCKET=biometrics
```

The service-role key must stay server-side only.

## Database Tables ML Needs

The base schema lives in Supabase. The repo migrations add later pieces, but
the useful ML data sits in these tables.

### `applications`

Main application row.

Useful columns:

- `application_id` UUID
- `citizen_id` UUID
- `application_type` text, usually `new_passport` or `renewal`
- `current_status` text
- `payment_status` text
- `tracking_number` text
- `created_at` timestamp

ML currently consumes applications with `current_status = 'Pending'` once
payment/document/liveness inputs exist.

### `documents`

One row per uploaded document.

Useful columns:

- `document_id` UUID
- `application_id` UUID
- `document_type` text
- `file_url` text
- `verification_status` text, if present in the deployed schema
- `verification_notes` text, if present in the deployed schema

Current document types:

- `national_id_front`
- `national_id_back`
- `civil_registry_extract`
- `passport_photo`
- `old_passport`
- `identity_document` legacy

Query example:

```sql
select
  document_id,
  application_id,
  document_type,
  file_url,
  verification_status,
  verification_notes
from documents
where application_id = '<application-uuid>'
order by document_type;
```

### `biometric_data`

One row per application for biometric verification state.

Useful columns:

- `application_id` UUID
- `verification_status` text, defaults to `Pending`
- `face_frame_urls` JSONB, stores the 9 biometrics bucket paths

Query example:

```sql
select
  application_id,
  verification_status,
  face_frame_urls
from biometric_data
where application_id = '<application-uuid>';
```

Example `face_frame_urls` value:

```json
[
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_1.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_2.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_center_3.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_right_1.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_right_2.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_right_3.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_left_1.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_left_2.jpg",
  "313b6f93-3585-408c-b66b-51bacf2f086f/face_left_3.jpg"
]
```

### `resubmission_requests`

Used when a document fails verification and the citizen must upload it again.

Known columns:

- `request_id` UUID
- `application_id` UUID
- `document_id` UUID
- `reason` text
- `resolved` boolean
- `requested_at` timestamp
- `resolved_at` timestamp

### `application_status_history`

Use this whenever ML changes application status.

Useful columns:

- `application_id` UUID
- `old_status` text
- `new_status` text
- `change_reason` text
- timestamp column, depending on deployed schema

## Expected ML Payloads

These are the payloads the NestJS backend should construct once the ML
integration endpoint is added.

### ID extraction: National ID

```http
POST http://64.227.163.65:8000/extract-id-data
Content-Type: application/json
```

```json
{
  "document_type": "id_card",
  "front_url": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<national-id-front-path>",
  "back_url": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<national-id-back-path>"
}
```

### ID extraction: Civil Registry Extract

```http
POST http://64.227.163.65:8000/extract-id-data
Content-Type: application/json
```

```json
{
  "document_type": "civil_registry",
  "document_url": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<extract-path>"
}
```

### Visual verification

```http
POST http://64.227.163.65:8001/visualize-pipeline
Content-Type: application/json
```

Suggested payload from the current app data:

```json
{
  "application_id": "313b6f93-3585-408c-b66b-51bacf2f086f",
  "document_urls": {
    "front_url": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<national-id-front-path>",
    "back_url": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<national-id-back-path>",
    "civil_registry_url": null,
    "passport_photo_url": "https://<project-ref>.supabase.co/storage/v1/object/public/documents/<passport-photo-path>",
    "old_passport_url": null
  },
  "biometric_urls": {
    "face_frames": [
      "https://<signed-download-url-for-face-center-1>",
      "https://<signed-download-url-for-face-center-2>",
      "https://<signed-download-url-for-face-center-3>"
    ],
    "fingerprints_right": [],
    "fingerprints_left": [],
    "fingerprints_thumbs": []
  }
}
```

For Civil Registry Extract applications, `front_url` and `back_url` should be
`null`, and `civil_registry_url` should contain the extract URL.

If the ML service requires the exact PDF-contract keys (`id_image` and
`civil_registry_image`) instead of `front_url`, `back_url`, and
`civil_registry_url`, tell the backend owner before integration. The current app
data is already split correctly; only the adapter payload names would change.

## How Backend Should Build Signed Face Frame URLs

The DB stores biometrics as paths, for example:

```text
<application_id>/face_center_1.jpg
```

Before calling ML, NestJS should use the Supabase service-role client:

```ts
const { data, error } = await supabase.storage
  .from("biometrics")
  .createSignedUrl(path, 60 * 10);
```

Then send `data.signedUrl` in `biometric_urls.face_frames`.

## Verification Result Handling Needed Next

The following backend behavior is not built yet, but this is where ML results
should go.

On full success:

```sql
update applications
set current_status = 'Verified'
where application_id = '<application-uuid>';

update biometric_data
set verification_status = 'Verified'
where application_id = '<application-uuid>';
```

Also insert into `application_status_history`.

On document failure:

- Set `applications.current_status = 'Resubmission Required'`.
- Mark failed `documents.verification_status = 'Failed'`, if the column exists.
- Set `documents.verification_notes` with a human-readable reason, if present.
- Insert `resubmission_requests` rows linked to failed `document_id` values.
- Insert into `application_status_history`.
- Notify the citizen through the backend notification service.

On biometric failure:

- Keep or set `applications.current_status = 'Pending'` or
  `Resubmission Required`, depending on the final product rule.
- Set `biometric_data.verification_status = 'Failed'`.
- Store a human-readable reason if a notes column is added.

## Quick End-to-End Data Lookup

Given an `application_id`, this is the minimum ML input lookup:

```sql
select document_type, file_url
from documents
where application_id = '<application-uuid>';

select face_frame_urls
from biometric_data
where application_id = '<application-uuid>';
```

The document URLs are directly fetchable. The face frame paths must be converted
to signed Supabase download URLs first.

## Important Caveats

- New applications have liveness frames. Renewal applications currently skip
  liveness capture.
- Fingerprint arrays are not produced by the app right now. Send empty arrays
  if the ML endpoint still expects those fields.
- The `documents` bucket is public for demo convenience.
- The `biometrics` bucket should remain private.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to frontend or ML clients.
- The app currently uses manual/dev status transitions until the ML integration
  is wired.
