import { registerAs } from '@nestjs/config';

export default registerAs('googleOAuth', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  mobileCallbackUrl:
    process.env.GOOGLE_MOBILE_CALLBACK_URL || process.env.GOOGLE_CALLBACK_URL, // For mobile testing with IP
  mobileRedirectUrl:
    process.env.GOOGLE_MOBILE_REDIRECT_URL || 'yourapp://oauth/callback',
}));
