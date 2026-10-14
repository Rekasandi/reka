import { IsIn, IsUUID } from 'class-validator';

export class CreateIssueRelationDto {
  @IsUUID()
  relatedIssueId!: string;

  @IsIn(['blocks', 'blocked_by', 'related_to', 'duplicate'])
  type!: 'blocks' | 'blocked_by' | 'related_to' | 'duplicate';
}
