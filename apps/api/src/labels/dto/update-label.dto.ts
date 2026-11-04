import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateLabelDto {
  @IsOptional() @IsString() @MaxLength(50) @Matches(/\S/) name?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  /** Move under a group label, or null to ungroup. */
  @IsOptional() @IsUUID() parentId?: string | null;
}
