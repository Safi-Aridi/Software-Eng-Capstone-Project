import { Controller, Get } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';

@Controller('mukhtar')
export class MukhtarController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('pending')
  async getPendingApplications() {
    return this.applicationsService.findAll('mukhtar');
  }
}