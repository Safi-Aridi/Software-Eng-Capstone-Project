import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AuditService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createLog(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
  }) {
    const query = `
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await this.databaseService.query(query, [
      data.userId,
      data.action,
      data.entityType,
      data.entityId,
    ]);

    return result.rows[0];
  }

  async findAll() {
    const query = `
      SELECT *
      FROM audit_logs
      ORDER BY created_at DESC
    `;

    const result = await this.databaseService.query(query);

    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      logs: result.rows,
    };
  }

  async create(body: any) {
    const log = await this.createLog({
      userId: body.userId,
      action: body.action,
      entityType: body.entityType || 'application',
      entityId: body.entityId || body.applicationId,
    });

    return {
      success: true,
      message: 'Audit log created successfully',
      log,
    };
  }

  async findByApplication(applicationId: string) {
    const query = `
      SELECT *
      FROM audit_logs
      WHERE entity_type = $1
        AND entity_id = $2
      ORDER BY created_at DESC
    `;

    const result = await this.databaseService.query(query, [
      'application',
      applicationId,
    ]);

    return {
      success: true,
      message: 'Application audit logs retrieved successfully',
      applicationId,
      logs: result.rows,
    };
  }
}