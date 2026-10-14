import { IsString, IsNotEmpty, IsOptional, MaxLength, IsIn, IsBoolean, IsUUID } from 'class-validator';
import { ENTITY_ICON_NAMES } from '@reka/types';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  key!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  key?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(ENTITY_ICON_NAMES)
  icon?: string;
}

export class AddTeamMemberDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsOptional()
  @IsIn(['lead', 'member', 'viewer'])
  role?: string;
}

export class UpdateTeamMemberDto {
  @IsIn(['lead', 'member', 'viewer'])
  role!: 'lead' | 'member' | 'viewer';
}
