// src/tags/tags.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateTagDto,
  UpdateTagDto,
  CreateTagOrderDto,
} from './dto';
import { UserTag, TagOrder, OrderStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from 'prisma/prisma.service';
import { EmailService } from 'src/email/email.service';
import { InputJsonValue } from '@prisma/client/runtime/library';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp'
// Interfaces for improved type safety
interface UserBasicInfo {
  id: number;
  firstName: string;
  lastName: string;
}

interface CompanyBasicInfo {
  id: number;
  name: string;
}

@Injectable()
export class TagsService {
  private readonly uploadDir: string;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    // Get upload directory from config or use default
    this.uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads/userProfile';
    
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // === Avatar Management ===

  /**
   * Uploads and processes an avatar image
   * @param file The uploaded file
   * @returns URL to the saved avatar
   */
  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Add more detailed logging
      console.log('File details:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      // File size check
      if (file.size > this.maxFileSize) {
        throw new BadRequestException(`File too large. Max size: ${this.maxFileSize / (1024 * 1024)}MB`);
      }

      // Mime type check
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
      }

      // Generate unique filename
      const crypto = require('crypto');
      const hash = crypto.createHash('md5').update(file.buffer).digest('hex');
      const filename = `${hash}${path.extname(file.originalname)}`;
      const filePath = path.join(this.uploadDir, filename);
      
      // Detailed Sharp processing with error handling
      try {
        await sharp(file.buffer)
          .resize({
            width: 300,
            height: 300,
            fit: sharp.fit.cover
          })
          .toFile(filePath);
      } catch (sharpError) {
        console.error('Sharp processing error:', sharpError);
        throw new BadRequestException(`Image processing failed: ${sharpError.message}`);
      }
      
      // Return the file URL
      return `${this.configService.get('API_URL') || 'https://api.bizcotap.com'}/uploads/userProfile/${filename}`;
    } catch (error) {
      console.error('Full avatar upload error:', error);
      throw new BadRequestException(`Avatar upload failed: ${error.message}`);
    }
  }

  /**
   * Convert file to base64 for direct storage in database
   * Use this alternative if file storage is not feasible
   * @param file The uploaded file
   * @returns Base64 encoded image string
   */
  async convertAvatarToBase64(file: Express.Multer.File): Promise<string> {
    // Apply stricter validation for base64 storage
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const maxSize = 2 * 1024 * 1024; // 2MB - smaller limit for base64
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
    }

    // Optimize and resize image before base64 conversion
    const optimizedBuffer = await sharp(file.buffer)
      .resize(200, 200, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Convert to base64
    const base64Image = `data:${file.mimetype};base64,${optimizedBuffer.toString('base64')}`;
    
    return base64Image;
  }

  /**
   * Updates a tag's avatar
   * @param tagId The tag ID to update
   * @param avatarUrl The new avatar URL
   * @returns Updated tag
   */
  async updateTagAvatar(id: number, avatarUrl: string): Promise<UserTag> {
    // Verify tag exists
    const tag = await this.findTagById(id);
    
    // Get the current avatar URL if it exists
    const currentAvatarUrl = (tag.tagInfo as any)?.avatar;
    
    // If there's an existing avatar that's not a base64 string, try to delete it
    if (currentAvatarUrl && !currentAvatarUrl.startsWith('data:')) {
      try {
        const filename = path.basename(currentAvatarUrl);
        const filePath = path.join(this.uploadDir, filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        // Log but don't fail if old file deletion fails
        console.warn(`Failed to delete old avatar: ${error.message}`);
      }
    }
    
    // Update the tagInfo with the new avatar URL
    const updatedTagInfo = {
      ...(tag.tagInfo as object),
      avatar: avatarUrl
    };
    
    // Update the tag
    return this.prisma.userTag.update({
      where: { id },
      data: {
        tagInfo: updatedTagInfo as InputJsonValue
      }
    });
  }

  // New method to find user by ID with limited information
  async findUserById(userId: number): Promise<UserBasicInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  // New method to find company by ID with limited information
  async findCompanyById(companyId: number): Promise<CompanyBasicInfo> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    return company;
  }

  // === Tag Management ===

  async createTag(createTagDto: CreateTagDto): Promise<UserTag> {
    // Determine role more dynamically
    const role = createTagDto.tagInfo?.role || 
                 (createTagDto.companyId ? 'COMPANY_MEMBER' : 'INDIVIDUAL');
    
    // Remove the strict individual check
    // Verify company exists if companyId is provided
    if (createTagDto.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: createTagDto.companyId }
      });
  
      if (!company) {
        throw new BadRequestException(`Company with ID ${createTagDto.companyId} not found`);
      }
    }
  
    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { id: createTagDto.userId },
    });
  
    // If user doesn't exist, create user
    if (!user) {
      const primaryEmail =
        createTagDto.tagInfo?.emails?.[0]?.value ||
        `imported_user_${Date.now()}@bizcotap.com`;
  
      user = await this.prisma.user.create({
        data: {
          id: createTagDto.userId,
          email: primaryEmail,
          firstName: createTagDto.tagInfo.fname || 'First',
          lastName: createTagDto.tagInfo.lname || 'Last',
          password: null,
          isActive: true,
          // Set role based on company association
          role: createTagDto.companyId ? UserRole.EMPLOYEE : UserRole.INDIVIDUAL,
        },
      });
    }
  
    // Generate a unique TUID
    const tuid = uuidv4();
  
    // Create the tag with updated logic
    const tag = await this.prisma.userTag.create({
      data: {
        tuid,
        userId: createTagDto.userId,
        companyId: createTagDto.companyId, // Allow company association
        tagInfo: {
          ...createTagDto.tagInfo,
          role: role, // Ensure role is set correctly
        },
        isActive: true,
      },
    });
  
    return tag;
  }

  async findAllTags(
    userId?: number,
    companyId?: number,
    isActive?: boolean,
  ): Promise<UserTag[]> {
    const where: Partial<Pick<UserTag, 'userId' | 'companyId' | 'isActive'>> = {};

    if (userId) {
      where.userId = userId;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.userTag.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findTagsByUserRole(
    userId: number,
    userRole: UserRole,
    companyId?: number
  ): Promise<UserTag[]> {
    // For company admins, get all tags from their company
    if ((userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && companyId) {
      return this.findAllTags(undefined, companyId, true);
    }

    // For individual users or employees, return only their tags
    return this.findAllTags(userId, undefined, true);
  }

  async findTagsWithAdvancedFilters(
    options: {
      userId?: number;
      companyId?: number;
      isActive?: boolean;
      tagType?: string;
      searchTerm?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ tags: UserTag[]; total: number; page: number; limit: number }> {
    const { 
      userId, 
      companyId, 
      isActive, 
      tagType, 
      searchTerm, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build the where clause
    const where: any = {};
    
    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;
    if (isActive !== undefined) where.isActive = isActive;
    
    // Add tag type filter if specified
    if (tagType) {
      where.tagInfo = {
        path: ['type'],
        equals: tagType,
      };
    }
    
    // Add search term filter if specified
    if (searchTerm) {
      where.OR = [
        {
          tagInfo: {
            path: ['fname'],
            string_contains: searchTerm,
          },
        },
        {
          tagInfo: {
            path: ['lname'],
            string_contains: searchTerm,
          },
        },
        {
          tagInfo: {
            path: ['company'],
            string_contains: searchTerm,
          },
        },
      ];
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute count query
    const total = await this.prisma.userTag.count({ where });
    
    // Execute findMany query with pagination and sorting
    const tags = await this.prisma.userTag.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });
    
    return {
      tags,
      total,
      page,
      limit,
    };
  }

  async findTagById(id: number): Promise<UserTag> {
    const tag = await this.prisma.userTag.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }

    return tag;
  }

  async findTagByTuid(tuid: string): Promise<UserTag> {
    const tag = await this.prisma.userTag.findUnique({
      where: { tuid },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException(`Tag with TUID ${tuid} not found`);
    }

    return tag;
  }

  async updateTag(id: number, updateTagDto: UpdateTagDto): Promise<UserTag> {
    // Verify tag exists
    await this.findTagById(id);

    return this.prisma.userTag.update({
      where: { id },
      data: updateTagDto,
    });
  }

  async removeTag(id: number): Promise<UserTag> {
    // Verify tag exists
    const tag = await this.findTagById(id);
    
    // If tag has an avatar that's stored as a file (not base64), attempt to delete it
    const avatarUrl = (tag.tagInfo as any)?.avatar;
    if (avatarUrl && !avatarUrl.startsWith('data:')) {
      try {
        const filename = path.basename(avatarUrl);
        const filePath = path.join(this.uploadDir, filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        // Log but don't fail if file deletion fails
        console.warn(`Failed to delete avatar: ${error.message}`);
      }
    }

    return this.prisma.userTag.delete({
      where: { id },
    });
  }

  // === Tag Orders Management ===
// src/tags/tags.service.ts (continued)

  // === Tag Orders Management ===

  async createTagOrder(
    userId: number,
    createTagOrderDto: CreateTagOrderDto,
  ): Promise<TagOrder> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Create the tag order
    const tagOrder = await this.prisma.tagOrder.create({
      data: {
        userId,
        companyId: createTagOrderDto.companyId,
        requestData: createTagOrderDto.requestData,
        status: OrderStatus.PENDING,
      },
    });

    // Notify super admins about the new tag order
    const superAdmins = await this.prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN },
    });

    for (const admin of superAdmins) {
      await this.emailService.sendTagOrderNotificationEmail(admin.email, {
        firstName: admin.firstName,
        lastName: admin.lastName,
        orderId: tagOrder.id,
        requestorName: `${user.firstName} ${user.lastName}`,
        requestorEmail: user.email,
      });
    }

    return tagOrder;
  }

  async findAllTagOrders(
    status?: OrderStatus,
    userId?: number,
    companyId?: number,
  ): Promise<TagOrder[]> {
    const where: Partial<Pick<TagOrder, 'status' | 'userId' | 'companyId'>> = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.tagOrder.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findTagOrderById(id: number): Promise<TagOrder> {
    const tagOrder = await this.prisma.tagOrder.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!tagOrder) {
      throw new NotFoundException(`Tag order with ID ${id} not found`);
    }

    return tagOrder;
  }

  async approveTagOrder(id: number): Promise<TagOrder> {
    // Verify order exists and is pending
    const tagOrder = await this.findTagOrderById(id);

    if (tagOrder.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Tag order with ID ${id} is not in PENDING status`,
      );
    }

    // Begin a transaction to ensure data consistency
    return this.prisma.$transaction(async (prisma) => {
      // Update the order status
      const updatedOrder = await prisma.tagOrder.update({
        where: { id },
        data: {
          status: OrderStatus.APPROVED,
        },
      });

      // Get the user for the tag
      const user = await prisma.user.findUnique({
        where: { id: tagOrder.userId },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${tagOrder.userId} not found`,
        );
      }

      // Generate a unique Tag UUID
      const tuid = uuidv4();

      // Create the actual tag
      const newTag = await prisma.userTag.create({
        data: {
          tuid,
          userId: tagOrder.userId,
          companyId: tagOrder.companyId,
          tagInfo: tagOrder.requestData as InputJsonValue,
          isActive: true,
          tagOrderId: tagOrder.id, // Link to the originating order
        },
      });

      // Send confirmation email to the user
      await this.emailService.sendTagApprovedEmail(user.email, {
        firstName: user.firstName,
        lastName: user.lastName,
        tagId: newTag.tuid,
        setPasswordUrl: `https://app.bizcotap.com/set-password?email=${encodeURIComponent(user.email)}&token=${this.generatePasswordToken(user.email)}`,
      });

      return updatedOrder;
    });
  }

  async rejectTagOrder(id: number): Promise<TagOrder> {
    // Verify order exists and is pending
    const tagOrder = await this.findTagOrderById(id);

    if (tagOrder.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Tag order with ID ${id} is not in PENDING status`,
      );
    }

    // Update the order status
    const updatedOrder = await this.prisma.tagOrder.update({
      where: { id },
      data: {
        status: OrderStatus.REJECTED,
      },
    });

    // Get user for notification
    const user = await this.prisma.user.findUnique({
      where: { id: tagOrder.userId },
    });

    // Send rejection email
    if (user) {
      await this.emailService.sendTagRejectedEmail(user.email, {
        firstName: user.firstName,
        lastName: user.lastName,
        orderId: tagOrder.id,
      });
    }

    return updatedOrder;
  }

  // Helper method to generate a password reset token
  private generatePasswordToken(email: string): string {
    // In a real application, you'd use a JWT or a secure token method
    // This is a simplified example
    const timestamp = Date.now();
    return Buffer.from(`${email}:${timestamp}`).toString('base64');
  }
  
  // === VCard Generation ===
  
  /**
   * Generates a vCard string from tag information
   * Works with both legacy data structure and the new enhanced structure
   */
  generateVCard(tagInfo: Record<string, any>): string {
    const VCF = require('vcf');
    const vcard = new VCF();

    const fname = tagInfo.fname || 'Unknown';
    const lname = tagInfo.lname || 'User';

    // Basic info
    vcard.set('n', `${lname};${fname}`);
    vcard.set('fn', `${fname} ${lname}`);
    
    if (tagInfo.company) {
      vcard.set('org', tagInfo.company);
    }
    
    if (tagInfo.position) {
      vcard.set('title', tagInfo.position);
    }
    
    // Handle emails
    if (tagInfo.emails && tagInfo.emails.length > 0) {
      tagInfo.emails.forEach((email, index) => {
        // Support both simple value and type/value structure
        const emailProperty = vcard.add('email', email.value || email);
        
        if (email.type) {
          emailProperty.setParameter('type', email.type.toLowerCase());
        }
        
        // Mark first email as preferred
        if (index === 0) {
          emailProperty.setParameter('pref', '1');
        }
      });
    }
    
    // Handle phones with special handling for WhatsApp
    if (tagInfo.phones && tagInfo.phones.length > 0) {
      tagInfo.phones.forEach((phone, index) => {
        // Support both simple value and complex structure
        const phoneProperty = vcard.add('tel', phone.value || phone);
        
        // Handle WhatsApp phone numbers
        if (phone.type === 'WHATSAPP' || phone.isWhatsapp) {
          phoneProperty.setParameter('type', ['cell', 'voice', 'whatsapp']);
        } else if (phone.type) {
          phoneProperty.setParameter('type', phone.type.toLowerCase());
        }
        
        // Mark first phone as preferred
        if (index === 0) {
          phoneProperty.setParameter('pref', '1');
        }
      });
    }
    
    // Handle websites with social media info
    if (tagInfo.websites && tagInfo.websites.length > 0) {
      tagInfo.websites.forEach(website => {
        // Support both simple value and complex structure
        const urlProperty = vcard.add('url', website.value || website);
        
        // Add special handling for social media profiles
        if (website.type) {
          switch (website.type) {
            case 'LINKEDIN':
              urlProperty.setParameter('type', 'linkedin');
              break;
            case 'FACEBOOK':
              urlProperty.setParameter('type', 'facebook');
              break;
            case 'TWITTER':
              urlProperty.setParameter('type', 'twitter');
              break;
            case 'INSTAGRAM':
              urlProperty.setParameter('type', 'instagram');
              break;
            case 'GITHUB':
              urlProperty.setParameter('type', 'github');
              break;
            case 'YOUTUBE':
              urlProperty.setParameter('type', 'youtube');
              break;
            case 'TIKTOK':
              urlProperty.setParameter('type', 'tiktok');
              break;
            default:
              urlProperty.setParameter('type', website.type.toLowerCase());
              break;
          }
        }
        
        // If there's display text, add it as a label
        if (website.displayText) {
          urlProperty.setParameter('label', website.displayText);
        }
      });
    }
    
    // Handle addresses
    if (tagInfo.addresses && tagInfo.addresses.length > 0) {
      tagInfo.addresses.forEach((address, index) => {
        // Support both simple value and complex structure
        const addressProperty = vcard.add('adr', address.value || address);
        
        if (address.type) {
          addressProperty.setParameter('type', address.type.toLowerCase());
        }
        
        // Mark first address as preferred
        if (index === 0) {
          addressProperty.setParameter('pref', '1');
        }
      });
    }
    
    // Add notes if available
    if (tagInfo.notes) {
      vcard.set('note', tagInfo.notes);
    }
    
    // Add avatar if available
    if (tagInfo.avatar) {
      vcard.add('photo', tagInfo.avatar);
    }
    
    // Add birthday if available
    if (tagInfo.dob) {
      const date = new Date(tagInfo.dob);
      const formattedDate = date.toISOString().split('T')[0].replace(/-/g, '');
      vcard.set('bday', formattedDate);
    }

    return vcard.toString();
  }
}