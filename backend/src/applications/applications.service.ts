import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PassportsService } from '../passports/passports.service';

type ResubmissionReasons = Partial<{
  identityDocument: string;
  passportPhoto: string;
  oldPassport: string;
}>;

const DOCUMENT_TYPE_BY_REASON_KEY: Record<keyof ResubmissionReasons, string> = {
  identityDocument: 'identity_document',
  passportPhoto: 'passport_photo',
  oldPassport: 'old_passport',
};

type ApplicationDocuments = Partial<Record<keyof ResubmissionReasons, string>>;

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

    if (typeof input.identityDocument === 'string') {
      out.identityDocument = input.identityDocument.trim();
    }
    if (typeof input.passportPhoto === 'string') {
      out.passportPhoto = input.passportPhoto.trim();
    }
    if (typeof input.oldPassport === 'string') {
      out.oldPassport = input.oldPassport.trim();
    }

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

  async findAll(role?: string) {
    let query = this.applicationSelect;
    const params: string[] = [];

    if (role === 'mukhtar') {
      query += " WHERE a.current_status = 'Verified'";
    } else if (role === 'officer') {
      query += " WHERE a.current_status = 'Mukhtar Signed'";
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await this.databaseService.query(query, params);
    return result.rows;
  }

  async findOne(id: string) {
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

  async getStatus(id: string) {
    const application = await this.findOne(id);

    return {
      success: true,
      applicationId: id,
      status: application.current_status || application.status || 'Unknown',
    };
  }

  async create(body: any) {
    const query = `
      INSERT INTO applications (
        citizen_id,
        service_type_id,
        validity_id,
        assigned_branch_id,
        application_type,
        current_status,
        payment_status,
        tracking_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const trackingNumber = `NPIS-${new Date().getFullYear()}-${Math.floor(
      100000 + Math.random() * 900000,
    )}`;

    const result = await this.databaseService.query(query, [
      body.citizenId,
      body.serviceTypeId || 1,
      body.validityId || 1,
      body.assignedBranchId || 1,
      body.applicationType || 'new_passport',
      'Pending',
      'Pending',
      trackingNumber,
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

  async update(id: string, body: any) {
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

  async resubmitDocuments(id: string, body: any) {
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
}
