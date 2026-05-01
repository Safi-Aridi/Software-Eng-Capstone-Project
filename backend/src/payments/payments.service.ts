import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  initiate(body: any) {
    return {
      success: true,
      message: 'Payment initiation endpoint reserved and working',
      applicationId: body.applicationId,
      amount: body.amount || 0,
      provider: 'CashPlus',
      paymentStatus: 'Pending',
      paymentReference: 'demo-payment-reference',
    };
  }

  async callback(body: any) {
    const applicationId = body.applicationId;
    const paymentStatus = body.status || 'Paid';

    const query = `
      UPDATE applications
      SET payment_status = $1
      WHERE application_id = $2
      RETURNING *
    `;

    const result = await this.databaseService.query(query, [
      paymentStatus,
      applicationId,
    ]);

    if (result.rowCount === 0) {
      throw new NotFoundException(
        `Application with ID ${applicationId} not found`,
      );
    }

    return {
      success: true,
      message: 'Payment callback processed successfully',
      applicationId,
      transactionId: body.transactionId || 'demo-transaction-id',
      paymentStatus,
      application: result.rows[0],
    };
  }

  async getStatus(applicationId: string) {
    const query = `
      SELECT application_id, payment_status
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
      message: 'Payment status retrieved successfully',
      applicationId,
      paymentStatus: result.rows[0].payment_status,
    };
  }
}