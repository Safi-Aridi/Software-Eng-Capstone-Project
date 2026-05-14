import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApplicationsService,
  type AuthUser,
} from '../applications/applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('mukhtar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MukhtarController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get('pending')
  @Roles('mukhtar')
  async getPendingApplications(@Req() req: any) {
    return this.applicationsService.findAll('mukhtar', req.user as AuthUser);
  }

  @Post('applications/:id/reject')
  @Roles('mukhtar')
  async requestResubmission(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.applicationsService.requestResubmission(id, {
      ...body,
      mukhtarId: (req.user as AuthUser).id,
    });
  }
}
