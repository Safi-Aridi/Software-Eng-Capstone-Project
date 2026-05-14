import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../applications/applications.service';
import { DocumentsService } from './documents.service';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @UploadedFile() file: UploadFile,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.documentsService.uploadDocument(
      file,
      body,
      req.user as AuthUser,
    );
  }
}
