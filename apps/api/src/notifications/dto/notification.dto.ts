import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsOptional()
  link?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateNotificationDto {
  @IsBoolean()
  @IsOptional()
  read?: boolean;
}
