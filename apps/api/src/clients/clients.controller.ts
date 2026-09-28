import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, CreateClientContactDto } from './dto/client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.clientsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.clientsService.delete(id);
  }

  @Get(':id/contacts')
  findContacts(@Param('id') id: string) {
    return this.clientsService.findContacts(id);
  }

  @Post(':id/contacts')
  addContact(@Param('id') id: string, @Body() dto: CreateClientContactDto) {
    return this.clientsService.addContact(id, dto);
  }

  @Delete('contacts/:contactId')
  deleteContact(@Param('contactId') contactId: string) {
    return this.clientsService.deleteContact(contactId);
  }

  @Post('seed-demo')
  seedDemo() {
    return this.clientsService.seedDemo();
  }
}
