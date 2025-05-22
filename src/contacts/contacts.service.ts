import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findCompanyContacts(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }

    const contacts = await this.prisma.findContactsByCompanyId(companyId);

    return contacts.map(contact => ({
      id: contact.id,
      names: contact.names,
      email: contact.email,
      phoneNumber: contact.phoneNumber,
      companyName: contact.userTag?.company?.name || 'N/A',
      createdAt: contact.createdAt
    }));
  }
}