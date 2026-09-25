import { IsString, IsNotEmpty, IsOptional, MaxLength, IsIn } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  key!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  key?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class AddTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsOptional()
  @IsIn(['lead', 'member', 'viewer'])
  role?: string;
}
