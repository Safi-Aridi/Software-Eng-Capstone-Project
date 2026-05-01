import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  submit(@Body() body: any) {
    return this.kycService.submit(body);
  }

  @Get('status/:userId')
  getStatus(@Param('userId') userId: string) {
    return this.kycService.getStatus(userId);
  }

  @Put('resubmit/:applicationId')
  resubmit(@Param('applicationId') applicationId: string, @Body() body: any) {
    return this.kycService.resubmit(applicationId, body);
  }
}