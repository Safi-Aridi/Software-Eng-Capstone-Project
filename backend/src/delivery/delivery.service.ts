import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DeliveryService {
  constructor(private readonly databaseService: DatabaseService) {}

  createManifest(body: any) {
    return {
      success: true,
      message: 'Delivery manifest endpoint reserved and working',
      applicationId: body.applicationId,
      provider: 'LibanPost',
      deliveryStatus: 'Manifest Sent',
      requiresOldPassportCollection: true,
    };
  }

  async callback(body: any) {
    const applicationId = body.applicationId;

    const deliveryStatus =
      body.oldPassportCollected === false
        ? 'Delivery Failed - Branch Collection Required'
        : body.status || 'Delivered';

    const completedAt = deliveryStatus === 'Delivered' ? new Date() : null;

    const query = `
      UPDATE applications
      SET current_status = $1,
          completed_at = $2
      WHERE application_id = $3
      RETURNING *
    `;

    const result = await this.databaseService.query(query, [
      deliveryStatus,
      completedAt,
      applicationId,
    ]);

    if (result.rowCount === 0) {
      throw new NotFoundException(
        `Application with ID ${applicationId} not found`,
      );
    }

    return {
      success: true,
      message: 'Delivery callback processed successfully',
      applicationId,
      trackingNumber: body.trackingNumber || 'DEMO-TRACKING-001',
      deliveryStatus,
      oldPassportCollected: body.oldPassportCollected ?? true,
      application: result.rows[0],
    };
  }

  async getStatus(applicationId: string) {
    const query = `
      SELECT application_id, current_status, completed_at
      FROM applications
      WHERE application_id = $1
      LIMIT 1
    `;

    const result = await this.databaseService.query(query, [applicationId]);

    if (result.rowCount === 0) {
      throw new NotFoundException(
        `Application with ID ${applicationId} not found`,
      );
    }

    return {
      success: true,
      message: 'Delivery status retrieved successfully',
      applicationId,
      provider: 'LibanPost',
      deliveryStatus: result.rows[0].current_status,
      completedAt: result.rows[0].completed_at,
    };
  }
}