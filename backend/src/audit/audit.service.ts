import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  findAll() {
    return {
      success: true,
      message: 'Audit logs endpoint reserved and working',
      logs: [
        {
          id: 'demo-audit-log-1',
          applicationId: 'demo-application-id',
          actorId: 'demo-user-id',
          actorRole: 'system',
          action: 'APPLICATION_STATUS_CHECKED',
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  create(body: any) {
    return {
      success: true,
      message: 'Audit log creation endpoint reserved and working',
      receivedData: body,
    };
  }

  findByApplication(applicationId: string) {
    return {
      success: true,
      message: 'Application audit logs endpoint reserved and working',
      applicationId,
      logs: [
        {
          id: 'demo-audit-log-1',
          applicationId,
          actorId: 'demo-user-id',
          actorRole: 'system',
          action: 'APPLICATION_VIEWED',
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }
}