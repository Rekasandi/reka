import { IsString, IsNotEmpty, IsEmail, IsOptional, IsIn, MaxLength } from 'class-validator';
import type { UserRole } from '@reka/types';

export class CreateUserDto {
  @IsEmail() @IsNotEmpty() @MaxLength(255) email!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @IsString() @IsOptional() avatarUrl?: string;
  @IsOptional() @IsIn(['owner', 'admin', 'member', 'guest', 'client']) role?: UserRole;
}
export class UpdateUserDto {
  @IsEmail() @IsOptional() @MaxLength(255) email?: string;
  @IsString() @IsOptional() @MaxLength(255) name?: string;
  @IsString() @IsOptional() avatarUrl?: string;
  @IsOptional() @IsIn(['owner', 'admin', 'member', 'guest', 'client']) role?: UserRole;
}
