import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentsService {
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

  callback(body: any) {
    return {
      success: true,
      message: 'Payment callback endpoint reserved and working',
      applicationId: body.applicationId,
      transactionId: body.transactionId || 'demo-transaction-id',
      paymentStatus: body.status || 'Paid',
    };
  }

  getStatus(applicationId: string) {
    return {
      success: true,
      message: 'Payment status endpoint reserved and working',
      applicationId,
      paymentStatus: 'Pending',
    };
  }
}