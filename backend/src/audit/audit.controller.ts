import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  findAll() {
    return this.auditService.findAll();
  }

  @Post('logs')
  create(@Body() body: any) {
    return this.auditService.create(body);
  }

  @Get('logs/:applicationId')
  findByApplication(@Param('applicationId') applicationId: string) {
    return this.auditService.findByApplication(applicationId);
  }
}