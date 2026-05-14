import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('role') role?: string) {
    return this.applicationsService.findAll(role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Param('id') id: string) {
    return this.applicationsService.getStatus(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any) {
    return this.applicationsService.create(body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('citizen', 'mukhtar', 'officer')
  update(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.update(id, body);
  }

  @Post(':id/sign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('mukhtar')
  signApplication(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.signApplication(id, body);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  approveApplication(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.approveApplication(id, body);
  }

  @Post(':id/resubmit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('citizen')
  resubmitDocuments(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.resubmitDocuments(id, body);
  }

  @Post(':id/cancel-old-passport')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  cancelOldPassport(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.cancelOldPassport(id, body);
  }

  @Post(':id/issue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  issueApplication(
    @Param('id') id: string,
    @Body() body: { officerId: string; bookletNumber: string },
  ) {
    return this.applicationsService.issueApplication(
      id,
      body.officerId,
      body.bookletNumber,
    );
  }
}
