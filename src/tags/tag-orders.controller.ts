import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    Request,
    Query,
    ForbiddenException,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
  import { OrderStatus, UserRole } from '@prisma/client';
  
  import { TagsService } from './tags.service';
  import { CreateTagOrderDto, TagOrderResponseDto } from './dto';
  import { RolesGuard } from '../auth/guards/roles.guard';
  import { Roles } from '../common/decorators/roles.decorator';
  
  @ApiTags('tag-orders')
  @Controller('tag/order')
  @ApiBearerAuth()
  export class TagOrdersController {
    constructor(private readonly tagsService: TagsService) {}
  
    @Post()
    @ApiOperation({ summary: 'Create a new tag order request' })
    @ApiResponse({ status: 201, description: 'Tag order created successfully', type: TagOrderResponseDto })
    async create(@Body() createTagOrderDto: CreateTagOrderDto, @Request() req: any) {
      // User is creating a tag order for themselves
      return this.tagsService.createTagOrder(req.user.id, createTagOrderDto);
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all tag orders' })
    @ApiResponse({ status: 200, description: 'List of tag orders', type: [TagOrderResponseDto] })
    @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
    @ApiQuery({ name: 'userId', required: false, type: Number })
    @ApiQuery({ name: 'companyId', required: false, type: Number })
    async findAll(
      @Query('status') status?: OrderStatus,
      @Query('userId') userId?: number,
      @Query('companyId') companyId?: number,
      @Request() req?: any
    ) {
      // Filter based on user role and permissions
      if (req.user.role === UserRole.INDIVIDUAL || req.user.role === UserRole.EMPLOYEE) {
        // Individual users can only see their own orders
        return this.tagsService.findAllTagOrders(status, req.user.id);
      } else if (req.user.role === UserRole.COMPANY_ADMIN) {
        // Company admins can see all orders in their company
        return this.tagsService.findAllTagOrders(
          status,
          userId || undefined,
          req.user.companyId
        );
      }
      
      // Super admins can see all orders with optional filters
      return this.tagsService.findAllTagOrders(
        status,
        userId || undefined,
        companyId || undefined
      );
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a tag order by ID' })
    @ApiResponse({ status: 200, description: 'Tag order details', type: TagOrderResponseDto })
    @ApiResponse({ status: 404, description: 'Tag order not found' })
    async findOne(@Param('id') id: string, @Request() req: any) {
      const order = await this.tagsService.findTagOrderById(+id);
      
      // Check if user has permission to view this order
      if (req.user.role !== UserRole.SUPER_ADMIN) {
        if (req.user.role === UserRole.COMPANY_ADMIN) {
          if (order.companyId !== req.user.companyId) {
            throw new ForbiddenException('You can only view orders from your company');
          }
        } else if (order.userId !== req.user.id) {
          throw new ForbiddenException('You can only view your own orders');
        }
      }
      
      return order;
    }
  
    @Post('approve/:id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Approve a tag order (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Tag order approved successfully', type: TagOrderResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Tag order not found' })
    async approve(@Param('id') id: string) {
      return this.tagsService.approveTagOrder(+id);
    }
  
    @Post('reject/:id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Reject a tag order (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Tag order rejected successfully', type: TagOrderResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Tag order not found' })
    async reject(@Param('id') id: string) {
      return this.tagsService.rejectTagOrder(+id);
    }
  }