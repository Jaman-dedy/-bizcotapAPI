import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ExchangesService } from './exchanges.service';
import {
  CreateExchangeDto,
  ExchangeResponseDto,
  ExchangeQueryDto,
} from './dto';
import { Public } from '../common/decorators/public.decorator';

// Define an interface for the authenticated request
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
  };
}

// Define an interface for potentially unauthenticated request
interface OptionalAuthRequest extends Request {
  user?: {
    id?: number;
  };
}

@ApiTags('exchanges')
@Controller('exchange')
export class ExchangesController {
  constructor(private readonly exchangesService: ExchangesService) {}

  @Public()
  @Post('contacts')
  @ApiOperation({
    summary: 'Record a contact exchange when someone scans a tag',
  })
  @ApiResponse({
    status: 201,
    description: 'Exchange recorded successfully',
    type: ExchangeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async createExchange(
    @Body() createExchangeDto: CreateExchangeDto,
    @Request() req: OptionalAuthRequest,
  ) {
    // If the user is authenticated, include their ID as the sender
    const userId = req.user?.id;

    return this.exchangesService.createExchange(createExchangeDto, userId);
  }

  @Get('contacts')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all contact exchanges for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of exchanges',
    type: [ExchangeResponseDto],
  })
  async findAllExchanges(
    @Request() req: AuthenticatedRequest,
    @Query() query: ExchangeQueryDto,
  ) {
    return this.exchangesService.findAllExchanges(req.user.id, query);
  }

  @Get('contacts/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific contact exchange by ID' })
  @ApiResponse({
    status: 200,
    description: 'Exchange details',
    type: ExchangeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Exchange not found' })
  async findOne(
    @Param('id') id: string, 
    @Request() req: AuthenticatedRequest
  ) {
    return this.exchangesService.findExchangeById(+id, req.user.id);
  }

  @Delete('contacts/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a contact exchange' })
  @ApiResponse({ status: 200, description: 'Exchange deleted successfully' })
  @ApiResponse({ status: 404, description: 'Exchange not found' })
  async remove(
    @Param('id') id: string, 
    @Request() req: AuthenticatedRequest
  ) {
    return this.exchangesService.removeExchange(+id, req.user.id);
  }

  @Get('statistics')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get exchange statistics for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Exchange statistics' })
  async getStatistics(@Request() req: AuthenticatedRequest) {
    return this.exchangesService.getExchangeStatistics(req.user.id);
  }
}