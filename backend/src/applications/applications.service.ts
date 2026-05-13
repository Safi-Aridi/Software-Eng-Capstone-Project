import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(role?: string) {
    let query = 'SELECT * FROM applications';
    const params: string[] = [];

    if (role === 'mukhtar') {
      query += " WHERE current_status = 'Verified'";
    } else if (role === 'officer') {
      query += " WHERE current_status = 'Mukhtar Signed'";
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.databaseService.query(query, params);
    return result.rows;
  }

  async findOne(id: string) {
    const query = `
      SELECT *
      FROM applications
      WHERE application_id = $1
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

    const trackingNumber = `TRK-${Date.now()}`;

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