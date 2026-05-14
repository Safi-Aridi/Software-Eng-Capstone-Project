import { Module } from '@nestjs/common';
import { PassportsService } from './passports.service';
import { PassportsController } from './passports.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [PassportsService],
  controllers: [PassportsController],
  exports: [PassportsService],
})
export class PassportsModule {}
