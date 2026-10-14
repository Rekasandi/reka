import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../common/database/database.service';
import { clients, clientContacts, projects } from '@reka/database';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { CreateClientDto, UpdateClientDto, CreateClientContactDto } from './dto/client.dto';
import { clientScope, projectScope, requireResourceId, requireWorkspace, requireWrite, membershipScope } from '../common/access/workspace-access';

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll(actorId: string) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    const clientList = await db.select().from(clients).where(and(clientScope(actor), membershipScope(db, actor))).orderBy(desc(clients.createdAt));
    const ids = clientList.map(client => client.id);
    if (!ids.length) return [];
    const [contacts, linkedProjects] = await Promise.all([
      db.select().from(clientContacts).where(inArray(clientContacts.clientId, ids)),
      db.select().from(projects).where(and(inArray(projects.clientId, ids), projectScope(db, actor))),
    ]);
    return clientList.map(client => {
      const cContacts = contacts.filter(contact => contact.clientId === client.id);
      const cProjects = linkedProjects.filter(project => project.clientId === client.id);
      return { ...client, contacts: cContacts, projects: cProjects, contactCount: cContacts.length, projectCount: cProjects.length };
    });
  }

  async findById(actorId: string, id: string) {
    requireResourceId(id);
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    const [client] = await db.select().from(clients).where(and(eq(clients.id, id), clientScope(actor), membershipScope(db, actor)));
    if (!client) throw new NotFoundException('Client not found');
    const [contacts, linkedProjects] = await Promise.all([
      db.select().from(clientContacts).where(eq(clientContacts.clientId, id)),
      db.select().from(projects).where(and(eq(projects.clientId, id), projectScope(db, actor))),
    ]);
    return { ...client, contacts, projects: linkedProjects, contactCount: contacts.length, projectCount: linkedProjects.length };
  }

  async create(actorId: string, dto: CreateClientDto) {
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    requireWrite(actor);
    if (dto.organizationId && dto.organizationId !== actor.organizationId) throw new BadRequestException('Client must belong to the company workspace');
    if (!dto.name?.trim()) throw new BadRequestException('Client name cannot be empty');
    if (dto.contact && !dto.contact.name?.trim()) throw new BadRequestException('Contact name cannot be empty');
    const id = randomUUID();
    // Client and optional validated contact persist together or not at all.
    await db.execute(sql`
      WITH created AS (
        INSERT INTO clients (id, organization_id, name, industry, notes)
        SELECT ${id}::uuid, ${actor.organizationId}::uuid, ${dto.name.trim()}, ${dto.industry?.trim() || null}, ${dto.notes?.trim() || null}
        WHERE ${membershipScope(db, actor)} RETURNING id
      ) ${dto.contact ? sql`
        INSERT INTO client_contacts (client_id, name, email, role, phone)
        SELECT id, ${dto.contact.name.trim()}, ${dto.contact.email.trim().toLowerCase()}, ${dto.contact.role?.trim() || null}, ${dto.contact.phone?.trim() || null} FROM created
      ` : sql`SELECT id FROM created`}
    `);
    return this.findById(actorId, id);
  }

  async update(actorId: string, id: string, dto: UpdateClientDto) {
    await this.findById(actorId, id);
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    requireWrite(actor);
    if (dto.name !== undefined && !dto.name?.trim()) throw new BadRequestException('Client name cannot be empty');
    const [updated] = await db.update(clients).set({ name: dto.name?.trim(),
      industry: dto.industry !== undefined ? dto.industry?.trim() || null : undefined,
      notes: dto.notes !== undefined ? dto.notes?.trim() || null : undefined, updatedAt: new Date(),
    }).where(and(eq(clients.id, id), clientScope(actor), membershipScope(db, actor))).returning();
    if (!updated) throw new NotFoundException('Client not found');
    return this.findById(actorId, id);
  }

  async delete(actorId: string, id: string) {
    await this.findById(actorId, id);
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    requireWrite(actor);
    await db.delete(clients).where(and(eq(clients.id, id), clientScope(actor), membershipScope(db, actor)));
    return { success: true };
  }

  async findContacts(actorId: string, clientId: string) {
    return (await this.findById(actorId, clientId)).contacts;
  }

  async addContact(actorId: string, clientId: string, dto: CreateClientContactDto) {
    await this.findById(actorId, clientId);
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    requireWrite(actor);
    if (!dto.name?.trim()) throw new BadRequestException('Contact name cannot be empty');
    const result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, name, email, role, phone)
      SELECT c.id, ${dto.name.trim()}, ${dto.email.trim().toLowerCase()}, ${dto.role?.trim() || null}, ${dto.phone?.trim() || null}
      FROM clients c WHERE c.id = ${clientId}::uuid AND c.organization_id = ${actor.organizationId}::uuid AND ${membershipScope(db, actor)}
      RETURNING id
    `);
    const row = result.rows[0] as { id: string } | undefined;
    if (!row) throw new NotFoundException('Client not found');
    const [contact] = await db.select().from(clientContacts).where(eq(clientContacts.id, row.id));
    return contact;
  }

  async deleteContact(actorId: string, contactId: string) {
    requireResourceId(contactId);
    const db = this.database.db, actor = await requireWorkspace(db, actorId);
    requireWrite(actor);
    const [deleted] = await db.delete(clientContacts).where(and(eq(clientContacts.id, contactId),
      inArray(clientContacts.clientId, db.select({ id: clients.id }).from(clients).where(and(clientScope(actor), membershipScope(db, actor)))),
    )).returning({ id: clientContacts.id });
    if (!deleted) throw new NotFoundException('Contact not found');
    return { success: true };
  }
}
