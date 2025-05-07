import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    // Exclude password from response
    const { password, ...result } = user;
    return result;
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  async findAll(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
    @Request() req?: any,
  ) {
    const users = await this.usersService.findAll({
      skip: skip ? +skip : undefined,
      take: take ? +take : undefined,
      // Company admins can only see users in their company
      where:
        req.user.role === UserRole.COMPANY_ADMIN
          ? { companyId: req.user.companyId }
          : undefined,
    });

    // Exclude password from response
    return users.map((user) => {
      const { password, ...result } = user;
      return result;
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    // Check if the user is trying to access their own data or has admin privileges
    const userId = +id;
    if (
      req.user.id !== userId &&
      req.user.role !== UserRole.SUPER_ADMIN &&
      !(req.user.role === UserRole.COMPANY_ADMIN && req.user.companyId)
    ) {
      throw new Error('Forbidden: You can only access your own data');
    }

    const user = await this.usersService.findOne(userId);
    // Exclude password from response
    const { password, ...result } = user;
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    // Check if the user is trying to update their own data or has admin privileges
    const userId = +id;
    if (
      req.user.id !== userId &&
      req.user.role !== UserRole.SUPER_ADMIN &&
      !(req.user.role === UserRole.COMPANY_ADMIN && req.user.companyId)
    ) {
      throw new Error('Forbidden: You can only update your own data');
    }

    // Only admins can change roles
    if (updateUserDto.role && req.user.role !== UserRole.SUPER_ADMIN) {
      delete updateUserDto.role;
    }

    const user = await this.usersService.update(userId, updateUserDto);
    // Exclude password from response
    const { password, ...result } = user;
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string) {
    const user = await this.usersService.remove(+id);
    // Exclude password from response
    const { password, ...result } = user;
    return result;
  }
}
