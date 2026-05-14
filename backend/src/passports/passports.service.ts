import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

interface CreatePassportInput {
  userId: string;
  sourceApplicationId: string;
  bookletNumber: string;
  validityYears: number;
}

@Injectable()
export class PassportsService {
  constructor(private readonly db: DatabaseService) {}

  async createPassport(data: CreatePassportInput) {
    const years = Math.max(1, Math.floor(data.validityYears));
    const result = await this.db.query(
      `INSERT INTO passports (
         user_id, source_application_id, booklet_number,
         status, issued_at, expires_at
       )
       VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW() + ($4 || ' years')::interval)
       RETURNING *`,
      [data.userId, data.sourceApplicationId, data.bookletNumber, years],
    );
    return result.rows[0];
  }

  async getPassportsByUser(userId: string) {
    const result = await this.db.query(
      `SELECT *
       FROM passports
       WHERE user_id = $1
       ORDER BY issued_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async cancelPassport(passportId: string, cancelledByApplicationId: string) {
    const result = await this.db.query(
      `UPDATE passports
       SET status = 'CANCELLED',
           cancelled_at = NOW(),
           cancelled_by_application_id = $2
       WHERE passport_id = $1
       RETURNING *`,
      [passportId, cancelledByApplicationId],
    );
    return result.rows[0] ?? null;
  }

  async getExpiringPassports(userId: string) {
    const result = await this.db.query(
      `SELECT *
       FROM passports
       WHERE user_id = $1
         AND status = 'ACTIVE'
         AND expires_at <= NOW() + INTERVAL '6 months'
       ORDER BY expires_at ASC`,
      [userId],
    );
    return result.rows;
  }
}
