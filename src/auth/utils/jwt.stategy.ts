import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Role } from '../../users/enums/role.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    // const publicKey = configService.get<string>('PUBLIC_KEY_PATH');
    // if (!publicKey) {
    //   throw new Error('Missing PUBLIC_KEY_PATH in environment variables');
    // }

    // super({
    //   jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    //   ignoreExpiration: false,
    //   secretOrKey: publicKey,
    //   algorithms: ['RS256'],
    // });
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'defaultSecret',
    });
  }

  validate(payload: {
    uuid: string;
    email: string;
    fullName: string;
    is_verified: boolean;
    role: Role;
  }) {
    return {
      uuid: payload.uuid,
      email: payload.email,
      fullName: payload.fullName,
      is_verified: payload.is_verified,
      role: payload.role,
    };
  }
}
