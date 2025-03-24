import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTagDto, UpdateTagDto, CreateTagOrderDto, UpdateTagOrderDto } from './dto';
import { UserTag, TagOrder, OrderStatus, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from 'prisma/prisma.service';
import { EmailService } from 'src/email/email.service';
import { InputJsonValue } from '@prisma/client/runtime/library';

@Injectable()
export class TagsController {  // Ensure this line has the 'export' keyword
    constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // New method to find user by ID with limited information
  async findUserById(userId: number) {
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
  async findCompanyById(companyId: number) {
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
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createTagDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createTagDto.userId} not found`);
    }

    // Generate a unique Tag UUID
    const tuid = uuidv4();

    // Create the tag
    const tag = await this.prisma.userTag.create({
      data: {
        tuid,
        userId: createTagDto.userId,
        companyId: createTagDto.companyId,
        tagInfo: createTagDto.tagInfo,
        isActive: true,
      },
    });

    // Send notification email to the user
    await this.emailService.sendTagCreatedEmail(user.email, {
      firstName: user.firstName,
      lastName: user.lastName,
      tagId: tag.tuid,
    });

    return tag;
  }

  async findAllTags(
    userId?: number,
    companyId?: number,
    isActive?: boolean,
  ): Promise<UserTag[]> {
    const where: any = {};

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
    await this.findTagById(id);

    return this.prisma.userTag.delete({
      where: { id },
    });
  }

  // === Tag Orders Management ===

  async createTagOrder(userId: number, createTagOrderDto: CreateTagOrderDto): Promise<TagOrder> {
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
    const where: any = {};

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
      throw new BadRequestException(`Tag order with ID ${id} is not in PENDING status`);
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
        throw new NotFoundException(`User with ID ${tagOrder.userId} not found`);
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
      throw new BadRequestException(`Tag order with ID ${id} is not in PENDING status`);
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
}