import { Injectable } from '@nestjs/common';

@Injectable()
export class KycService {
  submit(body: any) {
    return {
      success: true,
      message: 'KYC submit endpoint reserved and working',
      receivedData: body,
      status: 'Pending',
    };
  }

  getStatus(userId: string) {
    return {
      success: true,
      message: 'KYC status endpoint reserved and working',
      userId,
      status: 'Pending',
    };
  }

  resubmit(applicationId: string, body: any) {
    return {
      success: true,
      message: 'KYC resubmit endpoint reserved and working',
      applicationId,
      receivedData: body,
      status: 'Resubmission Received',
    };
  }
}