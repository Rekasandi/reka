import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { clients, clientContacts, projects, organizations } from '@reka/database';
import { eq, desc } from 'drizzle-orm';
import { CreateClientDto, UpdateClientDto, CreateClientContactDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly database: DatabaseService) {}

  private async getResolvedOrgId(orgId?: string): Promise<string> {
    if (orgId) return orgId;
    const [org] = await this.database.db.select().from(organizations).limit(1);
    if (org) return org.id;

    // Create a fallback default organization if none exists
    const [created] = await this.database.db
      .insert(organizations)
      .values({
        name: 'Rekasandi',
        slug: 'rekasandi',
      })
      .returning();
    return created.id;
  }

  async findAll() {
    let clientList = await this.database.db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt));

    // If empty, auto-seed demo clients
    if (clientList.length === 0) {
      await this.seedDemo();
      clientList = await this.database.db
        .select()
        .from(clients)
        .orderBy(desc(clients.createdAt));
    }

    // Enrich clients with contacts and projects
    const allContacts = await this.database.db.select().from(clientContacts);
    const allProjects = await this.database.db.select().from(projects);

    return clientList.map((c) => {
      const cContacts = allContacts.filter((ct) => ct.clientId === c.id);
      const cProjects = allProjects.filter((p) => p.clientId === c.id);
      return {
        ...c,
        contacts: cContacts,
        projects: cProjects,
        contactCount: cContacts.length,
        projectCount: cProjects.length,
      };
    });
  }

  async findById(id: string) {
    const [client] = await this.database.db.select().from(clients).where(eq(clients.id, id));
    if (!client) {
      throw new NotFoundException(`Client with ID "${id}" not found`);
    }

    const cContacts = await this.database.db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, id));

    const cProjects = await this.database.db
      .select()
      .from(projects)
      .where(eq(projects.clientId, id));

    return {
      ...client,
      contacts: cContacts,
      projects: cProjects,
      contactCount: cContacts.length,
      projectCount: cProjects.length,
    };
  }

  async create(dto: CreateClientDto) {
    const orgId = await this.getResolvedOrgId(dto.organizationId);

    const [client] = await this.database.db
      .insert(clients)
      .values({
        organizationId: orgId,
        name: dto.name.trim(),
        industry: dto.industry?.trim() || null,
        notes: dto.notes?.trim() || null,
      })
      .returning();

    let createdContact = null;
    if (dto.contact?.name && dto.contact?.email) {
      const [contact] = await this.database.db
        .insert(clientContacts)
        .values({
          clientId: client.id,
          name: dto.contact.name.trim(),
          email: dto.contact.email.trim(),
          role: dto.contact.role?.trim() || null,
          phone: dto.contact.phone?.trim() || null,
        })
        .returning();
      createdContact = contact;
    }

    return {
      ...client,
      contacts: createdContact ? [createdContact] : [],
      projects: [],
      contactCount: createdContact ? 1 : 0,
      projectCount: 0,
    };
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findById(id);

    const [updated] = await this.database.db
      .update(clients)
      .set({
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.industry !== undefined && { industry: dto.industry.trim() }),
        ...(dto.notes !== undefined && { notes: dto.notes.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(clients.id, id))
      .returning();

    return this.findById(updated.id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.database.db.delete(clients).where(eq(clients.id, id));
    return { success: true };
  }

  async findContacts(clientId: string) {
    await this.findById(clientId);
    return this.database.db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, clientId));
  }

  async addContact(clientId: string, dto: CreateClientContactDto) {
    await this.findById(clientId);

    const [contact] = await this.database.db
      .insert(clientContacts)
      .values({
        clientId,
        name: dto.name.trim(),
        email: dto.email.trim(),
        role: dto.role?.trim() || null,
        phone: dto.phone?.trim() || null,
      })
      .returning();

    return contact;
  }

  async deleteContact(contactId: string) {
    await this.database.db.delete(clientContacts).where(eq(clientContacts.id, contactId));
    return { success: true };
  }

  async seedDemo() {
    const orgId = await this.getResolvedOrgId();

    const sampleClients = [
      {
        name: 'Rekasandi Internal',
        industry: 'Developer Platform',
        notes: 'Core platform engineering squad and internal dogfooding development streams.',
        contact: {
          name: 'Gustam Sandi',
          email: 'gustam@rekasandi.com',
          role: 'Lead Architect',
          phone: '+62 811-2345-6789',
        },
      },
      {
        name: 'PT Finansia Digital Indonesia',
        industry: 'Fintech & Payments',
        notes: 'Next-generation payment gateway and multi-currency settlement dashboard integration.',
        contact: {
          name: 'Budi Hartono',
          email: 'budi.h@finansia-digital.co.id',
          role: 'Head of Engineering',
          phone: '+62 812-9876-5432',
        },
      },
      {
        name: 'Nusantara Logistics Global',
        industry: 'Supply Chain & Logistics',
        notes: 'Real-time telemetry shipment tracking and automated driver dispatch service.',
        contact: {
          name: 'Siti Rahmawati',
          email: 'siti.rahma@nusantaralogistics.id',
          role: 'VP Product Delivery',
          phone: '+62 813-4567-8901',
        },
      },
      {
        name: 'Bukit Vista Hospitality',
        industry: 'Travel & Hospitality',
        notes: 'Villa booking engine, channel manager sync, and guest concierge mobile application.',
        contact: {
          name: 'Markus Lindholm',
          email: 'markus@bukitvista.com',
          role: 'Chief Technology Officer',
          phone: '+62 821-3456-7890',
        },
      },
    ];

    for (const item of sampleClients) {
      const [c] = await this.database.db
        .insert(clients)
        .values({
          organizationId: orgId,
          name: item.name,
          industry: item.industry,
          notes: item.notes,
        })
        .returning();

      if (item.contact) {
        await this.database.db.insert(clientContacts).values({
          clientId: c.id,
          name: item.contact.name,
          email: item.contact.email,
          role: item.contact.role,
          phone: item.contact.phone,
        });
      }

      // Link any existing unlinked projects to the first client
      if (item.name === 'Rekasandi Internal') {
        const existingProjects = await this.database.db.select().from(projects).limit(2);
        for (const proj of existingProjects) {
          if (!proj.clientId) {
            await this.database.db
              .update(projects)
              .set({ clientId: c.id })
              .where(eq(projects.id, proj.id));
          }
        }
      }
    }

    return { success: true, count: sampleClients.length };
  }
}
