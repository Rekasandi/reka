import { Controller, Get, Post, Patch, Delete, Param, Body, Req, Query, DefaultValuePipe, ParseBoolPipe } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get() findAll(@Req() req: Request & { userId: string }, @Query('includeInactive', new DefaultValuePipe(false), new ParseBoolPipe()) includeInactive: boolean) { return this.usersService.findAll(req.userId, includeInactive); }
  @Get(':id') findById(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.usersService.findById(req.userId, id); }
  @Post() create(@Req() req: Request & { userId: string }, @Body() dto: CreateUserDto) { return this.usersService.create(req.userId, dto); }
  @Patch(':id') update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateUserDto) { return this.usersService.update(req.userId, id, dto); }
  @Delete(':id') delete(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.usersService.delete(req.userId, id); }
}
