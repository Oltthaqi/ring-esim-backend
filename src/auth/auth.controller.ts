import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  Request,
  Res,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { VerifyUserDto } from './dto/verify-user.dto';
import LoginUserDto from './dto/login-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { UsersService } from 'src/users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersEntity } from 'src/users/entitites/users.entity';
import { JwtRolesGuard } from './utils/jwt‑roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/users/enums/role.enum';
import { GoogleAuthGuard } from './utils/google-auth.guard';
import TokenDto from './dto/token.dto';
import { AppleSignInDto } from './dto/apple-sign-in.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('sign-up')
  async signUp(@Body() userDto: CreateUserDto): Promise<UsersEntity> {
    return await this.authService.signUp(userDto);
  }

  @Patch('verify/:user_id')
  async verifyUser(
    @Param('user_id') user_id: string,
    @Body() verifyUserDto: VerifyUserDto,
  ): Promise<boolean> {
    return await this.authService.verifyUser(user_id, verifyUserDto);
  }

  @Post('resend-code')
  async resendUserCode(@Body() resendCodeDto: ResendCodeDto): Promise<string> {
    return await this.authService.resendUserCode(resendCodeDto);
  }

  @Post('login')
  async login(@Body() userDto: LoginUserDto): Promise<object> {
    return await this.authService.login(userDto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() data: ForgotPasswordDto): Promise<object> {
    return await this.authService.forgotPassword(data);
  }

  @Post('reset-password/:user_id')
  async resetPassword(
    @Param('user_id') user_id: string,
    @Body() data: ResetPasswordDto,
  ): Promise<boolean> {
    return await this.authService.resetPassword(user_id, data);
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Post('change-password/:user_id')
  async changePassword(
    @Param('user_id') user_id: string,
    @Body() data: ChangePasswordDto,
  ): Promise<boolean> {
    return await this.authService.changePassword(user_id, data);
  }

  @Post('refresh-token')
  async refreshToken(@Body() data: RefreshTokenDto): Promise<object> {
    const { refreshToken } = data;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const payload = await this.authService.verifyRefreshToken(refreshToken);

    if (typeof payload !== 'object' || !('sub' in payload)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.getUserById(payload.sub as string);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.authService.getSessionTokens(user);
  }

  @Get('google/login')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth consent screen',
  })
  async googleLogin(@Query('mobile') mobile?: string): Promise<void> {
    this.logger.log(`[GOOGLE LOGIN] Initiated - mobile=${mobile}`);
    // This endpoint initiates the Google OAuth flow
    // Users are redirected to Google's consent screen
    // If mobile=true is passed, the callback will redirect to mobile app
    // The mobile parameter is passed through Google's state parameter
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback endpoint' })
  @ApiResponse({
    status: 200,
    description:
      'Returns access token and refresh token (web) or redirects to mobile app',
  })
  async googleLoginCallback(
    @Request() req: any,
    @Res() res: Response,
    @Query('state') state?: string,
    @Query('format') format?: string,
  ): Promise<void | object> {
    this.logger.log('[GOOGLE CALLBACK] Callback endpoint hit');
    this.logger.debug(
      `[GOOGLE CALLBACK] Query params: state=${state}, format=${format}`,
    );
    this.logger.debug(
      `[GOOGLE CALLBACK] Full query: ${JSON.stringify(req.query)}`,
    );

    const user = req.user as UsersEntity;
    if (!user) {
      this.logger.error('[GOOGLE CALLBACK] No user found in request');
      throw new UnauthorizedException('User not found in request');
    }

    this.logger.log(
      `[GOOGLE CALLBACK] User found: ${user.email} (ID: ${user.id})`,
    );

    const tokens = await this.authService.loginGoogle(user);
    this.logger.log('[GOOGLE CALLBACK] Tokens generated successfully');

    // Get mobile redirect URL from config
    const mobileRedirectUrl = this.configService.get<string>(
      'GOOGLE_MOBILE_REDIRECT_URL',
    );
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    this.logger.debug(`[GOOGLE CALLBACK] Config - callbackUrl: ${callbackUrl}`);
    this.logger.debug(
      `[GOOGLE CALLBACK] Config - mobileRedirectUrl: ${mobileRedirectUrl || 'NOT SET'}`,
    );

    // Force JSON format if requested (for web API calls)
    if (format === 'json') {
      this.logger.log(
        '[GOOGLE CALLBACK] Format=json requested, returning JSON',
      );
      return res.json(tokens);
    }

    // Check if this is a mobile request
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers.referer || '';
    const origin = req.headers.origin || '';

    this.logger.debug(`[GOOGLE CALLBACK] Request headers:`);
    this.logger.debug(`  - User-Agent: ${userAgent}`);
    this.logger.debug(`  - Referer: ${referer}`);
    this.logger.debug(`  - Origin: ${origin}`);

    // Mobile detection checks
    const stateCheck = state === 'mobile';
    const queryMobileCheck = req.query?.mobile === 'true';
    const userAgentExpoCheck = userAgent.includes('Expo');
    const userAgentMobileCheck = userAgent.includes('Mobile');
    const userAgentReactNativeCheck = userAgent.includes('ReactNative');
    const refererExpCheck = referer.includes('exp://');
    const refererAppCheck =
      referer.includes('internetkudo://') || referer.includes('yourapp://');

    this.logger.debug(`[GOOGLE CALLBACK] Mobile detection checks:`);
    this.logger.debug(`  - state === 'mobile': ${stateCheck}`);
    this.logger.debug(`  - query.mobile === 'true': ${queryMobileCheck}`);
    this.logger.debug(`  - User-Agent includes 'Expo': ${userAgentExpoCheck}`);
    this.logger.debug(
      `  - User-Agent includes 'Mobile': ${userAgentMobileCheck}`,
    );
    this.logger.debug(
      `  - User-Agent includes 'ReactNative': ${userAgentReactNativeCheck}`,
    );
    this.logger.debug(`  - Referer includes 'exp://': ${refererExpCheck}`);
    this.logger.debug(`  - Referer includes app scheme: ${refererAppCheck}`);

    const isMobileRequest =
      stateCheck ||
      queryMobileCheck ||
      userAgentExpoCheck ||
      userAgentMobileCheck ||
      userAgentReactNativeCheck ||
      refererExpCheck ||
      refererAppCheck;

    this.logger.log(
      `[GOOGLE CALLBACK] Mobile request detected: ${isMobileRequest}`,
    );

    // If mobile redirect URL is configured and this is a mobile request, redirect to app
    if (mobileRedirectUrl && isMobileRequest) {
      this.logger.log(
        `[GOOGLE CALLBACK] Redirecting to mobile app: ${mobileRedirectUrl}`,
      );

      // Construct deep link URL manually (URL constructor doesn't work with custom schemes like internetkudo://)
      // Deep links use format: scheme://path?param1=value1&param2=value2
      let finalRedirectUrl: string;

      try {
        // Try to use URL constructor for standard URLs (http/https)
        const url = new URL(mobileRedirectUrl);
        url.searchParams.set('accessToken', tokens.accessToken);
        url.searchParams.set('success', 'true');
        finalRedirectUrl = url.toString();
      } catch {
        // If URL constructor fails, it's likely a deep link (custom scheme)
        // Manually construct the URL with query parameters
        const separator = mobileRedirectUrl.includes('?') ? '&' : '?';
        finalRedirectUrl = `${mobileRedirectUrl}${separator}accessToken=${encodeURIComponent(tokens.accessToken)}&success=true`;
      }

      this.logger.debug(
        `[GOOGLE CALLBACK] Final redirect URL (without tokens in log for security)`,
      );
      this.logger.log(
        `[GOOGLE CALLBACK] Redirecting to mobile app with tokens in URL params`,
      );

      return res.redirect(finalRedirectUrl);
    }

    // Default: return JSON for web requests
    if (!mobileRedirectUrl) {
      this.logger.warn(
        '[GOOGLE CALLBACK] GOOGLE_MOBILE_REDIRECT_URL not configured, returning JSON',
      );
    } else if (!isMobileRequest) {
      this.logger.log('[GOOGLE CALLBACK] Not a mobile request, returning JSON');
    }

    return res.json(tokens);
  }

  @Post('apple/login')
  @ApiOperation({ summary: 'Apple Sign In - Verify identity token' })
  @ApiResponse({
    status: 200,
    description:
      'Returns access token and refresh token after verifying Apple identity token',
    type: TokenDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid Apple identity token',
  })
  async appleLogin(@Body() appleSignInDto: AppleSignInDto): Promise<TokenDto> {
    this.logger.log('[APPLE LOGIN] Apple sign in request received');

    if (!appleSignInDto.identityToken) {
      this.logger.error('[APPLE LOGIN] Identity token is missing');
      throw new BadRequestException('Identity token is required');
    }

    try {
      const tokens = await this.authService.loginApple(
        appleSignInDto.identityToken,
      );
      this.logger.log('[APPLE LOGIN] Apple sign in successful');
      return tokens;
    } catch (error) {
      this.logger.error(`[APPLE LOGIN] Error: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtRolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.USER)
  @Post('logout')
  async logout(@Request() req: any): Promise<{ message: string }> {
    // The JWT is stateless, so we just return a success message
    // The client should delete the token from their storage
    // If you're using refresh tokens, you would invalidate them here
    const userId = req.user?.uuid || req.user?.id;

    return {
      message:
        'Logged out successfully. Please delete your tokens from client storage.',
    };
  }
}
