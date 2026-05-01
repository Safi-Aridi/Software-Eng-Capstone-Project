import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';

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
}