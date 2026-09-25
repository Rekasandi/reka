import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { projects, organizations, teams, users, issues } from '@reka/database';
import { eq, desc } from 'drizzle-orm';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const projectList = await this.database.db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));

    // Attach dynamic issue counts for each project
    const allIssues = await this.database.db.select().from(issues);

    return projectList.map((p) => {
      const pIssues = allIssues.filter((i) => i.projectId === p.id);
      const totalIssues = pIssues.length;
      const completedIssues = pIssues.filter((i) => i.status === 'done').length;
      const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      return {
        ...p,
        totalIssues,
        completedIssues,
        progress,
      };
    });
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(projects).where(eq(projects.id, id));
    if (!result.length) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const p = result[0];
    const pIssues = await this.database.db.select().from(issues).where(eq(issues.projectId, p.id));
    const totalIssues = pIssues.length;
    const completedIssues = pIssues.filter((i) => i.status === 'done').length;
    const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return {
      ...p,
      issues: pIssues,
      totalIssues,
      completedIssues,
      progress,
    };
  }

  async create(dto: CreateProjectDto) {
    // 1. Resolve Organization
    const [org] = await this.database.db.select().from(organizations).limit(1);
    if (!org) {
      throw new NotFoundException('No organization found');
    }

    // 2. Resolve Owner
    const [owner] = await this.database.db.select().from(users).limit(1);
    if (!owner) {
      throw new NotFoundException('No owner user found');
    }

    // 3. Resolve Team
    let teamId = dto.teamId;
    if (!teamId) {
      const [team] = await this.database.db.select().from(teams).limit(1);
      if (team) teamId = team.id;
    }

    // 4. Generate Slug
    const slug =
      dto.slug ||
      dto.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      'project';

    const [created] = await this.database.db
      .insert(projects)
      .values({
        organizationId: org.id,
        ownerId: owner.id,
        teamId: teamId || null,
        name: dto.name,
        slug,
        description: dto.description || null,
        status: dto.status || 'planned',
        health: dto.health || 'on_track',
        priority: dto.priority || 'medium',
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      })
      .returning();

    return created;
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findById(id);

    const [updated] = await this.database.db
      .update(projects)
      .set({
        ...dto,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.database.db.delete(projects).where(eq(projects.id, id));
    return { success: true };
  }
}
