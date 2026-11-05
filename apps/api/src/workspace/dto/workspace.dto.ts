import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UserRole } from '@reka/types';

export class UpdateWorkspaceMemberDto {
  @IsOptional() @IsIn(['owner', 'admin', 'member', 'guest', 'client']) role?: UserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) name?: string;
}
