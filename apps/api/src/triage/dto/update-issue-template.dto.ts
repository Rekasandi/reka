import { PartialType } from '@nestjs/swagger';
import { CreateIssueTemplateDto } from './issue-template.dto';

export class UpdateIssueTemplateDto extends PartialType(CreateIssueTemplateDto) {}
