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
    const applications = await this.findAll();

    const application = applications.find(
      (app) =>
        String(app.id) === id ||
        String(app.application_id) === id ||
        String(app.app_id) === id,
    );

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return application;
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

  signApplication(id: string, body: any) {
    return {
      success: true,
      message: 'Application signing endpoint reserved and working',
      applicationId: id,
      signedBy: body.mukhtarId || 'demo-mukhtar-id',
      nextStatus: 'Mukhtar Signed',
    };
  }

  approveApplication(id: string, body: any) {
    return {
      success: true,
      message: 'Application approval endpoint reserved and working',
      applicationId: id,
      approvedBy: body.officerId || 'demo-officer-id',
      nextStatus: 'Processed for Issuance',
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