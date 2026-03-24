import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { VerificationEntity } from 'src/users/entitites/verification.entity';
import { UsersModule } from 'src/users/users.module';
import { JwtStrategy } from './utils/jwt.stategy';
import { GoogleStrategy } from './utils/google.strategy';
import { JwtService } from '@nestjs/jwt';
import { EmailModule } from 'src/email/email.module';
import googleOauthConfig from './config/google-oauth.config';

@Module({
  imports: [
    HttpModule.register({
      maxRedirects: 5,
    }),
    PassportModule,
    ConfigModule.forFeature(googleOauthConfig),
    UsersModule,
    TypeOrmModule.forFeature([VerificationEntity]),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, JwtService],
  exports: [],
})
export class AuthModule {}
