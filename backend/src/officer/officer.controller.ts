import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApplicationsService,
  type AuthUser,
} from '../applications/applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('officer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OfficerController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('pending')
  @Roles('officer')
  async getPendingApplications(@Req() req: any) {
    return this.applicationsService.findAll('officer', req.user as AuthUser);
  }
}
