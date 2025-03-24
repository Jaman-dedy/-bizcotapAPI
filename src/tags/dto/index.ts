import { IsNotEmpty, IsString, IsOptional, IsObject, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class CreateTagDto {
  @ApiProperty({ description: 'User ID who owns this tag' })
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @ApiProperty({ description: 'Company ID (optional)', required: false })
  @IsNumber()
  @IsOptional()
  companyId?: number;

  @ApiProperty({ description: 'Tag information (stored as JSON)', type: 'object', additionalProperties: true })
  @IsObject()
  @IsNotEmpty()
  tagInfo: Record<string, any>;
}

export class UpdateTagDto extends PartialType(CreateTagDto) {
  @ApiProperty({ description: 'Whether the tag is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateTagOrderDto {
  @ApiProperty({ description: 'Request data for the tag order (stored as JSON)', type: 'object', additionalProperties: true })
  @IsObject()
  @IsNotEmpty()
  requestData: Record<string, any>;

  @ApiProperty({ description: 'Company ID (optional)', required: false })
  @IsNumber()
  @IsOptional()
  companyId?: number;
}

export class UpdateTagOrderDto {
  @ApiProperty({ enum: OrderStatus, description: 'Status of the order' })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;
}

export class TagResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'abc123-def456' })
  tuid: string;

  @ApiProperty({ example: { socialLinks: [], displayName: 'John Doe' }, type: 'object', additionalProperties: true })
  tagInfo: Record<string, any>;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1, required: false })
  companyId?: number;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class TagOrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: { socialLinks: [], displayName: 'John Doe' }, type: 'object', additionalProperties: true })
  requestData: Record<string, any>;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status: OrderStatus;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 1, required: false })
  companyId?: number;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;
}