import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApplicationsService, type AuthUser } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('role') role: string | undefined, @Req() req: any) {
    return this.applicationsService.findAll(role, req.user as AuthUser);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.applicationsService.findOne(id, req.user as AuthUser);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Param('id') id: string, @Req() req: any) {
    return this.applicationsService.getStatus(id, req.user as AuthUser);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any, @Req() req: any) {
    return this.applicationsService.create(body, req.user as AuthUser);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('citizen', 'mukhtar', 'officer')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.applicationsService.update(id, body, req.user as AuthUser);
  }

  @Post(':id/sign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('mukhtar')
  signApplication(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.applicationsService.signApplication(id, {
      ...body,
      mukhtarId: (req.user as AuthUser).id,
    });
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  approveApplication(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.applicationsService.approveApplication(id, {
      ...body,
      officerId: (req.user as AuthUser).id,
    });
  }

  @Post(':id/resubmit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('citizen')
  resubmitDocuments(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.applicationsService.resubmitDocuments(
      id,
      { ...body, citizenId: (req.user as AuthUser).id },
      req.user as AuthUser,
    );
  }

  @Post(':id/cancel-old-passport')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  cancelOldPassport(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.cancelOldPassport(id, body);
  }

  @Patch(':id/biometric-frames')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('citizen')
  updateBiometricFrames(
    @Param('id') id: string,
    @Body() body: { frameUrls: string[] },
  ) {
    return this.applicationsService.updateBiometricFrameUrls(
      id,
      body.frameUrls,
    );
  }

  @Post(':id/issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  issueApplication(
    @Param('id') id: string,
    @Body() body: { officerId: string; bookletNumber: string },
    @Req() req: any,
  ) {
    return this.applicationsService.issueApplication(
      id,
      (req.user as AuthUser).id,
      body.bookletNumber,
    );
  }
}
