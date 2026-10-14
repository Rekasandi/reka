import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateNotificationDto {
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
  @IsBoolean() @IsOptional() read?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsBoolean() comments!: boolean;
  @IsBoolean() mentions!: boolean;
  @IsBoolean() assignments!: boolean;
  @IsBoolean() issueUpdates!: boolean;
  @IsBoolean() projectUpdates!: boolean;
  @IsBoolean() github!: boolean;
  @IsBoolean() teamInvites!: boolean;
}
