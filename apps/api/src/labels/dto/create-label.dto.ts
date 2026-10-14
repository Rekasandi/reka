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
}
