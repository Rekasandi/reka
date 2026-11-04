import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { WorkspaceService } from './workspace.service';
import { UpdateWorkspaceDto, UpdateWorkspaceMemberDto } from './dto/workspace.dto';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get() findCurrent(@Req() req: Request & { userId: string }) { return this.workspace.findCurrent(req.userId); }
  @Patch() update(@Req() req: Request & { userId: string }, @Body() dto: UpdateWorkspaceDto) { return this.workspace.update(req.userId, dto); }
  @Get('members') findMembers(@Req() req: Request & { userId: string }) { return this.workspace.findMembers(req.userId); }
  @Patch('members/:id') updateMember(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateWorkspaceMemberDto) { return this.workspace.updateMember(req.userId, id, dto); }
}
