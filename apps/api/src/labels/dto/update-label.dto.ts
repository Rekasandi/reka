import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateLabelDto {
  @IsOptional() @IsString() @MaxLength(50) @Matches(/\S/) name?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}
