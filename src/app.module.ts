import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OcsModule } from './ocs/ocs.module';
import { EsimsModule } from './esims/esims.module';
import { LocationZoneModule } from './location-zone/location-zone.module';
import { PackageTemplateModule } from './package-template/package-template.module';
import { DestinationsModule } from './destinations/destinations.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { UsageModule } from './usage/usage.module';
import { ProfileModule } from './profile/profile.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DATABASE_HOST'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        port: configService.get('DATABASE_PORT'),
        migrations: ['dist/migrations/*{.ts,.js}'],
        migrationsRun: true,
        entities: [],
        autoLoadEntities: true,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    EmailModule,
    NotificationsModule,
    OcsModule,
    EsimsModule,
    LocationZoneModule,
    PackageTemplateModule,
    DestinationsModule,
    OrdersModule,
    PaymentsModule,
    UsageModule,
    ProfileModule,
    PromoCodesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
