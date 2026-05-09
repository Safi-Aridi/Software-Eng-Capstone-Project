import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post('manifest')
  createManifest(@Body() body: any) {
    return this.deliveryService.createManifest(body);
  }

  @Post('callback')
  callback(@Body() body: any) {
    return this.deliveryService.callback(body);
  }

  @Get(':applicationId/status')
  getStatus(@Param('applicationId') applicationId: string) {
    return this.deliveryService.getStatus(applicationId);
  }
}