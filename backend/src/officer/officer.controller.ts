import { Controller, Get } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';

@Controller('officer')
export class OfficerController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('pending')
  async getPendingApplications() {
    return this.applicationsService.findAll('officer');
  }
}