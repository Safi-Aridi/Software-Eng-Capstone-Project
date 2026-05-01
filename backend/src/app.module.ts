import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ApplicationsModule } from './applications/applications.module';
import { MukhtarModule } from './mukhtar/mukhtar.module';
import { OfficerModule } from './officer/officer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    ApplicationsModule,
    MukhtarModule,
    OfficerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}