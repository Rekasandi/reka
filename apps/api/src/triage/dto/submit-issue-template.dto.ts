import { IsObject, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

export class SubmitIssueTemplateDto {
  @IsString() @Matches(/\S/) @MaxLength(255)
  title!: string;

  @IsUUID() @IsOptional()
  teamId?: string;

  @IsObject() @IsOptional()
  answers?: Record<string, unknown>;
}
