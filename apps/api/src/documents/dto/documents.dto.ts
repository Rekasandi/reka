import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString() @MinLength(1) @MaxLength(180) title!: string;
  @IsString() @MaxLength(50000) content!: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() teamId?: string;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(50000) content?: string;
}
