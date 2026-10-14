import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { organizations } from '@reka/database';
import { and, eq } from 'drizzle-orm';
import { requireWorkspace, requireResourceId, membershipScope } from '../common/access/workspace-access';

@Injectable()
export class OrganizationsService {
  constructor(private readonly database: DatabaseService) {}
  async findAll(actorId: string) {
    const actor = await requireWorkspace(this.database.db, actorId);
    return this.database.db.select().from(organizations).where(and(eq(organizations.id, actor.organizationId), membershipScope(this.database.db, actor)));
  }
  async findById(actorId: string, id: string) {
    requireResourceId(id);
    const [organization] = (await this.findAll(actorId)).filter(org => org.id === id);
    if (!organization) throw new NotFoundException('Workspace not found');
    return organization;
  }
}
