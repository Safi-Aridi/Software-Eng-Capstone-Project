import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('biometrics/upload-url')
  @UseGuards(JwtAuthGuard)
  async getBiometricsUploadUrl(
    @Body() body: { applicationId: string; fileName: string },
  ): Promise<{ signedUrl: string; path: string }> {
    const { signedUrl, path } =
      await this.storageService.generateBiometricsSignedUploadUrl(
        body.applicationId,
        body.fileName,
      );
    return { signedUrl, path };
  }
}
