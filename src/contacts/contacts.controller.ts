import {
    Controller,
    Get,
    Param,
    UseGuards,
    Req,
    ForbiddenException,
    HttpStatus,
    NotFoundException,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
  } from '@nestjs/swagger';
  import { UserRole } from '@prisma/client';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  import { ContactsService } from './contacts.service';
  import { ContactResponseDto } from './dto';
import { PrismaService } from 'prisma/prisma.service';
  
  interface AuthenticatedRequest extends Request {
    user: {
      id: number;
      role: UserRole;
    };
  }
  
  @ApiTags('contacts')
  @Controller('contacts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  export class ContactsController {
    constructor(
      private readonly contactsService: ContactsService,
      private readonly prisma: PrismaService
    ) {}
  
    @Get('company/:id')
    @ApiOperation({ summary: 'Get all contacts associated with a company through tags' })
    @ApiParam({ name: 'id', description: 'Company ID' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'List of contacts with name, email, phone, and company',
      type: [ContactResponseDto],
    })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Company not found' })
    @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden - Insufficient permissions' })
    async getCompanyContacts(
      @Param('id') id: string,
      @Req() req: AuthenticatedRequest,
    ) {
      const company = await this.prisma.company.findUnique({
        where: { id: +id },
        include: {
          employees: {
            select: { id: true }
          }
        }
      });
  
      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }
  
      if (
        req.user.role !== UserRole.SUPER_ADMIN &&
        !(
          company.ownerId === req.user.id ||
          company.employees.some((e) => e.id === req.user.id)
        )
      ) {
        throw new ForbiddenException(
          'You do not have permission to view this company\'s contacts'
        );
      }
  
      return this.contactsService.findCompanyContacts(+id);
    }
  }