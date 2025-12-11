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
import { Role } from 'src/users/enums/role.enum';
import { randomBytes } from 'crypto';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly DEFAULT_ACCESS_TOKEN_EXPIRATION = 12 * 60 * 60; // 12 hours to seconds
  private readonly DEFAULT_REFRESH_TOKEN_EXPIRATION = 24 * 60 * 60; // 24 hours to seconds
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

    const payload = {
      uuid: existingUser.id,
      email: existingUser.email,
      fullName: `${existingUser.first_name} ${existingUser.last_name}`,
      is_verified: existingUser.is_verified,
      role: existingUser.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '24h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: '30d',
    });

    return {
      accessToken,
      refreshToken,
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
    // const roles =
    //   user.roles?.map((role) => {
    //     return {
    //       id: role.id,
    //       name: role.name,
    //       description: role.description,
    //     };
    //   }) || [];

    return new TokenDto(
      await this.generateJwt(
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
      ),
      await this.generateJwt(
        {
          uuid: user.id,
          email: user.email,
          fullName: `${user.first_name} ${user.last_name}`,
          is_verified: user.is_verified,
          role: (user as any).role ?? Role.USER,
        },
        AuthService.getExpirationDate(this.DEFAULT_REFRESH_TOKEN_EXPIRATION),
      ),
    );
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

    this.logger.debug(`[LOGIN GOOGLE] User from OAuth: email=${user.email}, id=${user.id}, verified=${user.is_verified}`);
    
    // Get the user (Google users are automatically verified)
    const existingUser = await this.userService.getUserByEmail(user.email);

    if (!existingUser) {
      this.logger.error(`[LOGIN GOOGLE] User not found in database: ${user.email}`);
      throw new NotFoundException('User does not exist');
    }

    this.logger.log(`[LOGIN GOOGLE] User found in database: ${existingUser.email} (ID: ${existingUser.id}, Verified: ${existingUser.is_verified})`);

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
    this.logger.log(`[VALIDATE GOOGLE USER] Validating Google user: ${googleUser.email}`);
    this.logger.debug(`[VALIDATE GOOGLE USER] User data: firstName=${googleUser.first_name}, lastName=${googleUser.last_name}, verified=${googleUser.is_verified}`);
    
    const user = await this.userService.getUserByEmail(googleUser.email);

    if (user) {
      this.logger.log(`[VALIDATE GOOGLE USER] Existing user found: ${user.email} (ID: ${user.id})`);
      // Ensure role is set; if missing, set and persist
      if (!(user as any).role) {
        (user as any).role = Role.USER;
        await this.userService.updateUser(user.id, {
          role: Role.USER,
        } as any);
      }
      return user;
    }

    this.logger.log(`[VALIDATE GOOGLE USER] New user, registering: ${googleUser.email}`);
    // Generate a random password to satisfy registration validation
    const randomPassword = randomBytes(16).toString('hex');
    const newUser = await this.userService.register({
      ...googleUser,
      password: randomPassword,
      is_verified: true,
      role: Role.USER,
    });
    this.logger.log(`[VALIDATE GOOGLE USER] New user registered: ${newUser.email} (ID: ${newUser.id})`);
    
    return newUser;
  }
}
