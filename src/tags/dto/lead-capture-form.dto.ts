import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { UUID } from 'crypto';

export class CreateFormConfigDto {
  @ApiProperty({ 
    description: 'Tag UUID/TUID this form belongs to',
    example: 'fd6d436d-e99e-470f-bba6-e2d59b756fe2'
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID('4', { message: 'tagId must be a valid UUID (v4 format)' })
  tagId: string;

  @ApiProperty({ description: 'Form title', default: 'Contact Me', required: false })
  @IsString()
  @IsOptional()
  formTitle?: string;

  @ApiProperty({ description: 'Name field value (null when disabled, "value" when enabled)', required: false, nullable: true })
  @IsString()
  @IsOptional()
  nameField?: string | null;

  @ApiProperty({ description: 'Email field value (null when disabled, "value" when enabled)', required: false, nullable: true })
  @IsString()
  @IsOptional()
  emailField?: string | null;

  @ApiProperty({ description: 'Phone field value (null when disabled, "value" when enabled)', required: false, nullable: true })
  @IsString()
  @IsOptional()
  phoneField?: string | null;

  @ApiProperty({ description: 'Company field value (null when disabled, "value" when enabled)', required: false, nullable: true })
  @IsString()
  @IsOptional()
  companyField?: string | null;

  @ApiProperty({ description: 'Message field value (null when disabled, "value" when enabled)', required: false, nullable: true })
  @IsString()
  @IsOptional()
  messageField?: string | null;

  @ApiProperty({ description: 'Text for the submit button', default: 'Submit', required: false })
  @IsString()
  @IsOptional()
  submitButtonText?: string;

  @ApiProperty({ description: 'Thank you message shown after submission', default: 'Thank you for your message. I will get back to you soon!', required: false })
  @IsString()
  @IsOptional()
  thankYouMessage?: string;
}

export class UpdateFormConfigDto extends PartialType(CreateFormConfigDto) {
  // All fields are optional for updates
}

export class FormConfigResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'fd6d436d-e99e-470f-bba6-e2d59b756fe2' })
  tagId: string;

  @ApiProperty({ example: 'Contact Me' })
  formTitle: string;

  @ApiProperty({ example: 'value', nullable: true })
  nameField: string | null;

  @ApiProperty({ example: 'value', nullable: true })
  emailField: string | null;

  @ApiProperty({ example: null, nullable: true })
  phoneField: string | null;

  @ApiProperty({ example: null, nullable: true })
  companyField: string | null;

  @ApiProperty({ example: 'value', nullable: true })
  messageField: string | null;

  @ApiProperty({ example: 'Submit' })
  submitButtonText: string;

  @ApiProperty({ example: 'Thank you for your message. I will get back to you soon!' })
  thankYouMessage: string;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
