import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApplicationsService } from '../applications/applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('mukhtar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MukhtarController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('pending')
  @Roles('mukhtar')
  async getPendingApplications() {
    return this.applicationsService.findAll('mukhtar');
  }
}