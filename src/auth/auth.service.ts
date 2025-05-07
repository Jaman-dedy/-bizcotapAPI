// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserLoginResponse, UserRegistrationData } from './interfaces/auth.interfaces';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Check failed login attempts
    if (user.accountLocked) {
      const lockUntil = user.accountLockedUntil;
      if (lockUntil && lockUntil > new Date()) {
        throw new UnauthorizedException(
          `Account is locked. Try again after ${lockUntil.toLocaleString()}`,
        );
      } else {
        // Reset account lock if lockout period has expired
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            accountLocked: false,
            accountLockedUntil: null,
            failedLoginAttempts: 0,
          },
        });
      }
    }

    // Verify password
    try {
      if (!user.password) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const isPasswordValid = await argon2.verify(user.password, password);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        const failedAttempts = user.failedLoginAttempts + 1;
        const maxFailedAttempts = 5; // Configure as needed
        
        const updateData: any = {
          failedLoginAttempts: failedAttempts,
          lastFailedLogin: new Date(),
        };
        
        // Lock account after too many failed attempts
        if (failedAttempts >= maxFailedAttempts) {
          const lockoutMinutes = 30; // Configure as needed
          const lockUntil = new Date();
          lockUntil.setMinutes(lockUntil.getMinutes() + lockoutMinutes);
          
          updateData.accountLocked = true;
          updateData.accountLockedUntil = lockUntil;
        }
        
        await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
        
        throw new UnauthorizedException('Invalid credentials');
      }
      
      // Reset failed login attempts on success
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastFailedLogin: null,
        },
      });
      
      // Remove password from user object
      const { password: _, ...result } = user;
      return result;
    } catch (err) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async login(user: any): Promise<UserLoginResponse> {
    const payload = { 
      email: user.email, 
      sub: user.id,
      role: user.role
    };
    
    // Create session record
    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(
        { ...payload, sessionId: session.id },
        { expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d') },
      ),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<UserLoginResponse> {
    try {
      // Verify the refresh token
      const decoded = this.jwtService.verify(refreshTokenDto.refreshToken);
      
      // Check if session exists and is not revoked
      const session = await this.prisma.userSession.findUnique({
        where: { id: decoded.sessionId },
      });
      
      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      
      // Get the user
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });
      
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }
      
      // Generate new tokens
      return this.login(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async register(userData: UserRegistrationData): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash the password
      const hashedPassword = await argon2.hash(userData.password);

      // Create the user
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: userData.role || UserRole.INDIVIDUAL,
          isActive: userData.isActive !== undefined ? userData.isActive : true,
          companyId: userData.companyId,
          passwordLastChanged: new Date(),
          dataConsentDate: new Date(),
        },
      });

      // Remove sensitive data before returning
      const { password, ...result } = user;
      return result as User;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Registration error: ${error.message}`, error.stack);
      throw new Error('Registration failed');
    }
  }

  async logout(userId: number, sessionId: string): Promise<{ message: string }> {
    // Revoke the session
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        id: sessionId,
        isRevoked: false,
      },
      data: {
        isRevoked: true,
      },
    });
    
    return { message: 'Logout successful' };
  }
}