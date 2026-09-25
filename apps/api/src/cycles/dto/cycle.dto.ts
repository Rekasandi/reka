import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateCycleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @IsString()
  @IsOptional()
  teamId?: string;
}

export class UpdateCycleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}

export class CompleteCycleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['backlog', 'next_cycle'])
  incompleteIssuesAction!: 'backlog' | 'next_cycle';

  @IsString()
  @IsOptional()
  nextCycleId?: string;
}
