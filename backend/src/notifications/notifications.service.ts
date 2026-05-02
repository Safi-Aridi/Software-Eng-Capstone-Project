import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  findAll() {
    return {
      success: true,
      message: 'Notifications endpoint reserved and working',
      notifications: [
        {
          id: 'demo-notification-1',
          title: 'Application Status Update',
          message: 'Your passport application is currently pending review.',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  }

  create(body: any) {
    return {
      success: true,
      message: 'Notification creation endpoint reserved and working',
      receivedData: body,
    };
  }

  markAsRead(id: string) {
    return {
      success: true,
      message: 'Notification marked as read endpoint reserved and working',
      notificationId: id,
      read: true,
    };
  }
}