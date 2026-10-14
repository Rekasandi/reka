import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { UserRole } from '@reka/types';

export class CreateWorkspaceInvitationDto {
  @IsEmail() @MaxLength(255) email!: string;
  @IsOptional() @IsIn(['admin', 'member']) role?: 'admin' | 'member';
  @IsOptional() @IsInt() @Min(1) @Max(30) expiresInDays?: number;
}
export class UpdateWorkspaceMemberDto {
  @IsOptional() @IsIn(['owner', 'admin', 'member', 'guest', 'client']) role?: UserRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) name?: string;
}
