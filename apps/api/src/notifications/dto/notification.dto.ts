import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString, ValidateIf } from 'class-validator';

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

/** `until` null unsnoozes; future/1-year bounds are enforced in the service. */
export class SnoozeNotificationDto {
  @ValidateIf((_, value) => value !== null) @IsDateString() until!: string | null;
}

export class UpdateNotificationPreferencesDto {
  @IsBoolean() comments!: boolean;
  @IsBoolean() mentions!: boolean;
  @IsBoolean() assignments!: boolean;
  @IsBoolean() issueUpdates!: boolean;
  @IsBoolean() projectUpdates!: boolean;
  @IsBoolean() github!: boolean;
  @IsBoolean() teamInvites!: boolean;
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
}
