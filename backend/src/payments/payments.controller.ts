import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('citizen')
  initiate(@Body() body: any) {
    return this.paymentsService.initiate(body);
  }

  // Called by CashPlus — external service has no JWT, so this route is
  // intentionally left unguarded. Authenticity must be enforced via signed
  // webhook verification inside the service.
  @Post('callback')
  callback(@Body() body: any) {
    return this.paymentsService.callback(body);
  }

  @Get(':applicationId/status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Param('applicationId') applicationId: string) {
    return this.paymentsService.getStatus(applicationId);
  }
}
