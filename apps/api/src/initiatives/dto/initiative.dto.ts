import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInitiativeDto {
  @IsString() @IsNotEmpty() @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsIn(['planned', 'in_progress', 'completed', 'canceled']) status?: string;
  @IsOptional() @IsIn(['on_track', 'at_risk', 'off_track']) health?: string;
  @IsOptional() @IsDateString({ strict: true }) startDate?: string | null;
  @IsOptional() @IsDateString({ strict: true }) targetDate?: string | null;
}

export class UpdateInitiativeDto extends PartialType(CreateInitiativeDto) {}

export class AddInitiativeProjectDto {
  @IsUUID() projectId!: string;
}
