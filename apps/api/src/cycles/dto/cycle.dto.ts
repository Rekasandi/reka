import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsDateString, IsInt, IsUUID, MaxLength, Max, Min } from 'class-validator';

export class CreateCycleDto {
  @IsString() @IsOptional() @MaxLength(255) name?: string;
  @IsString() @IsOptional() @MaxLength(10000) description?: string;
  @IsDateString({ strict: true }) startDate!: string;
  @IsDateString({ strict: true }) endDate!: string;
  @IsUUID() teamId!: string;
  @IsOptional() @IsInt() @Min(0) @Max(10000) capacity?: number | null;
}

export class UpdateCycleDto {
  @IsString() @IsOptional() @MaxLength(255) name?: string;
  @IsString() @IsOptional() @MaxLength(10000) description?: string;
  @IsDateString({ strict: true }) @IsOptional() startDate?: string;
  @IsDateString({ strict: true }) @IsOptional() endDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10000) capacity?: number | null;
}

export class CompleteCycleDto {
  @IsString() @IsNotEmpty() @IsIn(['backlog', 'next_cycle']) incompleteIssuesAction!: 'backlog' | 'next_cycle';
  @IsUUID() @IsOptional() nextCycleId?: string;
}

export class TeamCycleSettingsDto {
  @IsString() @IsNotEmpty() timezone!: string;
  @IsInt() @Min(1) @Max(90) durationDays!: number;
  @IsInt() @Min(0) @Max(90) cooldownDays!: number;
  @IsDateString({ strict: true }) nextStartDate!: string;
  @IsBoolean() autoCreate!: boolean;
}
