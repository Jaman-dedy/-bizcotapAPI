import { IsNotEmpty, IsString, IsEmail, IsOptional, IsNumber, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExchangeDto {
  @ApiProperty({ description: 'Tag TUID that was scanned', example: 'abc123-def456' })
  @IsString()
  @IsNotEmpty()
  tagTuid: string;

  @ApiProperty({ description: 'Full name of the person', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  names: string;

  @ApiProperty({ description: 'Email address', example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number', example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({ description: 'Longitude of the exchange location', required: false, example: 42.12345 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiProperty({ description: 'Latitude of the exchange location', required: false, example: -71.12345 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiProperty({ description: 'Additional information', required: false, type: Object })
  @IsObject()
  @IsOptional()
  additionalInfo?: Record<string, any>;
}

export class ExchangeResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  names: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: '+1234567890' })
  phoneNumber: string;

  @ApiProperty({ example: 42.12345, required: false })
  longitude?: number;

  @ApiProperty({ example: -71.12345, required: false })
  latitude?: number;

  @ApiProperty({ example: { linkedIn: 'https://linkedin.com/in/johndoe' }, required: false })
  additionalInfo?: Record<string, any>;

  @ApiProperty({ example: 1 })
  userTagId: number;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 2, required: false })
  senderId?: number;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;
}

export class ExchangeQueryDto {
  @ApiProperty({ required: false, description: 'Filter by tag ID' })
  @IsString()
  @IsOptional()
  tagTuid?: string;

  @ApiProperty({ required: false, description: 'Search by name or email' })
  @IsString()
  @IsOptional()
  search?: string;
}