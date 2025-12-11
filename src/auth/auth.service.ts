import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersEntity } from 'src/users/entitites/users.entity';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import randomInteger from 'random-int';
import { InjectRepository } from '@nestjs/typeorm';
import { VerificationEntity } from 'src/users/entitites/verification.entity';
import { Repository } from 'typeorm';
import { CreateVerificationDto } from 'src/users/dto/create-verification.dto';
import { VerifyUserDto } from './dto/verify-user.dto';
import LoginUserDto from './dto/login-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as AWS from 'aws-sdk';
import { ResendCodeDto } from './dto/resend-code.dto';
import * as moment from 'moment';
import TokenDto from './dto/token.dto';
import base64url from 'base64url';
import { UsersService } from 'src/users/users.service';
import { IToken } from 'src/common/interfaces/itoken.interface';
import * as jwt from 'jsonwebtoken';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { EmailService } from 'src/email/email.service';
import { CreateUserGoogleDto } from 'src/users/dto/create-user-google-oauth.dto';
import { CreateUserAppleDto } from 'src/users/dto/create-user-apple-oauth.dto';
import { Role } from 'src/users/enums/role.enum';
import { randomBytes } from 'crypto';
import appleSignin from 'apple-signin-auth';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly DEFAULT_ACCESS_TOKEN_EXPIRATION = 20 * 24 * 60 * 60; // 20 days in seconds (1,728,000)
  private readonly kms: AWS.KMS;

  constructor(
    private readonly userService: UsersService,
    private readonly configService: ConfigService,
    @InjectRepository(VerificationEntity)
    private readonly verificationRepository: Repository<VerificationEntity>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {
    AWS.config.update({
      accessKeyId: this.configService.get('KMS_AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('KMS_AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('KMS_AWS_REGION'),
    });

    this.kms = new AWS.KMS();
  }

  async signUp(userDto: CreateUserDto): Promise<UsersEntity> {
    const existingUser = await this.userService.getUserByEmail(userDto.email);

    if (existingUser) {
      throw new BadRequestException('User alredy exists');
    }

    if (userDto.password !== userDto.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const saltRounds = this.randomInteger(10, 14);

    const cryptedPassword = await bcrypt.hash(
      userDto.password,
      await bcrypt.genSalt(saltRounds),
    );

    const user = await this.userService.register(userDto, cryptedPassword);
    const verifyCode = randomInteger(100000, 999999).toString();
    // Send SMS
    // await this.snsService.sendSms(userDto.phone_number, verifyCode);
    // Save Twilio code
    await this.emailService.sendVerificationCodeEmail(
      userDto.email,
      verifyCode,
    );
    await this.addEmailCodeVerification(
      {
        email: userDto.phone_number,
        code: verifyCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
      user.id,
    );

    return user;
  }

  async verifyUser(
    user_id: string,
    verifyUserDto: VerifyUserDto,
  ): Promise<boolean> {
    const user = await this.userService.getUserById(user_id);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const verificationCode = await this.verificationRepository.findOne({
      where: {
        user_id,
        code: verifyUserDto.code,
      },
    });

    if (!verificationCode) {
      throw new BadRequestException('Invalid verification code');
    }
    // Check for expiration
    if (
      verificationCode.expires_at &&
      verificationCode.expires_at < new Date()
    ) {
      throw new BadRequestException('Code expired');
    }

    await this.userService.updateUserVerification(user_id);

    return true;
  }

  async resendUserCode(resendCodeDto: ResendCodeDto): Promise<string> {
    const user = await this.userService.getUserByEmail(resendCodeDto.email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const verifyCode = randomInteger(100000, 999999).toString();
    // Send SMS
    // await this.snsService.sendSms(user.phone_number, verifyCode);
    // Save Twilio code
    await this.emailService.sendVerificationCodeEmail(
      resendCodeDto.email,
      verifyCode,
    );

    await this.addEmailCodeVerification(
      {
        email: user.email,
        code: verifyCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
      user.id,
    );

    return verifyCode;
  }

  async login(userDto: LoginUserDto): Promise<object> {
    const existingUser = await this.userService.getUserByEmail(userDto.email);

    if (!existingUser) {
      throw new NotFoundException('User does not exists');
    }

    const matchingPassword = await this.comparePassowrd(
      userDto.password,
      existingUser.password,
    );

    if (!matchingPassword) {
      throw new BadRequestException('Invalid credentials');
    }

    // Use the same token generation method as OAuth logins (20 days, no refresh token)
    const tokens = await this.getSessionTokens(existingUser);
    return {
      accessToken: tokens.accessToken,
      // No refresh token
    };
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<object> {
    const user = await this.userService.getUserByEmail(data.email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verifyCode = this.randomInteger(100000, 999999).toString();

    if (user.email !== data.email) {
      throw new BadRequestException('Email does not match');
    }

    // await this.snsService.sendSms(user.phone_number, verifyCode);

    await this.emailService.sendVerificationCodeEmail(data.email, verifyCode);

    await this.addEmailCodeVerification(
      {
        email: user.email,
        code: verifyCode,
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
      user.id,
    );

    return { id: user.id, email: user.email, verifyCode };
  }

  async resetPassword(
    user_id: string,
    data: ResetPasswordDto,
  ): Promise<boolean> {
    const user = await this.userService.getUserById(user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verificationCode = await this.verificationRepository.findOne({
      where: {
        user_id,
        code: data.code,
      },
    });

    if (!verificationCode) {
      throw new BadRequestException('Invalid or expired code');
    }

    // Check for expiration
    if (
      verificationCode.expires_at &&
      verificationCode.expires_at < new Date()
    ) {
      throw new BadRequestException('Code expired');
    }
    if (data.password !== data.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    const newPassword = await this.getSaltedHashValue(data.password);
    const affected = await this.userService.updateUserPassword(
      user_id,
      newPassword,
    );

    return !!affected;
  }
  verifyRefreshToken(refreshToken: string): Promise<string | object> {
    try {
      const publicKey = this.configService.get<string>('PUBLIC_KEY_PATH');
      if (!publicKey) {
        throw new Error('PUBLIC_KEY_PATH is not defined in the configuration');
      }

      const payload = jwt.verify(refreshToken, publicKey, {
        algorithms: ['RS256'],
      });

      return Promise.resolve(payload);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async addEmailCodeVerification(
    data: CreateVerificationDto,
    user_id: string,
  ): Promise<VerificationEntity> {
    const verifyCode = this.verificationRepository.create({
      ...data,
      user_id,
    });

    return await this.verificationRepository.save(verifyCode);
  }

  private randomInteger(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async comparePassowrd(plainPassword: string, saltedPassword: string) {
    return bcrypt.compare(plainPassword, saltedPassword);
  }

  private async getSaltedHashValue(value: string): Promise<string> {
    const saltRounds = this.randomInteger(10, 14);
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedValue = await bcrypt.hash(value, salt);
    return hashedValue;
  }

  public async getSessionTokens(
    user: UsersEntity,
    accessTokenExpiration?: number,
  ) {
    // Generate only access token (20 days expiration)
    // No refresh token needed for mobile apps
    const accessToken = await this.generateJwt(
      {
        uuid: user.id,
        email: user.email,
        fullName: `${user.first_name} ${user.last_name}`,
        is_verified: user.is_verified,
        role: (user as any).role ?? Role.USER,
      },
      AuthService.getExpirationDate(
        accessTokenExpiration ?? this.DEFAULT_ACCESS_TOKEN_EXPIRATION,
      ),
    );

    return new TokenDto(accessToken, ''); // Empty string for refreshToken (deprecated)
  }

  private async generateJwt(data: Record<string, unknown>, expiration: number) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload: Record<string, unknown> = {
      iat: Math.floor(Date.now() / 1000),
      iss: '',
      scope: '',
      exp: expiration,
      ...data,
    };
    const token_components: IToken = {
      header: base64url(JSON.stringify(header)),
      payload: base64url(JSON.stringify(payload)),
    };

    const messageString = `${token_components.header}.${token_components.payload}`;
    const message = Buffer.from(messageString); // <- OK because Buffer is a Uint8Array
    const keyId = this.configService.get<string>('KMS_KEY_ID');
    const signingAlgorithm =
      this.configService.get<string>('SIGNING_ALGORITHM');

    // Fallback: if KMS is not configured, sign with JWT_SECRET using HS256
    if (!keyId || !signingAlgorithm) {
      const hsSecret = this.configService.get<string>('JWT_SECRET');
      if (!hsSecret) {
        throw new Error(
          'KMS_KEY_ID or SIGNING_ALGORITHM is not defined in the configuration',
        );
      }

      this.logger.warn(
        '[LOGIN GOOGLE] KMS not configured, falling back to HS256 signing with JWT_SECRET',
      );
      return this.jwtService.sign(
        payload, // includes exp already
        {
          algorithm: 'HS256',
          secret: hsSecret,
          // do not set expiresIn since exp already present
        },
      );
    }

    const params = {
      KeyId: keyId,
      SigningAlgorithm: signingAlgorithm,
      Message: message, // must be a Buffer (Uint8Array)
      MessageType: 'RAW',
    };

    const res = await this.kms.sign(params).promise();

    if (!res.Signature || !(res.Signature instanceof Buffer)) {
      throw new Error('Invalid signature returned from KMS');
    }

    token_components.signature = res.Signature.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${token_components.header}.${token_components.payload}.${token_components.signature}`;
  }

  private static getExpirationDate(seconds: number) {
    const expirationDate = moment().add(seconds, 'seconds');
    return Math.floor(new Date(expirationDate.toISOString()).getTime() / 1000);
  }

  async changePassword(
    user_id: string,
    data: ChangePasswordDto,
  ): Promise<boolean> {
    const user = await this.userService.getUserById(user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (data.password !== data.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }
    const newPassword = await this.getSaltedHashValue(data.password);
    const affected = await this.userService.updateUserPassword(
      user_id,
      newPassword,
    );
    if (!affected) {
      throw new BadRequestException('Failed to update password');
    }
    return true;
  }

  async loginGoogle(user: UsersEntity): Promise<TokenDto> {
    this.logger.log('[LOGIN GOOGLE] Starting Google login process');

    if (!user) {
      this.logger.error('[LOGIN GOOGLE] User object is null/undefined');
      throw new UnauthorizedException('User not found in request');
    }

    this.logger.debug(
      `[LOGIN GOOGLE] User from OAuth: email=${user.email}, id=${user.id}, verified=${user.is_verified}`,
    );

    // Get the user (Google users are automatically verified)
    const existingUser = await this.userService.getUserByEmail(user.email);

    if (!existingUser) {
      this.logger.error(
        `[LOGIN GOOGLE] User not found in database: ${user.email}`,
      );
      throw new NotFoundException('User does not exist');
    }

    this.logger.log(
      `[LOGIN GOOGLE] User found in database: ${existingUser.email} (ID: ${existingUser.id}, Verified: ${existingUser.is_verified})`,
    );

    // Auto-verify Google-authenticated users if not already verified
    if (!existingUser.is_verified) {
      this.logger.log(`[LOGIN GOOGLE] Auto-verifying user: ${existingUser.id}`);
      await this.userService.updateUserVerification(existingUser.id);
      existingUser.is_verified = true;
      this.logger.log(`[LOGIN GOOGLE] User verified successfully`);
    }

    this.logger.log('[LOGIN GOOGLE] Generating session tokens');
    const tokens = await this.getSessionTokens(existingUser);
    this.logger.log('[LOGIN GOOGLE] Session tokens generated successfully');

    return tokens;
  }

  async validateGoogleUser(
    googleUser: CreateUserGoogleDto,
  ): Promise<UsersEntity> {
    this.logger.log(
      `[VALIDATE GOOGLE USER] Validating Google user: ${googleUser.email}`,
    );
    this.logger.debug(
      `[VALIDATE GOOGLE USER] User data: firstName=${googleUser.first_name}, lastName=${googleUser.last_name}, verified=${googleUser.is_verified}`,
    );

    const user = await this.userService.getUserByEmail(googleUser.email);

    if (user) {
      this.logger.log(
        `[VALIDATE GOOGLE USER] Existing user found: ${user.email} (ID: ${user.id})`,
      );
      // Ensure role is set; if missing, set and persist
      if (!(user as any).role) {
        (user as any).role = Role.USER;
        await this.userService.updateUser(user.id, {
          role: Role.USER,
        } as any);
      }
      return user;
    }

    this.logger.log(
      `[VALIDATE GOOGLE USER] New user, registering: ${googleUser.email}`,
    );
    // Generate a random password to satisfy registration validation
    const randomPassword = randomBytes(16).toString('hex');
    const newUser = await this.userService.register({
      ...googleUser,
      password: randomPassword,
      is_verified: true,
      role: Role.USER,
    });
    this.logger.log(
      `[VALIDATE GOOGLE USER] New user registered: ${newUser.email} (ID: ${newUser.id})`,
    );

    return newUser;
  }

  async loginApple(identityToken: string): Promise<TokenDto> {
    this.logger.log('[LOGIN APPLE] Starting Apple login process');

    try {
      // Verify the Apple identity token
      const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
      if (!clientId) {
        throw new Error('APPLE_CLIENT_ID is not configured');
      }

      this.logger.debug(
        `[LOGIN APPLE] Verifying identity token for clientId: ${clientId}`,
      );

      const appleUser = await appleSignin.verifyIdToken(identityToken, {
        audience: clientId, // Your App's Bundle ID / Services ID
      });

      this.logger.debug(
        `[LOGIN APPLE] Token verified - User ID: ${appleUser.sub}`,
      );
      this.logger.debug(
        `[LOGIN APPLE] Email: ${appleUser.email || 'Not provided'}`,
      );

      // email_verified can be a string or boolean in Apple tokens
      const emailVerified =
        appleUser.email_verified === true ||
        appleUser.email_verified === 'true';
      this.logger.debug(`[LOGIN APPLE] Email verified: ${emailVerified}`);

      // Extract user information from the token
      // Note: Apple only sends email on the FIRST sign in
      // Subsequent sign ins only provide the 'sub' (user ID)
      // Name is NOT included in the token - it's only available in the initial authorization response
      const email = appleUser.email;
      const appleUserId = appleUser.sub; // Apple's unique user identifier

      if (!email) {
        // If email is not in token, try to find user by apple_user_id if we store it
        // For now, we'll require email on first sign in
        this.logger.warn(
          '[LOGIN APPLE] Email not found in token - this may be a subsequent sign in',
        );
        throw new BadRequestException(
          'Email is required for first-time Apple sign in',
        );
      }

      // Validate/create user
      // Note: Apple doesn't provide name in the token, so we use empty strings
      // If you need the name, you'll need to capture it from the initial authorization response
      const user = await this.validateAppleUser({
        email: email,
        apple_user_id: appleUserId,
        first_name: '', // Name is not available in the token
        last_name: '', // Name is not available in the token
        is_verified: emailVerified, // Apple emails are verified
        password: '',
      });

      this.logger.log(
        `[LOGIN APPLE] User validated/created: ${user.email} (ID: ${user.id})`,
      );

      // Generate session tokens
      this.logger.log('[LOGIN APPLE] Generating session tokens');
      const tokens = await this.getSessionTokens(user);
      this.logger.log('[LOGIN APPLE] Session tokens generated successfully');

      return tokens;
    } catch (error) {
      this.logger.error(`[LOGIN APPLE] Error: ${error.message}`);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Apple identity token');
    }
  }

  async validateAppleUser(appleUser: CreateUserAppleDto): Promise<UsersEntity> {
    this.logger.log(
      `[VALIDATE APPLE USER] Validating Apple user: ${appleUser.email}`,
    );
    this.logger.debug(
      `[VALIDATE APPLE USER] User data: firstName=${appleUser.first_name}, lastName=${appleUser.last_name}, appleUserId=${appleUser.apple_user_id}, verified=${appleUser.is_verified}`,
    );

    // First, try to find user by email
    let user = await this.userService.getUserByEmail(appleUser.email);

    if (user) {
      this.logger.log(
        `[VALIDATE APPLE USER] Existing user found: ${user.email} (ID: ${user.id})`,
      );
      // Ensure role is set; if missing, set and persist
      if (!(user as any).role) {
        (user as any).role = Role.USER;
        await this.userService.updateUser(user.id, {
          role: Role.USER,
        } as any);
      }
      // Auto-verify Apple-authenticated users if not already verified
      if (!user.is_verified) {
        this.logger.log(
          `[VALIDATE APPLE USER] Auto-verifying user: ${user.id}`,
        );
        await this.userService.updateUserVerification(user.id);
        user.is_verified = true;
      }
      return user;
    }

    // New user - register them
    this.logger.log(
      `[VALIDATE APPLE USER] New user, registering: ${appleUser.email}`,
    );
    // Generate a random password to satisfy registration validation
    const randomPassword = randomBytes(16).toString('hex');
    const newUser = await this.userService.register({
      ...appleUser,
      password: randomPassword,
      is_verified: true, // Apple users are automatically verified
      role: Role.USER,
    });
    this.logger.log(
      `[VALIDATE APPLE USER] New user registered: ${newUser.email} (ID: ${newUser.id})`,
    );

    return newUser;
  }
}
