import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(login: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user || !user.active) throw new UnauthorizedException('Неверный логин или пароль');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Неверный логин или пароль');

    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      token,
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, fullName: user.fullName, role: user.role };
  }
}
