import { Controller, Get, Post, Body, Req, Patch, Param, Delete } from '@nestjs/common';
import type { Request } from 'express';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get()
  findAll(@Req() req: Request & { userId: string }) {
    return this.labelsService.findAll(req.userId);
  }

  @Post()
  create(@Req() req: Request & { userId: string }, @Body() dto: CreateLabelDto) {
    return this.labelsService.create(req.userId, dto);
  }

  @Patch(':id')
  update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateLabelDto) {
    return this.labelsService.update(req.userId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request & { userId: string }, @Param('id') id: string) {
    return this.labelsService.remove(req.userId, id);
  }
}
