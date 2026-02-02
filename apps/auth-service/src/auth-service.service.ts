import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';
import { RegisterInput, LoginInput, AuthResponse, User, UserRole } from './auth.dto';
import { User as PrismaUser } from './generated/client'; // Type from generated client
import { RefreshTokenRepository } from './refresh-token.repository';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private refreshTokenRepo: RefreshTokenRepository,
  ) { }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        role: input.role,
      },
    });

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.mapToUserDto(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.mapToUserDto(user),
    };
  }

  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.mapToUserDto(user);
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      const storedToken = await this.refreshTokenRepo.find(userId);

      if (!storedToken || storedToken !== token) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Rotate tokens
      const newTokens = await this.generateTokens(user);

      return {
        ...newTokens,
        user: this.mapToUserDto(user),
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<boolean> {
    await this.refreshTokenRepo.delete(userId);
    return true;
  }

  private async generateTokens(user: PrismaUser): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }), // Short lived access token
      this.jwtService.signAsync(payload, { expiresIn: '7d' }),  // Long lived refresh token
    ]);

    await this.refreshTokenRepo.save(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  private mapToUserDto(user: PrismaUser): User {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
