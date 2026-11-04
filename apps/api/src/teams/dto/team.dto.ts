import { IsString, IsNotEmpty, IsOptional, MaxLength, IsIn, IsBoolean, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ENTITY_ICON_NAMES, ESTIMATE_SCALES } from '@reka/types';

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

  @IsBoolean()
  @IsOptional()
  cyclesEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  estimatesEnabled?: boolean;

  @IsString()
  @IsOptional()
  @IsIn([...ESTIMATE_SCALES])
  estimateScale?: string;

  @IsBoolean()
  @IsOptional()
  autoCloseParent?: boolean;

  /** Months of inactivity before closed issues are archived; null turns auto-archive off. */
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  autoArchiveMonths?: number | null;

  @IsBoolean()
  @IsOptional()
  autoCloseChildren?: boolean;

  /** Months of inactivity before open backlog/unstarted/triage issues are canceled; null turns it off. */
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  autoCloseStaleMonths?: number | null;

  @IsBoolean()
  @IsOptional()
  triageEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  slaEnabled?: boolean;

  /** Workflow state keys; null = automatic. The service checks each against the team workflow. */
  @IsString()
  @MaxLength(32)
  @IsOptional()
  defaultStatus?: string | null;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  duplicateStatus?: string | null;

  /** GitHub targets: null = automatic, '-' = no status change, otherwise a workflow state key. */
  @IsString()
  @MaxLength(32)
  @IsOptional()
  githubDraftStatus?: string | null;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  githubOpenStatus?: string | null;

  @IsString()
  @MaxLength(32)
  @IsOptional()
  githubMergedStatus?: string | null;
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
