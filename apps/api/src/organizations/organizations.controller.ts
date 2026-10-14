import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}
  @Get() findAll(@Req() req: Request & { userId: string }) { return this.organizationsService.findAll(req.userId); }
  @Get(':id') findById(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.organizationsService.findById(req.userId, id); }
}
