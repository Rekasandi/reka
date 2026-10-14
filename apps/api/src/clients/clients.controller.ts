import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, CreateClientContactDto } from './dto/client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}
  @Get() findAll(@Req() req: Request & { userId: string }) { return this.clientsService.findAll(req.userId); }
  @Get(':id') findById(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.clientsService.findById(req.userId, id); }
  @Post() create(@Req() req: Request & { userId: string }, @Body() dto: CreateClientDto) { return this.clientsService.create(req.userId, dto); }
  @Patch(':id') update(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: UpdateClientDto) { return this.clientsService.update(req.userId, id, dto); }
  @Delete(':id') delete(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.clientsService.delete(req.userId, id); }
  @Get(':id/contacts') findContacts(@Req() req: Request & { userId: string }, @Param('id') id: string) { return this.clientsService.findContacts(req.userId, id); }
  @Post(':id/contacts') addContact(@Req() req: Request & { userId: string }, @Param('id') id: string, @Body() dto: CreateClientContactDto) { return this.clientsService.addContact(req.userId, id, dto); }
  @Delete('contacts/:contactId') deleteContact(@Req() req: Request & { userId: string }, @Param('contactId') contactId: string) { return this.clientsService.deleteContact(req.userId, contactId); }
}
