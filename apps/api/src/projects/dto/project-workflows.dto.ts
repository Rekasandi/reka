import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsDateString({ strict: true }) targetDate?: string | null;
}

export class UpdateMilestoneDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string | null;
  @IsOptional() @IsDateString({ strict: true }) targetDate?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(100000) position?: number;
}

export class CreateProjectDependencyDto {
  @IsUUID() dependsOnProjectId!: string;
}

export class CreateProjectUpdateDto {
  @IsString() @MinLength(1) @MaxLength(10000) body!: string;
  @IsIn(['on_track', 'at_risk', 'off_track']) health!: 'on_track' | 'at_risk' | 'off_track';
}

export class UpdateProjectUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10000) body?: string;
  @IsOptional() @IsIn(['on_track', 'at_risk', 'off_track']) health?: 'on_track' | 'at_risk' | 'off_track';
}
