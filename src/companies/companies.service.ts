import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateCompanyDto, UpdateCompanyDto, AddEmployeeDto } from './dto';
import { Company, UserRole } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    // Verify owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: createCompanyDto.ownerId },
    });

    if (!owner) {
      throw new NotFoundException(`User with ID ${createCompanyDto.ownerId} not found`);
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

  async findAll(): Promise<Company[]> {
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

  async findOne(id: number): Promise<Company> {
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

  async update(id: number, updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    // Verify company exists
    await this.findOne(id);

    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });
  }

  async remove(id: number): Promise<Company> {
    // Verify company exists
    await this.findOne(id);

    // Remove company
    return this.prisma.company.delete({
      where: { id },
    });
  }

  async addEmployees(id: number, addEmployeeDto: AddEmployeeDto): Promise<Company> {
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
        throw new ConflictException(`Failed to add user with ID ${userId} to company`);
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
      throw new NotFoundException(`User with ID ${userId} is not an employee of this company`);
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
}