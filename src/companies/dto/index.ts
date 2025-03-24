import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiProperty({ example: 'https://example.com', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ example: 'Technology', required: false })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiProperty({ example: 1, description: 'Owner user ID' })
  @IsNumber()
  @IsNotEmpty()
  ownerId: number;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class AddEmployeeDto {
  @ApiProperty({ example: [1, 2, 3], description: 'Array of user IDs to add as employees' })
  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  userIds: number[];
}

export class CompanyResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Acme Corporation' })
  name: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  logo?: string;

  @ApiProperty({ example: 'https://example.com', required: false })
  website?: string;

  @ApiProperty({ example: 'Technology', required: false })
  industry?: string;

  @ApiProperty({ example: 1 })
  ownerId: number;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;
}