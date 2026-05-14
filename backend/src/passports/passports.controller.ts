import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PassportsService } from './passports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('passports')
@UseGuards(JwtAuthGuard)
export class PassportsController {
  constructor(private readonly passportsService: PassportsService) {}

  @Post()
  create(
    @Body()
    body: {
      userId: string;
      sourceApplicationId: string;
      bookletNumber: string;
      validityYears: number;
    },
  ) {
    return this.passportsService.createPassport(body);
  }

  @Get()
  getByUser(@Query('userId') userId: string) {
    return this.passportsService.getPassportsByUser(userId);
  }

  @Get('expiring')
  getExpiring(@Query('userId') userId: string) {
    return this.passportsService.getExpiringPassports(userId);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { cancelledByApplicationId: string },
  ) {
    return this.passportsService.cancelPassport(
      id,
      body.cancelledByApplicationId,
    );
  }
}
