import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength, IsUUID, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClientContactDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @IsOptional() @MaxLength(100) role?: string;
  @IsString() @IsOptional() @MaxLength(50) phone?: string;
}
export class CreateClientDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @IsString() @IsOptional() @MaxLength(100) industry?: string;
  @IsString() @IsOptional() notes?: string;
  @IsUUID() @IsOptional() organizationId?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => CreateClientContactDto) contact?: CreateClientContactDto;
}
export class UpdateClientDto {
  @IsString() @IsOptional() @MaxLength(255) name?: string;
  @IsString() @IsOptional() @MaxLength(100) industry?: string;
  @IsString() @IsOptional() notes?: string;
}
