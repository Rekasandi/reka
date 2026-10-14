import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TeamWorkflowStateDto {
  @IsString() @Matches(/^[a-z][a-z0-9_]{0,31}$/)
  key!: string;

  @IsString() @Matches(/\S/) @MaxLength(64)
  name!: string;

  @IsIn(['triage', 'backlog', 'unstarted', 'started', 'completed', 'canceled'])
  category!: string;

  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/)
  color!: string;

  @IsInt() @Min(0)
  position!: number;

  @IsBoolean()
  isActive!: boolean;
}

export class UpdateTeamWorkflowStatesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(16) @ArrayUnique((state: TeamWorkflowStateDto) => state.key)
  @ValidateNested({ each: true }) @Type(() => TeamWorkflowStateDto)
  states!: TeamWorkflowStateDto[];
}
