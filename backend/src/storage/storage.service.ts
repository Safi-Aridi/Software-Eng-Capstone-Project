import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly biometricsBucket: string;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const serviceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!url || !serviceKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env',
      );
    }
    this.biometricsBucket =
      this.configService.get<string>('SUPABASE_BIOMETRICS_BUCKET') ??
      'biometrics';
    this.supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async generateBiometricsSignedUploadUrl(
    applicationId: string,
    fileName: string,
  ): Promise<{ signedUrl: string; path: string; token: string }> {
    const path = `${applicationId}/${fileName}`;
    const { data, error } = await this.supabase.storage
      .from(this.biometricsBucket)
      .createSignedUploadUrl(path, { upsert: true });
    if (error || !data) {
      this.logger.error(
        `createSignedUploadUrl failed for ${path}: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to create signed upload URL: ${error?.message ?? 'unknown'}`,
      );
    }
    return { signedUrl: data.signedUrl, path: data.path, token: data.token };
  }

  async createBiometricsSignedDownloadUrl(
    path: string,
    expiresInSeconds = 600,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.biometricsBucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      this.logger.error(
        `createSignedUrl failed for ${path}: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to create signed download URL: ${error?.message ?? 'unknown'}`,
      );
    }
    return data.signedUrl;
  }
}
