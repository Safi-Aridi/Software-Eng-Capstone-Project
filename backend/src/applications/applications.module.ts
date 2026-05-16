import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PassportsModule } from '../passports/passports.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    NotificationsModule,
    PassportsModule,
    StorageModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
