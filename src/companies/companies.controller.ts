import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  AddEmployeeDto,
  CompanyResponseDto,
} from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Define an interface for the authenticated request
interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    role: UserRole;
  };
  protocol: string;
  get(name: string): string;
}

@ApiTags('companies')
@Controller('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  // Helper method to get base URL dynamically
  private getBaseUrl(req: AuthenticatedRequest): string {
    const protocol = process.env.PROTOCOL || req.protocol;
    const host = req.get('host');
    return `${protocol}://${host}`;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new company with logo (Super Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Acme Corporation' },
        industry: { 
          type: 'string', 
          example: 'Technology',
          description: 'Industry from the predefined list'
        },
        website: { type: 'string', example: 'https://example.com' },
        ownerId: { type: 'integer', example: 1 },
        logo: { type: 'string', format: 'binary' }
      },
      required: ['name', 'ownerId']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './public/companies/logos',
        filename: (req, file, cb) => {
          // Generate a unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `company-logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Check if the file is an image
        if (file && !file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 5, // 5MB max file size
      },
    }),
  )
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    // If a logo file was uploaded, add the path to the DTO
    if (file) {
      const baseUrl = this.getBaseUrl(req);
      const logoUrl = `${baseUrl}/public/companies/logos/${file.filename}`;
      createCompanyDto.logo = logoUrl;
    }
    
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all companies (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of companies',
    type: [CompanyResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async findAll() {
    return this.companiesService.findAll();
  }

  @Get('industries')
  @ApiOperation({ summary: 'Get list of available industries' })
  @ApiResponse({
    status: 200,
    description: 'List of industries',
    type: [String],
  })
  async getIndustries() {
    return this.companiesService.getIndustries();
  }

  @Get('owners')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get list of potential company owners (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of potential owners',
  })
  async getPotentialOwners() {
    return this.companiesService.getPotentialOwners();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by ID' })
  @ApiResponse({
    status: 200,
    description: 'Company details',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(
    @Param('id') id: string, 
    @Req() req: AuthenticatedRequest
  ) {
    const company = await this.companiesService.findOne(+id);

    // Verify the company has employees property
    if (!company.employees) {
      company.employees = [];
    }

    // Check if user has permission to view this company
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      !(
        company.ownerId === req.user.id ||
        company.employees.some((e) => e.id === req.user.id)
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this company',
      );
    }

    return company;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company including logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Company Name' },
        industry: { type: 'string', example: 'Technology' },
        website: { type: 'string', example: 'https://example.com' },
        ownerId: { type: 'integer', example: 1 },
        logo: { type: 'string', format: 'binary' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Company updated successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: diskStorage({
        destination: './public/companies/logos',
        filename: (req, file, cb) => {
          // Generate a unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `company-logo-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Check if the file is an image
        if (file && !file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 5, // 5MB max file size
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    const company = await this.companiesService.findOne(+id);

    // Check if user has permission to update this company
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      company.ownerId !== req.user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to update this company',
      );
    }

    // Only super admins can change owner
    if (
      updateCompanyDto.ownerId &&
      updateCompanyDto.ownerId !== company.ownerId &&
      req.user.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Only super admins can change company ownership',
      );
    }

    // If a logo file was uploaded, add the path to the DTO
    if (file) {
      const baseUrl = this.getBaseUrl(req);
      const logoUrl = `${baseUrl}/public/companies/logos/${file.filename}`;
      updateCompanyDto.logo = logoUrl;
    }

    return this.companiesService.update(+id, updateCompanyDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a company (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Company deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async remove(@Param('id') id: string) {
    return this.companiesService.remove(+id);
  }

  @Post(':id/employees')
  @ApiOperation({ summary: 'Add employees to a company' })
  @ApiResponse({
    status: 200,
    description: 'Employees added successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async addEmployees(
    @Param('id') id: string,
    @Body() addEmployeeDto: AddEmployeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const company = await this.companiesService.findOne(+id);

    // Ensure employees property exists
    if (!company.employees) {
      company.employees = [];
    }

    // Check if user has permission to add employees
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.role !== UserRole.COMPANY_ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to add employees',
      );
    }

    // Company admins can only add employees to their own company
    if (
      req.user.role === UserRole.COMPANY_ADMIN &&
      company.ownerId !== req.user.id
    ) {
      throw new ForbiddenException(
        'You can only add employees to your own company',
      );
    }

    return this.companiesService.addEmployees(+id, addEmployeeDto);
  }

  @Delete(':id/employees/:userId')
  @ApiOperation({ summary: 'Remove an employee from a company' })
  @ApiResponse({ status: 200, description: 'Employee removed successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Company or employee not found' })
  async removeEmployee(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const company = await this.companiesService.findOne(+id);

    // Ensure employees property exists
    if (!company.employees) {
      company.employees = [];
    }

    // Check if user has permission to remove employees
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.role !== UserRole.COMPANY_ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to remove employees',
      );
    }

    // Company admins can only remove employees from their own company
    if (
      req.user.role === UserRole.COMPANY_ADMIN &&
      company.ownerId !== req.user.id
    ) {
      throw new ForbiddenException(
        'You can only remove employees from your own company',
      );
    }

    await this.companiesService.removeEmployee(+id, +userId);

    return { message: 'Employee removed successfully' };
  }
}