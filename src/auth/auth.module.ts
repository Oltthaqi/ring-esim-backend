import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersEntity } from 'src/users/entitites/users.entity';
import { VerificationEntity } from 'src/users/entitites/verification.entity';
import { UsersService } from 'src/users/users.service';
import { JwtStrategy } from './utils/jwt.stategy';
import { JwtService } from '@nestjs/jwt';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    HttpModule.register({
      maxRedirects: 5,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([UsersEntity, VerificationEntity]),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, JwtStrategy, JwtService],
  exports: [],
})
export class AuthModule {}
