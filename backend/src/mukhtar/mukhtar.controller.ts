import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApplicationsService,
  type AuthUser,
} from '../applications/applications.service';
import { MukhtarService } from './mukhtar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('mukhtar')
export class MukhtarController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly mukhtarService: MukhtarService,
  ) {}

  // P4-A: Public-to-citizens — any authenticated user can list districts and
  // mukhtars during application creation. Citizen role is checked elsewhere.
  @Get('districts')
  @UseGuards(JwtAuthGuard)
  async listDistricts() {
    return this.mukhtarService.listDistricts();
  }

  @Get('by-district')
  @UseGuards(JwtAuthGuard)
  async listByDistrict(@Query('district') district: string) {
    return this.mukhtarService.listByDistrict(district);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('mukhtar')
  async getPendingApplications(@Req() req: any) {
    // P4-D: filter by assigned_mukhtar_id = current mukhtar's user_id.
    return this.applicationsService.findMukhtarQueue(
      (req.user as AuthUser).id,
    );
  }

  @Post('applications/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
