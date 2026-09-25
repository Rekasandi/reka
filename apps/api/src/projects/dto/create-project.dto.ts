import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

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
  @IsOptional()
  teamId?: string;

  @IsString()
  @IsOptional()
  targetDate?: string;
}
