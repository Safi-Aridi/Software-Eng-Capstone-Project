import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PassportsService } from '../passports/passports.service';

type ResubmissionReasons = Partial<{
  identityDocument: string;
  frontUrl: string;
  backUrl: string;
  civilRegistryExtract: string;
  passportPhoto: string;
  oldPassport: string;
}>;

const DOCUMENT_TYPE_BY_REASON_KEY: Record<keyof ResubmissionReasons, string> = {
  identityDocument: 'identity_document',
  frontUrl: 'national_id_front',
  backUrl: 'national_id_back',
  civilRegistryExtract: 'civil_registry_extract',
  passportPhoto: 'passport_photo',
  oldPassport: 'old_passport',
};

type ApplicationDocuments = Partial<Record<keyof ResubmissionReasons, string>>;

export type AuthUser = {
  id: string;
  email?: string;
  role: 'citizen' | 'mukhtar' | 'officer' | 'admin' | string;
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly passportsService: PassportsService,
  ) {}

  // Helper: resolve a citizen application's owning user_id via citizen_profiles.
  private async getCitizenUserId(applicationId: string): Promise<string | null> {
    const result = await this.databaseService.query(
      `SELECT cp.user_id
       FROM applications a
       JOIN citizen_profiles cp ON cp.citizen_id = a.citizen_id
       WHERE a.application_id = $1`,
      [applicationId],
    );
    return (result.rows[0]?.user_id as string) ?? null;
  }

  // Helper: resolve a mukhtar's user_id from mukhtar_profiles by mukhtar_id.
  private async getMukhtarUserId(mukhtarId: string): Promise<string | null> {
    const result = await this.databaseService.query(
      `SELECT user_id FROM mukhtar_profiles WHERE mukhtar_id = $1`,
      [mukhtarId],
    );
    return (result.rows[0]?.user_id as string) ?? null;
  }

  // Helper: safely emit a notification — never throws into the caller.
  private async notify(
    userId: string | null,
    applicationId: string | null,
    message: string,
  ): Promise<void> {
    if (!userId) return;
    try {
      await this.notificationsService.create(userId, applicationId, message);
    } catch (err) {
      console.error('[applications.notify] failed:', err);
    }
  }

  private readonly applicationSelect = `
    SELECT
      a.*,
      docs.documents,
      rr.resubmission_reasons,
      mf.form_data AS mukhtar_form_data,
      mf.signed AS mukhtar_signed,
      mf.signed_at AS mukhtar_signed_at,
      mf.electronic_signature AS mukhtar_electronic_signature
    FROM applications a
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(
        CASE d.document_type
          WHEN 'identity_document' THEN 'identityDocument'
          WHEN 'national_id_front' THEN 'frontUrl'
          WHEN 'national_id_back' THEN 'backUrl'
          WHEN 'civil_registry_extract' THEN 'civilRegistryExtract'
          WHEN 'passport_photo' THEN 'passportPhoto'
          WHEN 'old_passport' THEN 'oldPassport'
          ELSE d.document_type
        END,
        d.file_url
      ) FILTER (WHERE d.file_url IS NOT NULL) AS documents
      FROM documents d
      WHERE d.application_id = a.application_id
    ) docs ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(
        CASE d.document_type
          WHEN 'identity_document' THEN 'identityDocument'
          WHEN 'national_id_front' THEN 'frontUrl'
          WHEN 'national_id_back' THEN 'backUrl'
          WHEN 'civil_registry_extract' THEN 'civilRegistryExtract'
          WHEN 'passport_photo' THEN 'passportPhoto'
          WHEN 'old_passport' THEN 'oldPassport'
          ELSE d.document_type
        END,
        r.reason
      ) FILTER (WHERE d.document_type IS NOT NULL) AS resubmission_reasons
      FROM resubmission_requests r
      LEFT JOIN documents d ON d.document_id = r.document_id
      WHERE r.application_id = a.application_id
        AND COALESCE(r.resolved, false) = false
    ) rr ON true
    LEFT JOIN mukhtar_forms mf ON mf.application_id = a.application_id
  `;

  private sanitizeReasons(reasons: unknown): ResubmissionReasons {
    if (!reasons || typeof reasons !== 'object') return {};
    const input = reasons as Record<string, unknown>;
    const out: ResubmissionReasons = {};

    (
      [
        'identityDocument',
        'frontUrl',
        'backUrl',
        'civilRegistryExtract',
        'passportPhoto',
        'oldPassport',
      ] as const
    ).forEach((key) => {
      if (typeof input[key] === 'string') {
        out[key] = input[key].trim();
      }
    });

    return Object.fromEntries(
      Object.entries(out).filter(
        ([, value]) => typeof value === 'string' && value.length > 0,
      ),
    ) as ResubmissionReasons;
  }

  private async getOrCreateDocumentId(
    applicationId: string,
    documentType: string,
  ): Promise<string> {
    const existing = await this.databaseService.query(
      `SELECT document_id
       FROM documents
       WHERE application_id = $1
         AND document_type = $2
       ORDER BY document_id
       LIMIT 1`,
      [applicationId, documentType],
    );

    if (existing.rowCount && existing.rows[0].document_id) {
      return existing.rows[0].document_id as string;
    }

    const created = await this.databaseService.query(
      `INSERT INTO documents (application_id, document_type, file_url)
       VALUES ($1, $2, $3)
       RETURNING document_id`,
      [
        applicationId,
        documentType,
        `pending-resubmission://${applicationId}/${documentType}`,
      ],
    );

    return created.rows[0].document_id as string;
  }

  private async upsertDocumentUrls(
    applicationId: string,
    documents: unknown,
  ): Promise<void> {
    if (!documents || typeof documents !== 'object') return;

    const input = documents as ApplicationDocuments;
    for (const [frontendKey, fileUrl] of Object.entries(input) as [
      keyof ApplicationDocuments,
      string | undefined,
    ][]) {
      if (!fileUrl || typeof fileUrl !== 'string') continue;
      const documentType = DOCUMENT_TYPE_BY_REASON_KEY[frontendKey];
      if (!documentType) continue;

      const updated = await this.databaseService.query(
        `UPDATE documents
         SET file_url = $3
         WHERE application_id = $1
           AND document_type = $2
         RETURNING document_id`,
        [applicationId, documentType, fileUrl],
      );

      if (!updated.rowCount) {
        await this.databaseService.query(
          `INSERT INTO documents (application_id, document_type, file_url)
           VALUES ($1, $2, $3)`,
          [applicationId, documentType, fileUrl],
        );
      }
    }
  }

  private appendAccessFilter(
    clauses: string[],
    params: unknown[],
    user?: AuthUser,
  ): void {
    if (!user || user.role === 'admin') return;

    if (user.role === 'citizen') {
      params.push(user.id);
      clauses.push(`EXISTS (
        SELECT 1
        FROM citizen_profiles cp
        WHERE cp.citizen_id = a.citizen_id
          AND cp.user_id = $${params.length}
      )`);
      return;
    }

    if (user.role === 'mukhtar') {
      clauses.push("a.current_status = 'Fingerprint Required'");
      return;
    }

    if (user.role === 'officer') {
      clauses.push(
        "a.current_status IN ('Mukhtar Signed', 'Processed for Issuance', 'Issued')",
      );
    }
  }

  private async assertApplicationAccess(
    applicationId: string,
    user?: AuthUser,
  ): Promise<void> {
    if (!user || user.role === 'admin') return;
    if (user.role !== 'citizen') return;

    const result = await this.databaseService.query(
      `SELECT 1
       FROM applications a
       JOIN citizen_profiles cp ON cp.citizen_id = a.citizen_id
       WHERE a.application_id = $1
         AND cp.user_id = $2`,
      [applicationId, user.id],
    );

    if (!result.rowCount) {
      throw new ForbiddenException('You do not have access to this application');
    }
  }

  // P4-D: Mukhtar queue, filtered by the logged-in mukhtar's user_id.
  // Applications with NULL assigned_mukhtar_id (legacy data) intentionally
  // never surface in any mukhtar's queue — they would have to be reassigned
  // by an admin first.
  async findMukhtarQueue(mukhtarUserId: string) {
    const query = `
      ${this.applicationSelect}
      WHERE a.current_status = 'Fingerprint Required'
        AND a.assigned_mukhtar_id = $1
      ORDER BY a.created_at DESC
    `;
    const result = await this.databaseService.query(query, [mukhtarUserId]);
    return result.rows;
  }

  async findAll(role?: string, user?: AuthUser) {
    let query = this.applicationSelect;
    const params: unknown[] = [];
    const clauses: string[] = [];
    const effectiveRole =
      role && (!user || user.role === role || user.role === 'admin')
        ? role
        : undefined;

    if (effectiveRole === 'mukhtar') {
      clauses.push("a.current_status = 'Fingerprint Required'");
    } else if (effectiveRole === 'officer') {
      clauses.push("a.current_status = 'Mukhtar Signed'");
    } else {
      this.appendAccessFilter(clauses, params, user);
    }

    if (clauses.length > 0) {
      query += ` WHERE ${clauses.join(' AND ')}`;
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await this.databaseService.query(query, params);
    return result.rows;
  }

  async findOne(id: string, user?: AuthUser) {
    await this.assertApplicationAccess(id, user);

    const query = `
      ${this.applicationSelect}
      WHERE a.application_id = $1
      LIMIT 1
    `;

    const result = await this.databaseService.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return result.rows[0];
  }

  async getStatus(id: string, user?: AuthUser) {
    const application = await this.findOne(id, user);

    return {
      success: true,
      applicationId: id,
      status: application.current_status || application.status || 'Unknown',
    };
  }

  async create(body: any, user?: AuthUser) {
    const citizenId = user?.role === 'citizen' ? user.id : body.citizenId;

    const query = `
      INSERT INTO applications (
        citizen_id,
        service_type_id,
        validity_id,
        assigned_branch_id,
        application_type,
        current_status,
        payment_status,
        tracking_number,
        assigned_mukhtar_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const trackingNumber = `NPIS-${new Date().getFullYear()}-${Math.floor(
      100000 + Math.random() * 900000,
    )}`;

    const result = await this.databaseService.query(query, [
      citizenId,
      body.serviceTypeId || 1,
      body.validityId || 1,
      body.assignedBranchId || 1,
      body.applicationType || 'new_passport',
      'Pending',
      'Pending',
      trackingNumber,
      // P4-C: persist the citizen's selected mukhtar so the mukhtar queue can
      // filter by it. Null is acceptable (legacy behavior).
      body.assignedMukhtarId ?? null,
    ]);

    const created = result.rows[0];
    const newApplicationId = created.application_id as string;

    // Persist the mukhtar form payload alongside the application. Non-fatal —
    // a failure here must not roll back the application insert.
    try {
      await this.databaseService.query(
        `INSERT INTO mukhtar_forms (application_id, form_data)
         VALUES ($1, $2)`,
        [
          newApplicationId,
          JSON.stringify(body.mukhtarFormData ?? {}),
        ],
      );
    } catch (error) {
      console.error('[ERROR] mukhtar_forms insert failed:', error);
    }

    try {
      await this.upsertDocumentUrls(newApplicationId, body.documents);
    } catch (err) {
      console.error(
        `[applications.create] document URL insert failed for ${newApplicationId}:`,
        err,
      );
    }

    // Record biometric capture intent so the ML pipeline can pick it up.
    if (body.biometricCaptured === true) {
      try {
        await this.databaseService.query(
          `INSERT INTO biometric_data (application_id, verification_status)
           VALUES ($1, 'Pending')`,
          [newApplicationId],
        );
      } catch (err) {
        console.error(
          `[applications.create] biometric_data insert failed for ${newApplicationId}:`,
          err,
        );
      }
    }

    return {
      success: true,
      message: 'Application created successfully',
      application: created,
    };
  }

  async update(id: string, body: any, user?: AuthUser) {
    await this.assertApplicationAccess(id, user);

    const allowedFields: Record<string, string> = {
      currentStatus: 'current_status',
      paymentStatus: 'payment_status',
      assignedMukhtarId: 'assigned_mukhtar_id',
      assignedBranchId: 'assigned_branch_id',
      assignedOfficerId: 'assigned_officer_id',
      estimatedCompletionDate: 'estimated_completion_date',
      completedAt: 'completed_at',
    };

    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(allowedFields).forEach(([bodyKey, columnName]) => {
      if (body[bodyKey] !== undefined) {
        values.push(body[bodyKey]);
        updates.push(`${columnName} = $${values.length}`);
      }
    });

    if (updates.length === 0) {
      return {
        success: false,
        message: 'No valid fields provided for update',
        allowedFields: Object.keys(allowedFields),
      };
    }

    values.push(id);

    const query = `
      UPDATE applications
      SET ${updates.join(', ')}
      WHERE application_id = $${values.length}
      RETURNING *
    `;

    const result = await this.databaseService.query(query, values);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Application updated successfully',
      applicationId: id,
      application: result.rows[0],
    };
  }

  async requestResubmission(id: string, body: any) {
    const prior = await this.databaseService.query(
      'SELECT current_status FROM applications WHERE application_id = $1',
      [id],
    );
    if (prior.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    const oldStatus = prior.rows[0].current_status as string | null;
    const reasons = this.sanitizeReasons(body.resubmissionReasons);

    await this.databaseService.query(
      `UPDATE resubmission_requests
       SET resolved = true,
           resolved_at = now()
       WHERE application_id = $1
         AND COALESCE(resolved, false) = false`,
      [id],
    );

    for (const [reasonKey, reason] of Object.entries(reasons) as [
      keyof ResubmissionReasons,
      string,
    ][]) {
      const documentType = DOCUMENT_TYPE_BY_REASON_KEY[reasonKey];
      const documentId = await this.getOrCreateDocumentId(id, documentType);

      await this.databaseService.query(
        `INSERT INTO resubmission_requests
           (application_id, document_id, reason, resolved, requested_at)
         VALUES ($1, $2, $3, false, now())`,
        [id, documentId, reason],
      );
    }

    await this.databaseService.query(
      `UPDATE applications
       SET current_status = $1
       WHERE application_id = $2`,
      ['Resubmission Required', id],
    );

    await this.databaseService.query(
      `INSERT INTO application_status_history
         (application_id, old_status, new_status, change_reason)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        oldStatus,
        'Resubmission Required',
        'Mukhtar requested document resubmission',
      ],
    );

    if (body.mukhtarId) {
      await this.auditService.createLog({
        userId: body.mukhtarId,
        action: 'APPLICATION_RESUBMISSION_REQUESTED',
        entityType: 'application',
        entityId: id,
      });
    }

    const citizenUserId = await this.getCitizenUserId(id);
    await this.notify(
      citizenUserId,
      id,
      'Your application requires document resubmission. Please check the details.',
    );

    return {
      success: true,
      message: 'Resubmission requested successfully',
      applicationId: id,
      application: await this.findOne(id),
    };
  }

  async resubmitDocuments(id: string, body: any, user?: AuthUser) {
    await this.assertApplicationAccess(id, user);

    const prior = await this.databaseService.query(
      'SELECT current_status FROM applications WHERE application_id = $1',
      [id],
    );
    if (prior.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    const oldStatus = prior.rows[0].current_status as string | null;

    await this.databaseService.query(
      `UPDATE applications
       SET current_status = $1
       WHERE application_id = $2`,
      ['Pending', id],
    );

    await this.upsertDocumentUrls(id, body.documents);

    await this.databaseService.query(
      `UPDATE resubmission_requests
       SET resolved = true,
           resolved_at = now()
       WHERE application_id = $1
         AND COALESCE(resolved, false) = false`,
      [id],
    );

    await this.databaseService.query(
      `INSERT INTO application_status_history
         (application_id, old_status, new_status, change_reason)
       VALUES ($1, $2, $3, $4)`,
      [id, oldStatus, 'Pending', 'Citizen resubmitted requested documents'],
    );

    if (body.citizenId) {
      await this.auditService.createLog({
        userId: body.citizenId,
        action: 'APPLICATION_DOCUMENTS_RESUBMITTED',
        entityType: 'application',
        entityId: id,
      });
    }

    // Notify the assigned Mukhtar (if any) that documents are back in their queue.
    try {
      const assignedRow = await this.databaseService.query(
        `SELECT assigned_mukhtar_id FROM applications WHERE application_id = $1`,
        [id],
      );
      const assignedMukhtarId = assignedRow.rows[0]?.assigned_mukhtar_id as
        | string
        | null;
      if (assignedMukhtarId) {
        const mukhtarUserId = await this.getMukhtarUserId(assignedMukhtarId);
        await this.notify(
          mukhtarUserId,
          id,
          'A citizen has resubmitted documents for your review.',
        );
      }
    } catch (err) {
      console.error('[applications.resubmitDocuments] mukhtar notify failed:', err);
    }

    // Fire ML verification async — same as initial submission.
    // Non-blocking: resubmission is accepted regardless; ML will
    // flip the status to Fingerprint Required or Resubmission Required on its own.
    this.verifyApplicationML(id).catch((err) =>
      console.error('[resubmitDocuments] ML pipeline error:', err),
    );

    return {
      success: true,
      message: 'Documents resubmitted successfully',
      applicationId: id,
      application: await this.findOne(id),
    };
  }

  async signApplication(id: string, body: any) {
    const prior = await this.databaseService.query(
      'SELECT current_status FROM applications WHERE application_id = $1',
      [id],
    );
    if (prior.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    const oldStatus = prior.rows[0].current_status as string | null;

    const result = await this.databaseService.query(
      `UPDATE applications
       SET current_status = $1
       WHERE application_id = $2
       RETURNING *`,
      ['Mukhtar Signed', id],
    );

    await this.databaseService.query(
      `INSERT INTO application_status_history
         (application_id, old_status, new_status, change_reason)
       VALUES ($1, $2, $3, $4)`,
      [id, oldStatus, 'Mukhtar Signed', 'Mukhtar electronic signature applied'],
    );

    // Mark the matching mukhtar_forms row as signed with a generated
    // signature token. Non-fatal — the sign action proceeds even if the
    // form row is missing for any reason.
    try {
      const electronicSignature = `SIG-${body.mukhtarId ?? 'unknown'}-${Date.now()}`;
      await this.databaseService.query(
        `UPDATE mukhtar_forms
         SET signed = true,
             signed_by = $1,
             signed_at = NOW(),
             electronic_signature = $2
         WHERE application_id = $3`,
        [body.mukhtarId ?? null, electronicSignature, id],
      );
    } catch (err) {
      console.error(
        `[applications.signApplication] mukhtar_forms update failed for ${id}:`,
        err,
      );
    }

    await this.auditService.createLog({
      userId: body.mukhtarId,
      action: 'APPLICATION_SIGNED_BY_MUKHTAR',
      entityType: 'application',
      entityId: id,
    });

    const citizenUserId = await this.getCitizenUserId(id);
    await this.notify(
      citizenUserId,
      id,
      'Your application has been signed by your Mukhtar and is now under review.',
    );

    return {
      success: true,
      message: 'Application signed successfully',
      applicationId: id,
      signedBy: body.mukhtarId,
      application: result.rows[0],
    };
  }

  async approveApplication(id: string, body: any) {
    const prior = await this.databaseService.query(
      'SELECT current_status FROM applications WHERE application_id = $1',
      [id],
    );
    if (prior.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }
    const oldStatus = prior.rows[0].current_status as string | null;

    const result = await this.databaseService.query(
      `UPDATE applications
       SET current_status = $1
       WHERE application_id = $2
       RETURNING *`,
      ['Processed for Issuance', id],
    );

    await this.databaseService.query(
      `INSERT INTO application_status_history
         (application_id, old_status, new_status, change_reason)
       VALUES ($1, $2, $3, $4)`,
      [id, oldStatus, 'Processed for Issuance', 'GS Officer final approval'],
    );

    await this.auditService.createLog({
      userId: body.officerId,
      action: 'APPLICATION_APPROVED_BY_OFFICER',
      entityType: 'application',
      entityId: id,
    });

    const citizenUserId = await this.getCitizenUserId(id);
    await this.notify(
      citizenUserId,
      id,
      'Your application has been approved and is being processed for issuance.',
    );

    return {
      success: true,
      message: 'Application approved successfully',
      applicationId: id,
      approvedBy: body.officerId,
      application: result.rows[0],
    };
  }

  cancelOldPassport(id: string, body: any) {
    return {
      success: true,
      message: 'Old passport cancellation endpoint reserved and working',
      applicationId: id,
      cancelledBy: body.officerId || 'demo-officer-id',
      oldPassportStatus: 'Cancelled',
    };
  }

  async issueApplication(
    applicationId: string,
    officerId: string,
    bookletNumber: string,
  ) {
    // 1. Load the application
    const appRow = await this.databaseService.query(
      `SELECT citizen_id, validity_id, application_type,
              renewing_passport_id, current_status
       FROM applications
       WHERE application_id = $1`,
      [applicationId],
    );
    if (appRow.rowCount === 0) {
      throw new NotFoundException(
        `Application with ID ${applicationId} not found`,
      );
    }
    const app = appRow.rows[0];
    const oldStatus = app.current_status as string | null;

    // 2. Validity years
    const validityRow = await this.databaseService.query(
      `SELECT validity_years FROM passport_validity_options WHERE validity_id = $1`,
      [app.validity_id],
    );
    const validityYears = (validityRow.rows[0]?.validity_years as number) ?? 5;

    // 3. Citizen user_id
    const profile = await this.databaseService.query(
      `SELECT user_id FROM citizen_profiles WHERE citizen_id = $1`,
      [app.citizen_id],
    );
    const citizenUserId = profile.rows[0]?.user_id as string | undefined;
    if (!citizenUserId) {
      throw new NotFoundException(
        `Citizen profile not found for application ${applicationId}`,
      );
    }

    // 4. Create the passport
    const createdPassport = await this.passportsService.createPassport({
      userId: citizenUserId,
      sourceApplicationId: applicationId,
      bookletNumber,
      validityYears,
    });

    // 5. Cancel the renewed passport, if any
    let cancelledPassport: unknown = null;
    if (
      app.application_type === 'renewal' &&
      app.renewing_passport_id
    ) {
      cancelledPassport = await this.passportsService.cancelPassport(
        app.renewing_passport_id as string,
        applicationId,
      );
    }

    // 6. Update application: status, officer, completion timestamp
    const updated = await this.databaseService.query(
      `UPDATE applications
       SET current_status = 'Issued',
           completed_at = NOW()
       WHERE application_id = $1
       RETURNING *`,
      [applicationId],
    );

    // 7. Status history entry
    await this.databaseService.query(
      `INSERT INTO application_status_history
         (application_id, old_status, new_status, change_reason)
       VALUES ($1, $2, $3, $4)`,
      [applicationId, oldStatus, 'Issued', 'GS Officer issued passport booklet'],
    );

    await this.auditService.createLog({
      userId: officerId,
      action: 'PASSPORT_ISSUED',
      entityType: 'application',
      entityId: applicationId,
    });

    // 8. Notify citizen
    await this.notify(
      citizenUserId,
      applicationId,
      'Your passport has been issued and will be delivered soon.',
    );

    // 9. LibanPost manifest placeholder
    // TODO FR-31: Replace with real LibanPost API call
    console.log('[LibanPost] Manifest triggered for:', {
      applicationId,
      bookletNumber,
      citizenUserId,
    });

    return {
      success: true,
      message: 'Application issued successfully',
      applicationId,
      application: updated.rows[0],
      passport: createdPassport,
      cancelledPassport,
    };
  }

  // P2-A: ID extraction (port 8000) called synchronously after the application
  // is created so the citizen sees the parsed identity fields in Step 6 review.
  // Document storage uses 'national_id_front'/'national_id_back' for id_card
  // and 'civil_registry_extract' for civil_registry — this matches what the ML
  // server expects on port 8000 (front_url+back_url OR document_url).
  async extractIdData(
    applicationId: string,
    documentType: 'id_card' | 'civil_registry',
  ): Promise<unknown> {
    const ML_BASE_URL = process.env.ML_BASE_URL ?? 'http://64.227.163.65';

    const docs = await this.databaseService.query(
      `SELECT document_type, file_url FROM documents WHERE application_id = $1`,
      [applicationId],
    );

    let payload: Record<string, string>;
    if (documentType === 'id_card') {
      const front = docs.rows.find((r: any) => r.document_type === 'national_id_front')?.file_url;
      const back = docs.rows.find((r: any) => r.document_type === 'national_id_back')?.file_url;
      if (!front || !back) {
        throw new NotFoundException('Identity document not uploaded yet');
      }
      payload = { document_type: 'id_card', front_url: front, back_url: back };
    } else {
      const extract = docs.rows.find(
        (r: any) => r.document_type === 'civil_registry_extract',
      )?.file_url;
      if (!extract) {
        throw new NotFoundException('Identity document not uploaded yet');
      }
      payload = { document_type: 'civil_registry', document_url: extract };
    }

    try {
      const res = await fetch(`${ML_BASE_URL}:8000/extract-id-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        console.error(`[extractIdData] ML port 8000 ${res.status}: ${errText}`);
        throw new InternalServerErrorException('Document extraction failed');
      }
      const json = await res.json();
      // ML returns { status: 'success', document_detected, data: {...} }.
      // Flatten the 'data' payload so the frontend can read fields directly.
      return json?.data ?? json;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error('[extractIdData] ML pipeline error:', err);
      throw new InternalServerErrorException('Document extraction failed');
    }
  }

  async updateBiometricFrameUrls(
    applicationId: string,
    frameUrls: string[],
  ): Promise<{ success: true }> {
    await this.databaseService.query(
      `INSERT INTO biometric_data
         (application_id, face_frame_urls, verification_status)
       VALUES ($1, $2::jsonb, 'Pending')
       ON CONFLICT (application_id) DO UPDATE
       SET face_frame_urls = EXCLUDED.face_frame_urls`,
      [applicationId, JSON.stringify(frameUrls)],
    );
    return { success: true };
  }
  
  // --- THE COMPLETE ML VERIFICATION BRIDGE ---
  async verifyApplicationML(applicationId: string) {
    console.log('--- STARTING KYC ML PIPELINE ---');
    const ML_BASE_URL = process.env.ML_BASE_URL ?? 'http://64.227.163.65';

    let frontUrl: string | null = null;
    let backUrl: string | null = null;
    let extractUrl: string | null = null;
    let passportPhotoUrl: string | null = null;

    try {
      // 1. Pull ALL URLs from the database
      const docsResult = await this.databaseService.query(
        `SELECT document_type, file_url FROM documents WHERE application_id = $1`,
        [applicationId]
      );

      docsResult.rows.forEach(row => {
        if (row.document_type === 'national_id_front') frontUrl = row.file_url;
        if (row.document_type === 'national_id_back') backUrl = row.file_url;
        if (row.document_type === 'civil_registry_extract') extractUrl = row.file_url;
        if (row.document_type === 'passport_photo') passportPhotoUrl = row.file_url;
      });

      // P1-D: passport photo is required for the port-8001 face-verification call.
      // If it's missing, short-circuit immediately — do not call ML at all.
      if (!passportPhotoUrl) {
        console.warn(`[verifyApplicationML] No passport photo for ${applicationId} — short-circuiting to Resubmission Required.`);
        try {
          const documentId = await this.getOrCreateDocumentId(applicationId, 'passport_photo');
          await this.databaseService.query(
            `INSERT INTO resubmission_requests (application_id, document_id, reason, resolved, requested_at)
             VALUES ($1, $2, $3, false, now())`,
            [applicationId, documentId, 'Passport photo is required for verification.']
          );
        } catch (dbErr) {
          console.error('[verifyApplicationML] Failed to insert missing-passport resubmission row:', dbErr);
        }
        await this.databaseService.query(
          `UPDATE applications SET current_status = 'Resubmission Required' WHERE application_id = $1`,
          [applicationId],
        );
        return {
          success: false,
          status: 'Resubmission Required',
          error: 'PASSPORT_ERROR: Passport photo is required for verification.',
        };
      }

      // ==========================================
      // STEP [1/2]: ID EXTRACTION (Port 8000)
      // ==========================================
      let idResponse;
      if (frontUrl && backUrl) {
        console.log(`[1/2] Sending National ID to ${ML_BASE_URL}:8000...`);
        idResponse = await fetch(`${ML_BASE_URL}:8000/extract-id-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_type: 'id_card', front_url: frontUrl, back_url: backUrl })
        });
      } else if (extractUrl) {
        console.log(`[1/2] Sending Civil Extract to ${ML_BASE_URL}:8000...`);
        idResponse = await fetch(`${ML_BASE_URL}:8000/extract-id-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_type: 'civil_registry', document_url: extractUrl })
        });
      } else {
        throw new Error("ID_ERROR: No ID documents found to verify.");
      }

     let idData;
      if (!idResponse.ok) {
        let mlError = "Invalid ID Document.";
        try { 
          const errData = await idResponse.json();
          // Pydantic validation errors come as an array in errData.detail
          if (Array.isArray(errData.detail)) {
            mlError = "Document format was rejected by the verification engine. Please re-upload.";
          } else {
            const raw = errData.detail || errData.error || errData.message || errData;
            mlError = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
          }
        } catch { mlError = await idResponse.text(); }
        throw new Error(`ID_ERROR: ${mlError}`);
      }
      idData = await idResponse.json();
      
      // --- NEW RECON LOG ---
      console.log("PORT 8000 FULL RESPONSE:", idData);
      // ---------------------

      // Catch Python "Soft Errors" (200 OK, but status='error')
      if (idData.status === 'error' || idData.status === 'fail' || idData.status === 'False') {
        throw new Error(`ID_ERROR: ${idData.message}`);
      }

      // Extract the YOLO crop base64 (Just in case they put it inside 'message')
      
      const idFaceBase64 = idData.id_photo_base64 || idData.face_base64 || idData.cropped_face 
  || idData.data?.id_photo_base64 || idData.data?.face_base64 || idData.data?.cropped_face;
  
      if (!idFaceBase64) {
        throw new Error("ID_ERROR: The ID engine read your data but couldn't find your photo in the result.");
      }
      console.log('[1/2] Success! Face extracted from the ID profile.');
             
      // ==========================================
      // STEP [2/2]: VISUAL VERIFICATION (Port 8001)
      // ==========================================
      console.log(`[2/2] Sending Face Verification to ${ML_BASE_URL}:8001...`);

      // P1-E: pull live face frames from biometric_data when present (NEW
      // applications). Renewals — and any row missing frames — fall through to
      // the Mode-A "Dev Skip" path on the ML side with an empty array.
      let livePhotoUrls: string[] = [];
      try {
        const bioResult = await this.databaseService.query(
          `SELECT face_frame_urls FROM biometric_data WHERE application_id = $1`,
          [applicationId],
        );
        const frames = bioResult.rows[0]?.face_frame_urls;
        const parsed: unknown =
          typeof frames === 'string' ? JSON.parse(frames) : frames;
        if (Array.isArray(parsed) && parsed.length > 0) {
          livePhotoUrls = (parsed as unknown[])
            .filter((u): u is string => typeof u === 'string' && u.length > 0)
            .slice(0, 3);
        }
      } catch (bioErr) {
        console.error('[verifyApplicationML] biometric_data lookup failed; proceeding with empty live_photo_urls:', bioErr);
        livePhotoUrls = [];
      }

      const verifyResponse = await fetch(`${ML_BASE_URL}:8001/visualize-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_face_base64: idFaceBase64,
          passport_photo_url: passportPhotoUrl,
          live_photo_urls: livePhotoUrls 
        })
      });

      if (!verifyResponse.ok) {
        let mlError: any = "Face Verification Failed.";
        try { 
          const errData = await verifyResponse.json(); 
          // Extract the string if it's nested, or stringify if it's an object
          mlError = errData.detail || errData.error || errData.message || errData;
          if (typeof mlError === 'object') mlError = JSON.stringify(mlError);
        } catch { 
          mlError = await verifyResponse.text(); 
        }
        throw new Error(mlError); 
      }
      console.log('[2/2] Success! Faces match.');

      // ==========================================
      // FINALIZE: MARK AS FINGERPRINT REQUIRED
      // ==========================================
      await this.databaseService.query(
        `UPDATE applications SET current_status = 'Fingerprint Required' WHERE application_id = $1`,
        [applicationId],
      );
      await this.databaseService.query(
        `INSERT INTO application_status_history (application_id, old_status, new_status, change_reason)
         VALUES ($1, 'Pending', 'Fingerprint Required', 'ML verification passed — citizen required to visit branch for physical fingerprint collection')`,
        [applicationId],
      );

      // P3-H: notify the citizen that ML passed and they must visit a branch
      const citizenUserId = await this.getCitizenUserId(applicationId);
      await this.notify(
        citizenUserId,
        applicationId,
        'Your documents have been verified. Please visit your nearest General Security branch for physical fingerprint collection to proceed with your application.',
      );

      console.log('--- KYC PIPELINE COMPLETE ---');
      return { success: true, status: 'Fingerprint Required' };

    } catch (error: any) {
      console.error('KYC Pipeline Error:', error.message);
      
      // THE SMART RESUBMISSION ROUTER
      try {
        const docsToReject: string[] = [];
        const errorString = error.message;

        // Route the error to the correct UI box based on the Python prefix
        if (errorString.includes('PASSPORT_ERROR')) {
          docsToReject.push('passport_photo');
        } else if (errorString.includes('ID_ERROR')) {
          if (frontUrl) docsToReject.push('national_id_front');
          if (backUrl) docsToReject.push('national_id_back');
          if (extractUrl) docsToReject.push('civil_registry_extract');
        } else {
          // Fallback: if the error mentions passport, flag passport. 
          // Otherwise flag whatever was actually submitted (ID docs).
          const lowerErr = errorString.toLowerCase();
          if (lowerErr.includes('passport') || lowerErr.includes('photo')) {
            if (passportPhotoUrl) docsToReject.push('passport_photo');
          } else {
            if (frontUrl) docsToReject.push('national_id_front');
            if (backUrl) docsToReject.push('national_id_back');
            if (extractUrl) docsToReject.push('civil_registry_extract');
            if (passportPhotoUrl) docsToReject.push('passport_photo');
          }
        }

        // Clean the prefix out of the message so the citizen gets a clean sentence
        const cleanMessage = errorString.replace('PASSPORT_ERROR: ', '').replace('ID_ERROR: ', '').replace('LIVENESS_ERROR: ', '');

        for (const docType of docsToReject) {
          const documentId = await this.getOrCreateDocumentId(applicationId, docType);
          await this.databaseService.query(
            `INSERT INTO resubmission_requests (application_id, document_id, reason, resolved, requested_at)
             VALUES ($1, $2, $3, false, now())`,
            [applicationId, documentId, `AI Verification Failed: ${cleanMessage}`]
          );
        }
      } catch (dbErr) {
        console.error("Failed to write resubmission reason:", dbErr);
      }

      await this.databaseService.query(`UPDATE applications SET current_status = 'Resubmission Required' WHERE application_id = $1`, [applicationId]);
      return { success: false, status: 'Resubmission Required', error: error.message };
    }
  }
}
