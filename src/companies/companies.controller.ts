import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    ForbiddenException,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
  import { UserRole } from '@prisma/client';
  
  import { CompaniesService } from './companies.service';
  import { CreateCompanyDto, UpdateCompanyDto, AddEmployeeDto, CompanyResponseDto } from './dto';
  import { RolesGuard } from '../auth/guards/roles.guard';
  import { Roles } from '../common/decorators/roles.decorator';
  
  @ApiTags('companies')
  @Controller('companies')
  @ApiBearerAuth()
  export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) {}
  
    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Create a new company (Super Admin only)' })
    @ApiResponse({ status: 201, description: 'Company created successfully', type: CompanyResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    async create(@Body() createCompanyDto: CreateCompanyDto) {
      return this.companiesService.create(createCompanyDto);
    }
  
    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get all companies (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'List of companies', type: [CompanyResponseDto] })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    async findAll() {
      return this.companiesService.findAll();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get a company by ID' })
    @ApiResponse({ status: 200, description: 'Company details', type: CompanyResponseDto })
    @ApiResponse({ status: 404, description: 'Company not found' })
    async findOne(@Param('id') id: string, @Request() req: any) {
      const company = await this.companiesService.findOne(+id) as { id: number; createdAt: Date; updatedAt: Date; name: string; logo: string | null; website: string | null; industry: string | null; dataProcessingAgreement: boolean; dataProcessingDate: Date | null; ownerId: number; employees: { id: number }[] };
      
      // Check if user has permission to view this company
      if (req.user.role !== UserRole.SUPER_ADMIN &&
          !(company.ownerId === req.user.id || company.employees.some(e => e.id === req.user.id))) {
        throw new ForbiddenException('You do not have permission to view this company');
      }
      
      return company;
    }
  
    @Patch(':id')
    @ApiOperation({ summary: 'Update a company' })
    @ApiResponse({ status: 200, description: 'Company updated successfully', type: CompanyResponseDto })
    @ApiResponse({ status: 404, description: 'Company not found' })
    async update(
      @Param('id') id: string,
      @Body() updateCompanyDto: UpdateCompanyDto,
      @Request() req: any
    ) {
      const company = await this.companiesService.findOne(+id);
      
      // Check if user has permission to update this company
      if (req.user.role !== UserRole.SUPER_ADMIN && company.ownerId !== req.user.id) {
        throw new ForbiddenException('You do not have permission to update this company');
      }
      
      // Only super admins can change owner
      if (updateCompanyDto.ownerId && 
          updateCompanyDto.ownerId !== company.ownerId && 
          req.user.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admins can change company ownership');
      }
      
      return this.companiesService.update(+id, updateCompanyDto);
    }
  
    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Delete a company (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Company deleted successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Company not found' })
    async remove(@Param('id') id: string) {
      return this.companiesService.remove(+id);
    }
  
    @Post(':id/employees')
    @ApiOperation({ summary: 'Add employees to a company' })
    @ApiResponse({ status: 200, description: 'Employees added successfully', type: CompanyResponseDto })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Company not found' })
    async addEmployees(
      @Param('id') id: string,
      @Body() addEmployeeDto: AddEmployeeDto,
      @Request() req: any
    ) {
      const company = await this.companiesService.findOne(+id);
      
      // Check if user has permission to add employees
      if (req.user.role !== UserRole.SUPER_ADMIN && 
          req.user.role !== UserRole.COMPANY_ADMIN) {
        throw new ForbiddenException('You do not have permission to add employees');
      }
      
      // Company admins can only add employees to their own company
      if (req.user.role === UserRole.COMPANY_ADMIN && company.ownerId !== req.user.id) {
        throw new ForbiddenException('You can only add employees to your own company');
      }
      
      return this.companiesService.addEmployees(+id, addEmployeeDto);
    }
  
    @Delete(':id/employees/:userId')
    @ApiOperation({ summary: 'Remove an employee from a company' })
    @ApiResponse({ status: 200, description: 'Employee removed successfully' })
    @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
    @ApiResponse({ status: 404, description: 'Company or employee not found' })
    async removeEmployee(
      @Param('id') id: string,
      @Param('userId') userId: string,
      @Request() req: any
    ) {
      const company = await this.companiesService.findOne(+id);
      
      // Check if user has permission to remove employees
      if (req.user.role !== UserRole.SUPER_ADMIN && 
          req.user.role !== UserRole.COMPANY_ADMIN) {
        throw new ForbiddenException('You do not have permission to remove employees');
      }
      
      // Company admins can only remove employees from their own company
      if (req.user.role === UserRole.COMPANY_ADMIN && company.ownerId !== req.user.id) {
        throw new ForbiddenException('You can only remove employees from your own company');
      }
      
      await this.companiesService.removeEmployee(+id, +userId);
      
      return { message: 'Employee removed successfully' };
    }
  }