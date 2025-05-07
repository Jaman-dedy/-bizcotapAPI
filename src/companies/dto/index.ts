import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsUrl,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

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
  @IsUrl()
  website?: string;

  @ApiProperty({ 
    example: 'Technology', 
    required: false,
    description: 'Industry from the predefined list'
  })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiProperty({ example: 1, description: 'Owner user ID' })
  @IsNotEmpty()
  @Transform(({ value }) => {
    // Convert string to number for form-data compatibility
    if (typeof value === 'string') {
      return parseInt(value, 10);
    }
    return value;
  })
  @Type(() => Number)
  @IsNumber()
  ownerId: number;
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export class AddEmployeeDto {
  @ApiProperty({
    example: [1, 2, 3],
    description: 'Array of user IDs to add as employees',
  })
  @IsArray()
  @Transform(({ value }) => {
    // Handle both array of strings and comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map(id => parseInt(id.trim(), 10));
    }
    return value;
  })
  @Type(() => Number)
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

  @ApiProperty({ example: 'Technology' })
  industry?: string;

  @ApiProperty({ example: 1 })
  ownerId: number;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ required: false })
  employees?: any[];

  @ApiProperty({ required: false })
  owner?: any;
}