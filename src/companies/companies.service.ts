import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateCompanyDto, UpdateCompanyDto, AddEmployeeDto } from './dto';
import { Company, UserRole } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CompaniesService {
  // Predefined list of industries for dropdown
  private readonly industries = [
    'Technology',
    'Healthcare',
    'Finance',
    'Education',
    'Retail',
    'Manufacturing',
    'Entertainment',
    'Construction',
    'Food & Beverage',
    'Consulting',
    'Transportation',
    'Energy',
    'Agriculture',
    'Real Estate',
    'Telecommunications',
    'Media',
    'Hospitality',
    'Legal',
    'Insurance',
    'Other'
  ];
  
  constructor(private prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<any> {
    // Verify owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: createCompanyDto.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(
        `User with ID ${createCompanyDto.ownerId} not found`,
      );
    }

    // Validate industry if provided
    if (createCompanyDto.industry && !this.industries.includes(createCompanyDto.industry)) {
      throw new ConflictException(`Industry "${createCompanyDto.industry}" is not valid`);
    }

    // Create the company
    const company = await this.prisma.company.create({
      data: {
        name: createCompanyDto.name,
        logo: createCompanyDto.logo,
        website: createCompanyDto.website,
        industry: createCompanyDto.industry,
        ownerId: createCompanyDto.ownerId,
      },
      include: {
        employees: {
          select: {
            id: true,
          },
        },
      },
    });

    // Update the owner's role to COMPANY_ADMIN if not already SUPER_ADMIN
    if (owner.role !== UserRole.SUPER_ADMIN) {
      await this.prisma.user.update({
        where: { id: owner.id },
        data: { role: UserRole.COMPANY_ADMIN },
      });
    }

    return company;
  }

  async findAll(): Promise<any[]> {
    return this.prisma.company.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        employees: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async findOne(id: number): Promise<any> {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        employees: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }

    return company;
  }

  async update(
    id: number,
    updateCompanyDto: UpdateCompanyDto,
  ): Promise<any> {
    // Verify company exists
    await this.findOne(id);

    // Validate industry if provided
    if (updateCompanyDto.industry && !this.industries.includes(updateCompanyDto.industry)) {
      throw new ConflictException(`Industry "${updateCompanyDto.industry}" is not valid`);
    }

    // Update company
    const updatedCompany = await this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        employees: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    return updatedCompany;
  }

  async remove(id: number): Promise<any> {
    // Verify company exists
    await this.findOne(id);

    // Remove company
    return this.prisma.company.delete({
      where: { id },
      include: {
        employees: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  async addEmployees(
    id: number,
    addEmployeeDto: AddEmployeeDto,
  ): Promise<any> {
    // Verify company exists
    const company = await this.findOne(id);

    // Add employees
    for (const userId of addEmployeeDto.userIds) {
      try {
        // Verify user exists
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Update user's company
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            companyId: company.id,
            role: UserRole.EMPLOYEE,
          },
        });
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new ConflictException(
          `Failed to add user with ID ${userId} to company`,
        );
      }
    }

    // Return updated company
    return this.findOne(id);
  }

  async removeEmployee(companyId: number, userId: number): Promise<void> {
    // Verify company exists
    const company = await this.findOne(companyId);

    // Verify user is an employee of the company
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId: company.id,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${userId} is not an employee of this company`,
      );
    }

    // Remove user from company
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        companyId: null,
        role: UserRole.INDIVIDUAL,
      },
    });
  }
  
  // Get list of available industries for dropdown
  async getIndustries(): Promise<string[]> {
    return this.industries;
  }

  // Get list of potential company owners for dropdown
  async getPotentialOwners() {
    return this.prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.SUPER_ADMIN },
          { role: UserRole.COMPANY_ADMIN },
          { role: UserRole.INDIVIDUAL }
        ]
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      },
      orderBy: {
        lastName: 'asc'
      }
    });
  }
}