import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface MukhtarOption {
  mukhtarId: string;
  userId: string;
  district: string;
  village: string | null;
  fullName: string;
}

@Injectable()
export class MukhtarService {
  constructor(private readonly databaseService: DatabaseService) {}

  // P4-A: Sorted, deduplicated districts that have at least one active mukhtar.
  async listDistricts(): Promise<{ districts: string[] }> {
    const result = await this.databaseService.query(
      `SELECT DISTINCT district
       FROM mukhtar_profiles
       WHERE is_active = true
         AND district IS NOT NULL
       ORDER BY district ASC`,
    );
    const districts = result.rows
      .map((r: any) => r.district as string)
      .filter((d): d is string => typeof d === 'string' && d.length > 0);
    return { districts };
  }

  // P4-A: Active mukhtars in a given district (case-insensitive match).
  async listByDistrict(district: string): Promise<MukhtarOption[]> {
    if (!district || !district.trim()) return [];
    const result = await this.databaseService.query(
      `SELECT
         mp.mukhtar_id,
         mp.user_id,
         mp.district,
         mp.village,
         u.first_name,
         u.last_name
       FROM mukhtar_profiles mp
       JOIN users u ON u.user_id = mp.user_id
       WHERE mp.district ILIKE $1
         AND mp.is_active = true`,
      [district],
    );
    return result.rows.map((r: any) => ({
      mukhtarId: r.mukhtar_id,
      userId: r.user_id,
      district: r.district,
      village: r.village ?? null,
      fullName: [r.first_name, r.last_name].filter(Boolean).join(' '),
    }));
  }
}
