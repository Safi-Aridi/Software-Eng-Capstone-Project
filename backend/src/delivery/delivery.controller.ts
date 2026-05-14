import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('manifest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('officer')
  createManifest(@Body() body: any) {
    return this.deliveryService.createManifest(body);
  }

  // Called by LibanPost — external service has no JWT, so this route is
  // intentionally left unguarded. Authenticity must be enforced via signed
  // webhook verification inside the service.
  @Post('callback')
  callback(@Body() body: any) {
    return this.deliveryService.callback(body);
  }

  @Get(':applicationId/status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Param('applicationId') applicationId: string) {
    return this.deliveryService.getStatus(applicationId);
  }
}
