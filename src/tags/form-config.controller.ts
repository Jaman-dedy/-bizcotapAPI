import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TagsService, FormConfig } from './tags.service';
import { 
  CreateFormConfigDto, 
  UpdateFormConfigDto,
  FormConfigResponseDto,
} from './dto';
import { Public } from 'src/common/decorators/public.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('tag')
@Controller('form-config')
export class FormConfigController {
  constructor(private readonly tagsService: TagsService) {}


  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a form configuration for a tag' })
  @ApiResponse({ 
    status: 201, 
    description: 'Form configuration created successfully',
    type: FormConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async create(@Body() createFormConfigDto: CreateFormConfigDto): Promise<FormConfig> {
    try {
      console.log('Creating form config with DTO:', JSON.stringify(createFormConfigDto));
      
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createFormConfigDto.tagId)) {
        throw new BadRequestException(`Invalid tagId format: ${createFormConfigDto.tagId}. Expected UUID format.`);
      }
      
      return await this.tagsService.createFormConfig(createFormConfigDto);
    } catch (error) {
      console.error('Form config creation error:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create form configuration: ${error.message}`);
    }
  }
  
  @Post('tag/tuid')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a form configuration for a tag using TUID' })
  @ApiResponse({ 
    status: 201, 
    description: 'Form configuration created successfully',
    type: FormConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async createByTuid(@Body() body: { tuid: string, formConfig?: any }): Promise<FormConfig> {
    try {
      const tag = await this.tagsService.findTagByTuid(body.tuid);
      
      // Create a form config DTO and set the tagId as a string
      const createFormConfigDto = new CreateFormConfigDto();
      // createFormConfigDto.tagId = tag.tuid; 
      
      // Copy any additional form config properties if provided
      if (body.formConfig) {
        Object.assign(createFormConfigDto, body.formConfig);
      }
      
      return await this.tagsService.createFormConfig(createFormConfigDto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create form configuration: ${error.message}`);
    }
  }

  @Get('tag/:tagId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a form configuration by tag ID' })
  @ApiParam({ name: 'tagId', description: 'Tag ID or Tag TUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Form configuration details',
    type: FormConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form configuration not found' })
  async findByTagId(@Param('tagId') tagId: string): Promise<FormConfig> {
    try {
      return await this.tagsService.getFormConfigByTagId(tagId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get form configuration: ${error.message}`);
    }
  }

  @Get('tag/tuid/:tuid')
  @Public()
  @ApiOperation({ summary: 'Get a form configuration by tag TUID (public)' })
  @ApiParam({ name: 'tuid', description: 'Tag TUID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Form configuration details',
    type: FormConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form configuration not found' })
  async findByTagTuid(@Param('tuid') tuid: string): Promise<FormConfig> {
    try {
      // Use the service method directly - it will handle the TUID to ID conversion
      return await this.tagsService.getFormConfigByTagId(tuid);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(`Failed to get form configuration: ${error.message}`);
    }
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a form configuration' })
  @ApiParam({ name: 'id', description: 'Form configuration ID', type: 'number' })
  @ApiResponse({ 
    status: 200, 
    description: 'Form configuration updated successfully',
    type: FormConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form configuration not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFormConfigDto: UpdateFormConfigDto,
  ): Promise<FormConfig> {
    return this.tagsService.updateFormConfig(id, updateFormConfigDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a form configuration' })
  @ApiParam({ name: 'id', description: 'Form configuration ID', type: 'number' })
  @ApiResponse({ status: 200, description: 'Form configuration deleted successfully' })
  @ApiResponse({ status: 404, description: 'Form configuration not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<FormConfig> {
    return this.tagsService.deleteFormConfig(id);
  }
}