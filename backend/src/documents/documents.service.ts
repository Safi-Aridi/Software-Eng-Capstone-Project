import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../applications/applications.service';
import { DatabaseService } from '../database/database.service';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type FrontendDocumentType =
  | 'identityDocument'
  | 'frontUrl'
  | 'backUrl'
  | 'civilRegistryExtract'
  | 'passportPhoto'
  | 'oldPassport';

const DOCUMENT_TYPE_TO_DB: Record<FrontendDocumentType, string> = {
  identityDocument: 'identity_document',
  frontUrl: 'national_id_front',
  backUrl: 'national_id_back',
  civilRegistryExtract: 'civil_registry_extract',
  passportPhoto: 'passport_photo',
  oldPassport: 'old_passport',
};

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const IMAGE_ONLY_DOCUMENT_TYPES = new Set([
  'national_id_front',
  'national_id_back',
  'passport_photo',
]);

@Injectable()
export class DocumentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeDocumentType(value: string): string {
    if (value in DOCUMENT_TYPE_TO_DB) {
      return DOCUMENT_TYPE_TO_DB[value as FrontendDocumentType];
    }

    if (
      value === 'identity_document' ||
      value === 'national_id_front' ||
      value === 'national_id_back' ||
      value === 'civil_registry_extract' ||
      value === 'passport_photo' ||
      value === 'old_passport'
    ) {
      return value;
    }

    throw new BadRequestException('Unsupported document type');
  }

  private getStorageConfig() {
    const supabaseUrl = this.configService
      .get<string>('SUPABASE_URL')
      ?.replace(/\/$/, '');
    const serviceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.configService.get<string>('SUPABASE_SERVICE_KEY');
    const bucket =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ??
      'documents';

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Supabase Storage is not configured',
      );
    }

    return { supabaseUrl, serviceRoleKey, bucket };
  }

  private sanitizeFileName(fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return safe.slice(Math.max(0, safe.length - 120)) || 'document';
  }

  private encodeStoragePath(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  private async upsertDocumentUrl(
    applicationId: string,
    documentType: string,
    fileUrl: string,
  ) {
    const updated = await this.databaseService.query(
      `UPDATE documents
       SET file_url = $3
       WHERE application_id = $1
         AND document_type = $2
       RETURNING *`,
      [applicationId, documentType, fileUrl],
    );

    if (updated.rowCount && updated.rows[0]) {
      return updated.rows[0];
    }

    const inserted = await this.databaseService.query(
      `INSERT INTO documents (application_id, document_type, file_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [applicationId, documentType, fileUrl],
    );

    return inserted.rows[0];
  }

  private async assertUploadAccess(
    applicationId: string,
    user?: AuthUser,
  ): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Authentication is required');
    }
    if (user.role === 'admin') return;
    if (user.role !== 'citizen') {
      throw new ForbiddenException('Only the applicant can upload documents');
    }

    const result = await this.databaseService.query(
      `SELECT 1
       FROM applications a
       JOIN citizen_profiles cp ON cp.citizen_id = a.citizen_id
       WHERE a.application_id = $1
         AND cp.user_id = $2`,
      [applicationId, user.id],
    );

    if (!result.rowCount) {
      throw new ForbiddenException('You do not have access to this application');
    }
  }

  async uploadDocument(
    file: UploadFile | undefined,
    body: any,
    user?: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('A document file is required');
    }

    const applicationId = String(body.applicationId ?? '').trim();
    const requestedDocumentType = String(body.documentType ?? '').trim();

    if (!applicationId) {
      throw new BadRequestException('applicationId is required');
    }
    if (!requestedDocumentType) {
      throw new BadRequestException('documentType is required');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported document file type');
    }

    await this.assertUploadAccess(applicationId, user);

    const documentType = this.normalizeDocumentType(requestedDocumentType);
    if (
      IMAGE_ONLY_DOCUMENT_TYPES.has(documentType) &&
      !file.mimetype.startsWith('image/')
    ) {
      throw new BadRequestException('This document type must be an image file');
    }

    const { supabaseUrl, serviceRoleKey, bucket } = this.getStorageConfig();
    const safeName = this.sanitizeFileName(file.originalname);
    const objectPath = [
      applicationId,
      documentType,
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`,
    ].join('/');
    const encodedPath = this.encodeStoragePath(objectPath);

    const uploadBody = new Uint8Array(file.buffer);
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': file.mimetype,
          'x-upsert': 'true',
        },
        body: uploadBody,
      },
    );

    if (!uploadResponse.ok) {
      const message = await uploadResponse.text().catch(() => '');
      throw new InternalServerErrorException(
        `Supabase Storage upload failed: ${message || uploadResponse.status}`,
      );
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
    const document = await this.upsertDocumentUrl(
      applicationId,
      documentType,
      fileUrl,
    );

    return {
      success: true,
      applicationId,
      documentType,
      fileUrl,
      storagePath: objectPath,
      document,
    };
  }
}
