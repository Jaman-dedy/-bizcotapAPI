import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
  } from '@nestjs/common';
  import { AuthGuard } from '@nestjs/passport';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  
  import { AuthService } from './auth.service';
  import { LoginDto, RegisterDto, RefreshTokenDto, AuthResponse } from './dto';
  import { Public } from '../common/decorators/public.decorator';
  import { Roles } from '../common/decorators/roles.decorator';
  import { RolesGuard } from './guards/roles.guard';
  import { UserRole } from '@prisma/client';
  
  @ApiTags('auth')
  @Controller('auth')
  export class AuthController {
    constructor(private readonly authService: AuthService) {}
  
    @Public()
    @UseGuards(AuthGuard('local'))
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'User login' })
    @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponse })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async login(@Request() req, @Body() loginDto: LoginDto) {
      return this.authService.login(req.user);
    }
  
    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh access token' })
    @ApiResponse({ status: 200, description: 'Token refreshed', type: AuthResponse })
    @ApiResponse({ status: 401, description: 'Invalid refresh token' })
    async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
      return this.authService.refreshToken(refreshTokenDto.token);
    }
  
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
    @Post('register')
    @ApiOperation({ summary: 'Register a new user (Admin only)' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiBearerAuth()
    async register(@Body() registerDto: RegisterDto) {
      return this.authService.register(registerDto);
    }
  }