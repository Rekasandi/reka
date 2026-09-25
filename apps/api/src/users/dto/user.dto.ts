import { IsString, IsNotEmpty, IsEmail, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  @IsIn(['owner', 'admin', 'member', 'guest', 'client'])
  role?: string;
}

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsOptional()
  @IsIn(['owner', 'admin', 'member', 'guest', 'client'])
  role?: string;
}
