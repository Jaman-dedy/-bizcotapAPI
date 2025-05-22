import { ApiProperty } from '@nestjs/swagger';

export class ContactResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  names: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: '+1234567890' })
  phoneNumber: string;

  @ApiProperty({ example: 'Acme Corporation' })
  companyName: string;

  @ApiProperty({ example: '2023-01-01T00:00:00Z' })
  createdAt: Date;
}