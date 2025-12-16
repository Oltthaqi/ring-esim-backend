import { registerAs } from '@nestjs/config';

export default registerAs('appleOAuth', () => ({
  teamId: process.env.APPLE_TEAM_ID,
  clientId: process.env.APPLE_CLIENT_ID,
  keyId: process.env.APPLE_KEY_ID,
  privateKey: process.env.APPLE_PRIVATE_KEY, // .p8 file content
  callbackUrl: process.env.APPLE_CALLBACK_URL,
  mobileRedirectUrl:
    process.env.APPLE_MOBILE_REDIRECT_URL || 'ringesim://oauth/callback',
}));

