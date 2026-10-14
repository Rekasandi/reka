import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class IssueTemplateFieldDto {
  @IsString() @Matches(/^[a-z][a-z0-9_]{0,31}$/)
  key!: string;

  @IsString() @Matches(/\S/) @MaxLength(80)
  label!: string;

  @IsIn(['text', 'textarea', 'select'])
  type!: 'text' | 'textarea' | 'select';

  @IsBoolean()
  required!: boolean;

  @ValidateIf((field: IssueTemplateFieldDto) => field.type === 'select')
  @IsArray() @ArrayMaxSize(20)
  @IsString({ each: true }) @MaxLength(100, { each: true })
  options?: string[];
}

export class CreateIssueTemplateDto {
  @IsString() @IsNotEmpty() @Matches(/\S/) @MaxLength(100)
  name!: string;

  @IsUUID() @IsOptional()
  teamId?: string | null;

  @IsString() @MaxLength(80) @IsOptional()
  titlePrefix?: string;

  @IsString() @MaxLength(4000) @IsOptional()
  description?: string | null;

  @IsString() @Matches(/^[a-z][a-z0-9_]{0,31}$/) @IsOptional()
  defaultStatus?: string;

  @IsIn(['task', 'bug', 'feature', 'improvement', 'chore']) @IsOptional()
  defaultType?: string;

  @IsIn(['no_priority', 'low', 'medium', 'high', 'urgent']) @IsOptional()
  defaultPriority?: string;

  @IsInt() @Min(0) @Max(100) @IsOptional()
  defaultEstimate?: number | null;

  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => IssueTemplateFieldDto) @IsOptional()
  fields?: IssueTemplateFieldDto[];
}
