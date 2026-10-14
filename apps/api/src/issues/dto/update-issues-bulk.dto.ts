import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min, Matches } from 'class-validator';

export class UpdateIssuesBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids!: string[];

  @Matches(/^[a-z][a-z0-9_]{0,31}$/)
  @IsOptional()
  status?: string;

  @IsIn(['no_priority', 'low', 'medium', 'high', 'urgent'])
  @IsOptional()
  priority?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  estimate?: number | null;

  @IsDateString({ strict: true })
  @IsOptional()
  dueDate?: string | null;
}
