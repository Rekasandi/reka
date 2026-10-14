import { IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

export class AcceptTriageIssueDto {
  @IsString() @Matches(/^[a-z][a-z0-9_]{0,31}$/) @IsOptional()
  status?: string;

  @IsUUID() @IsOptional()
  teamId?: string;

  @IsUUID() @IsOptional()
  projectId?: string | null;

  @IsUUID() @IsOptional()
  cycleId?: string | null;

  @IsUUID() @IsOptional()
  assigneeId?: string | null;
}

export class DeclineTriageIssueDto {
  @IsString() @MaxLength(500) @IsOptional()
  reason?: string;
}

export class DuplicateTriageIssueDto {
  @IsUUID()
  relatedIssueId!: string;

  @IsString() @MaxLength(500) @IsOptional()
  reason?: string;
}
