import { Injectable } from '@nestjs/common';

@Injectable()
export class DeliveryService {
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

  callback(body: any) {
    return {
      success: true,
      message: 'Delivery callback endpoint reserved and working',
      applicationId: body.applicationId,
      trackingNumber: body.trackingNumber || 'DEMO-TRACKING-001',
      deliveryStatus: body.status || 'Delivered',
      oldPassportCollected: body.oldPassportCollected ?? true,
    };
  }

  getStatus(applicationId: string) {
    return {
      success: true,
      message: 'Delivery status endpoint reserved and working',
      applicationId,
      provider: 'LibanPost',
      deliveryStatus: 'Pending Dispatch',
    };
  }
}