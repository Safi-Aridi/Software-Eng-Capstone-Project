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
  async findAll(@Query('role') role?: string) {
    return this.applicationsService.findAll(role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.applicationsService.findOne(id);
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.applicationsService.getStatus(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.applicationsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.update(id, body);
  }

  @Post(':id/sign')
  signApplication(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.signApplication(id, body);
  }

  @Post(':id/approve')
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
  cancelOldPassport(@Param('id') id: string, @Body() body: any) {
    return this.applicationsService.cancelOldPassport(id, body);
  }
}
