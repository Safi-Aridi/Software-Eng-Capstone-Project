import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ApplicationsService {
  constructor(private readonly databaseService: DatabaseService) {}

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

  create(body: any) {
    return {
      success: true,
      message: 'Create application endpoint reserved and working',
      receivedData: body,
      status: 'Pending',
    };
  }

  update(id: string, body: any) {
    return {
      success: true,
      message: 'Update application endpoint reserved and working',
      applicationId: id,
      receivedData: body,
    };
  }

  async signApplication(id: string, body: any) {
    const query = `
      UPDATE applications
      SET current_status = $1
      WHERE application_id = $2
      RETURNING *
    `;

    const result = await this.databaseService.query(query, [
      'Mukhtar Signed',
      id,
    ]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Application signed successfully',
      applicationId: id,
      signedBy: body.mukhtarId || 'demo-mukhtar-id',
      application: result.rows[0],
    };
  }

  async approveApplication(id: string, body: any) {
    const query = `
      UPDATE applications
      SET current_status = $1
      WHERE application_id = $2
      RETURNING *
    `;

    const result = await this.databaseService.query(query, [
      'Processed for Issuance',
      id,
    ]);

    if (result.rowCount === 0) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Application approved successfully',
      applicationId: id,
      approvedBy: body.officerId || 'demo-officer-id',
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