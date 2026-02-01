import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';
import { RegisterInput, LoginInput, AuthResponse, User, UserRole } from './auth.dto';
import { User as PrismaUser } from './generated/client'; // Type from generated client

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

    const token = this.generateToken(user);

    return {
      accessToken: token,
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

    const token = this.generateToken(user);

    return {
      accessToken: token,
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

  private generateToken(user: PrismaUser): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
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
