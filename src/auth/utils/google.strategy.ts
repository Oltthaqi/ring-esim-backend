import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleOauthConfig from '../config/google-oauth.config';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private googleConfiguration: ConfigType<typeof googleOauthConfig>,
    private authService: AuthService,
  ) {
    if (
      !googleConfiguration.clientId ||
      !googleConfiguration.clientSecret ||
      !googleConfiguration.callbackUrl
    ) {
      throw new Error('Google OAuth configuration is missing required values.');
    }
    super({
      clientID: googleConfiguration.clientId,
      clientSecret: googleConfiguration.clientSecret,
      callbackURL: googleConfiguration.callbackUrl,
      scope: ['profile', 'email'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: Express.Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const user = await this.authService.validateGoogleUser({
      email: profile.emails?.[0]?.value ?? '',
      first_name: profile.name?.givenName ?? '',
      last_name: profile.name?.familyName ?? '',
      is_verified: profile.emails?.[0]?.verified ?? false,
      password: '',
    });
    done(null, user);
  }
}
