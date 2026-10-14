import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateViewDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsIn(['private', 'shared']) visibility!: 'private' | 'shared';
  @IsObject() config!: Record<string, unknown>;
}

export class UpdateViewDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsIn(['private', 'shared']) visibility?: 'private' | 'shared';
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class FavoriteDto {
  @IsIn(['issue', 'project', 'view', 'document']) resourceType!: 'issue' | 'project' | 'view' | 'document';
  @IsUUID() resourceId!: string;
}
