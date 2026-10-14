import { PartialType } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional() @IsUUID() ownerId?: string;
}
