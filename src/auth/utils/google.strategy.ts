import { Inject, Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import googleOauthConfig from '../config/google-oauth.config';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(GoogleStrategy.name);

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

    this.logger.log('[GOOGLE STRATEGY] Initializing Google OAuth strategy');
    this.logger.debug(
      `[GOOGLE STRATEGY] Client ID: ${googleConfiguration.clientId}`,
    );
    this.logger.debug(
      `[GOOGLE STRATEGY] Callback URL: ${googleConfiguration.callbackUrl}`,
    );

    // Warn if using localhost (won't work on mobile devices)
    if (googleConfiguration.callbackUrl?.includes('localhost')) {
      this.logger.warn(
        '[GOOGLE STRATEGY] ⚠️  WARNING: Callback URL uses "localhost" - this will NOT work on mobile devices!',
      );
      this.logger.warn(
        "[GOOGLE STRATEGY] For mobile testing, use your computer's IP address instead (e.g., http://192.168.1.105:3000/api/auth/google/callback)",
      );
      this.logger.warn(
        '[GOOGLE STRATEGY] See MOBILE_OAUTH_FIX.md for instructions',
      );
    }

    this.logger.log(
      '[GOOGLE STRATEGY] Google OAuth strategy initialized successfully',
    );
  }

  async validate(
    req: Express.Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    this.logger.log(
      '[GOOGLE STRATEGY] validate() called - Google OAuth callback received',
    );
    this.logger.debug(`[GOOGLE STRATEGY] Profile ID: ${profile.id}`);
    this.logger.debug(
      `[GOOGLE STRATEGY] Profile email: ${profile.emails?.[0]?.value}`,
    );
    this.logger.debug(
      `[GOOGLE STRATEGY] Profile name: ${profile.name?.givenName} ${profile.name?.familyName}`,
    );
    this.logger.debug(
      `[GOOGLE STRATEGY] Email verified: ${profile.emails?.[0]?.verified}`,
    );

    // Access Express request properties safely
    const expressReq = req as any;
    if (expressReq.url) {
      this.logger.debug(`[GOOGLE STRATEGY] Request URL: ${expressReq.url}`);
    }
    if (expressReq.query) {
      this.logger.debug(
        `[GOOGLE STRATEGY] Request query: ${JSON.stringify(expressReq.query)}`,
      );
    }

    const user = await this.authService.validateGoogleUser({
      email: profile.emails?.[0]?.value ?? '',
      first_name: profile.name?.givenName ?? '',
      last_name: profile.name?.familyName ?? '',
      is_verified: profile.emails?.[0]?.verified ?? false,
      password: '',
    });

    this.logger.log(
      `[GOOGLE STRATEGY] User validated/created: ${user.email} (ID: ${user.id})`,
    );
    done(null, user);
  }
}
