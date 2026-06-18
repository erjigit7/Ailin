import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtUser {
  userId: string;
  role: 'ADMIN' | 'CASHIER';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'change-me-in-production',
    });
  }

  // Возвращаемое значение становится req.user
  async validate(payload: { sub: string; role: 'ADMIN' | 'CASHIER' }): Promise<JwtUser> {
    return { userId: payload.sub, role: payload.role };
  }
}
