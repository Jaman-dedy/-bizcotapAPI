// src/tags/tag-orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagOrderDto } from './dto';
import { OrderStatus, UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('tag-orders')
@Controller('tag-orders')
@ApiBearerAuth()
export class TagOrdersController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tag order request' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async create(@Body() createTagOrderDto: CreateTagOrderDto, @Request() req) {
    return this.tagsService.createTagOrder(req.user.userId, createTagOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tag orders with optional filtering' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of tag orders' })
  async findAll(
    @Query('status') status?: OrderStatus,
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Request() req?: any,
  ) {
    // If not admin, only return user's own orders
    if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== UserRole.COMPANY_ADMIN) {
      return this.tagsService.findAllTagOrders(
        status,
        req.user.userId,
        undefined
      );
    }
    
    // If company admin, only return company's orders
    if (req.user.role === UserRole.COMPANY_ADMIN && req.user.companyId) {
      return this.tagsService.findAllTagOrders(
        status,
        userId ? +userId : undefined,
        req.user.companyId
      );
    }
    
    // Super admin can see all orders
    return this.tagsService.findAllTagOrders(
      status,
      userId ? +userId : undefined,
      companyId ? +companyId : undefined,
    );
  }

  @Get('my-orders')
  @ApiOperation({ summary: 'Get logged-in user\'s tag orders' })
  @ApiResponse({ status: 200, description: 'List of user\'s tag orders' })
  async findMyOrders(@Request() req) {
    return this.tagsService.findAllTagOrders(
      undefined,
      req.user.userId,
      undefined
    );
  }

  @Get('company-orders')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get company tag orders (admin only)' })
  @ApiResponse({ status: 200, description: 'List of company tag orders' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires admin access' })
  async findCompanyOrders(@Request() req) {
    if (req.user.role === UserRole.COMPANY_ADMIN && !req.user.companyId) {
      throw new BadRequestException('User is not associated with any company');
    }
    
    return this.tagsService.findAllTagOrders(
      undefined,
      undefined,
      req.user.role === UserRole.COMPANY_ADMIN ? req.user.companyId : undefined
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tag order by ID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    const order = await this.tagsService.findTagOrderById(+id);
    
    // Check if user has access to this order
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      // Company admins can only see orders from their company
      if (req.user.role === UserRole.COMPANY_ADMIN) {
        if (order.companyId !== req.user.companyId) {
          throw new BadRequestException('You do not have access to this order');
        }
      } 
      // Regular users can only see their own orders
      else if (order.userId !== req.user.userId) {
        throw new BadRequestException('You do not have access to this order');
      }
    }
    
    return order;
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve a tag order' })
  @ApiResponse({ status: 200, description: 'Order approved successfully' })
  @ApiResponse({ status: 400, description: 'Order is not in pending status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async approve(@Param('id') id: string, @Request() req) {
    // If company admin, verify order belongs to their company
    if (req.user.role === UserRole.COMPANY_ADMIN) {
      const order = await this.tagsService.findTagOrderById(+id);
      if (order.companyId !== req.user.companyId) {
        throw new BadRequestException('You cannot approve orders for other companies');
      }
    }
    
    return this.tagsService.approveTagOrder(+id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject a tag order' })
  @ApiResponse({ status: 200, description: 'Order rejected successfully' })
  @ApiResponse({ status: 400, description: 'Order is not in pending status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async reject(@Param('id') id: string, @Request() req) {
    // If company admin, verify order belongs to their company
    if (req.user.role === UserRole.COMPANY_ADMIN) {
      const order = await this.tagsService.findTagOrderById(+id);
      if (order.companyId !== req.user.companyId) {
        throw new BadRequestException('You cannot reject orders for other companies');
      }
    }
    
    return this.tagsService.rejectTagOrder(+id);
  }
}