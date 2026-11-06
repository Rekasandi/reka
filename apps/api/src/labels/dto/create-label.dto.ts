import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/\S/)
  name!: string;

  @IsUUID()
  teamId!: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color = '#6b7280';

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  /** Group this label under another top-level label of the same team/project. */
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
