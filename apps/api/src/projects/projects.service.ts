import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { projects, organizations, teams, users, issues, projectRepositories, githubRepositories } from '@reka/database';
import { eq, desc, and } from 'drizzle-orm';
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

    // Attach linked repositories for each project
    const allProjectRepos = await this.database.db
      .select({
        projectId: projectRepositories.projectId,
        id: githubRepositories.id,
        fullName: githubRepositories.fullName,
        name: githubRepositories.name,
        owner: githubRepositories.owner,
        isPrivate: githubRepositories.isPrivate,
        defaultBranch: githubRepositories.defaultBranch,
      })
      .from(projectRepositories)
      .innerJoin(githubRepositories, eq(projectRepositories.repositoryId, githubRepositories.id));

    return projectList.map((p) => {
      const pIssues = allIssues.filter((i) => i.projectId === p.id);
      const pRepos = allProjectRepos.filter((r) => r.projectId === p.id);
      const totalIssues = pIssues.length;
      const completedIssues = pIssues.filter((i) => i.status === 'done').length;
      const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      return {
        ...p,
        totalIssues,
        completedIssues,
        progress,
        repositories: pRepos,
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
    const pRepos = await this.findRepositories(p.id);
    const totalIssues = pIssues.length;
    const completedIssues = pIssues.filter((i) => i.status === 'done').length;
    const progress = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return {
      ...p,
      issues: pIssues,
      repositories: pRepos,
      totalIssues,
      completedIssues,
      progress,
    };
  }

  async findRepositories(projectId: string) {
    return this.database.db
      .select({
        id: githubRepositories.id,
        repoId: githubRepositories.repoId,
        owner: githubRepositories.owner,
        name: githubRepositories.name,
        fullName: githubRepositories.fullName,
        isPrivate: githubRepositories.isPrivate,
        defaultBranch: githubRepositories.defaultBranch,
        createdAt: projectRepositories.createdAt,
      })
      .from(projectRepositories)
      .innerJoin(githubRepositories, eq(projectRepositories.repositoryId, githubRepositories.id))
      .where(eq(projectRepositories.projectId, projectId));
  }

  async addRepository(projectId: string, repositoryId: string) {
    const project = await this.database.db.select().from(projects).where(eq(projects.id, projectId));
    if (!project.length) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const repo = await this.database.db.select().from(githubRepositories).where(eq(githubRepositories.id, repositoryId));
    if (!repo.length) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Check if already linked
    const existing = await this.database.db
      .select()
      .from(projectRepositories)
      .where(
        and(
          eq(projectRepositories.projectId, projectId),
          eq(projectRepositories.repositoryId, repositoryId),
        ),
      );

    if (existing.length === 0) {
      await this.database.db.insert(projectRepositories).values({
        projectId,
        repositoryId,
      });
    }

    return { success: true };
  }

  async removeRepository(projectId: string, repositoryId: string) {
    await this.database.db
      .delete(projectRepositories)
      .where(
        and(
          eq(projectRepositories.projectId, projectId),
          eq(projectRepositories.repositoryId, repositoryId),
        ),
      );

    return { success: true };
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
    const [team] = await this.database.db.select().from(teams).where(eq(teams.id, dto.teamId));
    if (!team) throw new NotFoundException('Team not found');

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
        teamId: team.id,
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
