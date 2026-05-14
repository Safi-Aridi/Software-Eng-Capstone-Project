import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    userId: string,
    applicationId: string | null,
    message: string,
  ) {
    const result = await this.db.query(
      `INSERT INTO notifications (user_id, application_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, applicationId, message],
    );
    return result.rows[0];
  }

  async getByUser(userId: string) {
    const result = await this.db.query(
      `SELECT *
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async markAsRead(notificationId: string) {
    const result = await this.db.query(
      `UPDATE notifications
       SET is_read = true
       WHERE notification_id = $1
       RETURNING *`,
      [notificationId],
    );
    return result.rows[0] ?? null;
  }

  async markAllAsRead(userId: string) {
    await this.db.query(
      `UPDATE notifications
       SET is_read = true
       WHERE user_id = $1`,
      [userId],
    );
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND is_read = false`,
      [userId],
    );
    return { count: result.rows[0]?.count ?? 0 };
  }
}
