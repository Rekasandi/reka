import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled', 'blocked'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['no_priority', 'low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsString()
  @IsOptional()
  @IsIn(['task', 'bug', 'feature', 'improvement', 'chore'])
  type?: string;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  cycleId?: string;
}
