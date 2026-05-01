import { Controller, Get, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  async findAll(@Query('role') role?: string) {
    return this.applicationsService.findAll(role);
  }
}