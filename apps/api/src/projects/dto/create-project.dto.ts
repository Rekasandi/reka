import { IsString, IsNotEmpty, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ENTITY_ICON_NAMES } from '@reka/types';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  @IsIn(ENTITY_ICON_NAMES)
  icon?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['planned', 'in_progress', 'paused', 'completed', 'canceled'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['on_track', 'at_risk', 'off_track'])
  health?: string;

  @IsString()
  @IsOptional()
  @IsIn(['no_priority', 'low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsDateString({ strict: true })
  @IsOptional()
  startDate?: string | null;

  @IsDateString({ strict: true })
  @IsOptional()
  targetDate?: string | null;
}
