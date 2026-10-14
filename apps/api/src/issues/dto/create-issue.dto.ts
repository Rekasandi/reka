import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, IsUUID, IsArray, ArrayUnique, ArrayMaxSize, MaxLength, Max, Min, IsDateString, Matches } from 'class-validator';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/\S/)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,31}$/)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['no_priority', 'low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsString()
  @IsOptional()
  @IsIn(['task', 'bug', 'feature', 'improvement', 'chore'])
  type?: string;

  @IsUUID()
  teamId!: string;

  @IsUUID()
  @IsOptional()
  projectId?: string | null;

  @IsUUID()
  @IsOptional()
  assigneeId?: string | null;

  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @IsUUID()
  @IsOptional()
  cycleId?: string | null;

  @IsUUID()
  @IsOptional()
  milestoneId?: string | null;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  estimate?: number | null;

  @IsDateString({ strict: true })
  @IsOptional()
  dueDate?: string | null;

  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  labelIds?: string[];
}
