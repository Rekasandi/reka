import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(50000) body!: string;
}

export class UpdateCommentDto {
  @IsString() @MinLength(1) @MaxLength(50000) body!: string;
}
