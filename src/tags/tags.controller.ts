// src/tags/tags.controller.ts
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
  ForbiddenException,
  StreamableFile,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto, UpdateTagDto } from './dto';
import { UserRole } from '@prisma/client';
import { PassThrough } from 'stream';
import { Public } from 'src/common/decorators/public.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('tag')
@Controller('tag')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string containing tag data',
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Optional avatar image file',
        },
      },
      required: ['data'],
    },
  })
  @ApiResponse({ status: 201, description: 'Tag created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @UseInterceptors(FileInterceptor('avatar'))
  async create(
    @Body('data') dataString: string,
    @UploadedFile() avatarFile?: Express.Multer.File,
    @Query('useBase64') useBase64?: string,
  ) {
    // Validate input data string
    if (!dataString) {
      throw new BadRequestException('Tag data is required');
    }

    let createTagDto: CreateTagDto;
    try {
      // Attempt to parse JSON
      createTagDto = JSON.parse(dataString);
    } catch (error) {
      throw new BadRequestException(`Invalid JSON data: ${error.message}`);
    }

    // Validate core required fields
    if (!createTagDto.userId) {
      throw new BadRequestException('User ID is required');
    }

    // Ensure tagInfo exists
    createTagDto.tagInfo = createTagDto.tagInfo || {};

    // Process avatar if provided
    if (avatarFile) {
      try {
        const shouldUseBase64 = useBase64 === 'true';
        const avatarUrl = shouldUseBase64
          ? await this.tagsService.convertAvatarToBase64(avatarFile)
          : await this.tagsService.uploadAvatar(avatarFile);

        // Add avatar URL to tagInfo
        createTagDto.tagInfo.avatar = avatarUrl;
      } catch (error) {
        // Log avatar processing error but continue with tag creation
        console.error('Avatar processing error:', error);
        throw new BadRequestException(`Avatar upload failed: ${error.message}`);
      }
    }

    // Additional validation for tagInfo
    this.validateTagInfo(createTagDto.tagInfo);

    // Create the tag
    try {
      return await this.tagsService.createTag(createTagDto);
    } catch (error) {
      console.error('Tag creation error:', error);
      throw new BadRequestException(`Failed to create tag: ${error.message}`);
    }
  }

  /**
   * Validate tag information
   * @param tagInfo Tag information object
   */
  private validateTagInfo(tagInfo: Record<string, any>): void {
    // Validate name
    if (!tagInfo.fname || !tagInfo.lname) {
      throw new BadRequestException('First name and last name are required');
    }

    // Optional: Additional validations
    if (tagInfo.emails) {
      const invalidEmails = tagInfo.emails.filter(
        (email: any) => !email.value || typeof email.value !== 'string',
      );
      if (invalidEmails.length > 0) {
        throw new BadRequestException('Invalid email format');
      }
    }

    // Optional: Validate phone numbers
    if (tagInfo.phones) {
      const invalidPhones = tagInfo.phones.filter(
        (phone: any) => !phone.value || typeof phone.value !== 'string',
      );
      if (invalidPhones.length > 0) {
        throw new BadRequestException('Invalid phone number format');
      }
    }

    // Optional: Limit nested object depths or sizes
    const maxNestedDepth = 3;
    const maxNestedArraySize = 10;

    const checkNestedDepth = (obj: any, depth: number = 0): void => {
      if (depth > maxNestedDepth) {
        throw new BadRequestException('Tag info is too deeply nested');
      }

      if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach((value) => {
          if (Array.isArray(value) && value.length > maxNestedArraySize) {
            throw new BadRequestException(
              `Array too large: ${value.length} > ${maxNestedArraySize}`,
            );
          }
          checkNestedDepth(value, depth + 1);
        });
      }
    };

    try {
      checkNestedDepth(tagInfo);
    } catch (error) {
      throw new BadRequestException(
        `Invalid tag info structure: ${error.message}`,
      );
    }
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tags with optional filtering' })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of tags' })
  async findAll(
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.tagsService.findAllTags(
      userId ? +userId : undefined,
      companyId ? +companyId : undefined,
      isActive ? isActive === 'true' : undefined,
    );
  }

  @Get('my-tags')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get tags based on user role - company tags for admins, individual tags for users',
  })
  @ApiResponse({ status: 200, description: 'List of relevant tags' })
  async getRelevantTags(@Request() req) {
    return this.tagsService.findTagsByUserRole(
      req.user.userId,
      req.user.role,
      req.user.companyId,
    );
  }

  @Get('advanced')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get tags with advanced filtering, searching and pagination',
  })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'companyId', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'tagType', required: false, type: String })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({ status: 200, description: 'Paginated list of tags' })
  async findWithAdvancedFilters(
    @Query('userId') userId?: string,
    @Query('companyId') companyId?: string,
    @Query('isActive') isActive?: string,
    @Query('tagType') tagType?: string,
    @Query('searchTerm') searchTerm?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.tagsService.findTagsWithAdvancedFilters({
      userId: userId ? +userId : undefined,
      companyId: companyId ? +companyId : undefined,
      isActive: isActive ? isActive === 'true' : undefined,
      tagType,
      searchTerm,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('company-admin')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all company tags (admin only)' })
  @ApiResponse({ status: 200, description: 'List of company tags' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin access',
  })
  async getCompanyTags(@Request() req) {
    if (!req.user.companyId) {
      throw new BadRequestException('User is not associated with any company');
    }

    return this.tagsService.findAllTags(undefined, req.user.companyId, true);
  }

  @Patch(':tuid')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a tag' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON string containing tag update data',
        },
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Optional avatar image file',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Tag updated successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  @UseInterceptors(FileInterceptor('avatar'))
  async update(
    @Param('tuid') tuid: string,
    @Body('data') dataString: string,
    @UploadedFile() avatarFile?: Express.Multer.File,
    @Query('useBase64') useBase64?: string,
    @Query('removeAvatar') removeAvatar?: string,
  ) {
    // Find the existing tag
    const tag = await this.tagsService.findTagByTuid(tuid);

    // Parse the update data from JSON string (if provided)
    let updateTagDto: UpdateTagDto = {};
    if (dataString) {
      try {
        updateTagDto = JSON.parse(dataString);
      } catch (error) {
        throw new BadRequestException('Invalid JSON data');
      }
    }

    // Handle avatar - process new upload, remove, or keep existing
    if (avatarFile) {
      // Upload new avatar
      const shouldUseBase64 = useBase64 === 'true';
      const avatarUrl = shouldUseBase64
        ? await this.tagsService.convertAvatarToBase64(avatarFile)
        : await this.tagsService.uploadAvatar(avatarFile);

      // Make sure tagInfo exists
      if (!updateTagDto.tagInfo) {
        updateTagDto.tagInfo = {};
      }

      // Add avatar URL to tagInfo
      updateTagDto.tagInfo.avatar = avatarUrl;
    } else if (removeAvatar === 'true') {
      // Remove avatar
      // Make sure tagInfo exists
      if (!updateTagDto.tagInfo) {
        updateTagDto.tagInfo = {};
      }

      // Explicitly set avatar to null to remove it
      updateTagDto.tagInfo.avatar = null;
    }

    // Update the tag
    return this.tagsService.updateTag(tag.id, updateTagDto);
  }

  @Get(':tuid/vcard')
  @Public()
  @ApiOperation({
    summary:
      'Download vCard (.vcf) with enhanced social media and WhatsApp support',
  })
  @ApiResponse({ status: 200, description: 'vCard file returned' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async downloadVCard(@Param('tuid') tuid: string): Promise<StreamableFile> {
    const tag = await this.tagsService.findTagByTuid(tuid);
    if (!tag || !tag.tagInfo) {
      throw new NotFoundException('Tag or tag info not found');
    }

    // Safely assert tagInfo as expected structure
    const tagInfo = tag.tagInfo as Record<string, any>;

    // Generate VCard content
    const vcardContent = this.tagsService.generateVCard(tagInfo);

    const fname = tagInfo.fname || 'Unknown';
    const lname = tagInfo.lname || 'User';

    const buffer = Buffer.from(vcardContent, 'utf-8');
    const stream = new PassThrough();
    stream.end(buffer);

    return new StreamableFile(stream, {
      disposition: `attachment; filename="${fname}_${lname}.vcf"`,
      type: 'text/vcard; charset=utf-8',
    });
  }

  @Get(':tuid')
  @Public()
  @ApiOperation({ summary: 'Get a tag by TUID (public)' })
  @ApiResponse({ status: 200, description: 'Tag details' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async findOne(@Param('tuid') tuid: string) {
    return this.tagsService.findTagByTuid(tuid);
  }

  @Delete(':tuid')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 200, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async remove(@Param('tuid') tuid: string) {
    const tag = await this.tagsService.findTagByTuid(tuid);
    return this.tagsService.removeTag(tag.id);
  }
}
