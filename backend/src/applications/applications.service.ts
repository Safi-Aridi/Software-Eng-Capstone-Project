import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ApplicationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(role?: string) {
    let query = 'SELECT * FROM applications';
    const params: string[] = [];

    if (role === 'mukhtar') {
  query += " WHERE current_status = 'Verified'";
    } else if (role === 'officer') {
  query += " WHERE current_status = 'Mukhtar Signed'";
    }
    query += ' ORDER BY created_at DESC';

    const result = await this.databaseService.query(query, params);
    return result.rows;
  }
}