import { IsString, IsEmail, IsOptional, IsIn, MaxLength } from 'class-validator';
import type { UserRole } from '@reka/types';

export class UpdateUserDto {
  @IsEmail() @IsOptional() @MaxLength(255) email?: string;
  @IsString() @IsOptional() @MaxLength(255) name?: string;
  @IsString() @IsOptional() avatarUrl?: string;
  @IsOptional() @IsIn(['owner', 'admin', 'member', 'guest', 'client']) role?: UserRole;
}
