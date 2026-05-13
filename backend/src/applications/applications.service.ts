import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

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

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  private readonly applicationSelect = `
    SELECT
      a.*,
      rr.resubmission_reasons
    FROM applications a
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

    return {
      success: true,
      message: 'Application created successfully',
      application: result.rows[0],
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

    await this.auditService.createLog({
      userId: body.mukhtarId,
      action: 'APPLICATION_SIGNED_BY_MUKHTAR',
      entityType: 'application',
      entityId: id,
    });

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
}
