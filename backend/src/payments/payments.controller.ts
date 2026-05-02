import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  initiate(@Body() body: any) {
    return this.paymentsService.initiate(body);
  }

  @Post('callback')
  callback(@Body() body: any) {
    return this.paymentsService.callback(body);
  }

  @Get(':applicationId/status')
  getStatus(@Param('applicationId') applicationId: string) {
    return this.paymentsService.getStatus(applicationId);
  }
}