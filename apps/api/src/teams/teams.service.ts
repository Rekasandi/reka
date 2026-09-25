import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { teams, organizations, users, teamMembers, issues, cycles } from '@reka/database';
import { eq, desc, and } from 'drizzle-orm';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const teamList = await this.database.db
      .select()
      .from(teams)
      .orderBy(desc(teams.createdAt));

    const allMembers = await this.database.db.select().from(teamMembers);
    const allUsers = await this.database.db.select().from(users);
    const allIssues = await this.database.db.select().from(issues);

    return teamList.map((t) => {
      const members = allMembers
        .filter((m) => m.teamId === t.id)
        .map((m) => {
          const user = allUsers.find((u) => u.id === m.userId);
          return {
            ...m,
            user,
          };
        });

      const teamIssues = allIssues.filter((i) => i.teamId === t.id);

      return {
        ...t,
        members,
        memberCount: members.length,
        issueCount: teamIssues.length,
      };
    });
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(teams).where(eq(teams.id, id));
    if (!result.length) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    const t = result[0];
    const rawMembers = await this.database.db.select().from(teamMembers).where(eq(teamMembers.teamId, t.id));
    const allUsers = await this.database.db.select().from(users);
    const teamIssues = await this.database.db.select().from(issues).where(eq(issues.teamId, t.id));
    const teamCycles = await this.database.db.select().from(cycles).where(eq(cycles.teamId, t.id));

    const members = rawMembers.map((m) => ({
      ...m,
      user: allUsers.find((u) => u.id === m.userId),
    }));

    return {
      ...t,
      members,
      memberCount: members.length,
      issueCount: teamIssues.length,
      issues: teamIssues,
      cycles: teamCycles,
    };
  }

  async create(dto: CreateTeamDto) {
    const [org] = await this.database.db.select().from(organizations).limit(1);
    if (!org) throw new NotFoundException('No organization found');

    const normalizedKey = dto.key.trim().toUpperCase();

    const existing = await this.database.db.select().from(teams).where(eq(teams.key, normalizedKey));
    if (existing.length) {
      throw new ConflictException(`Team identifier key "${normalizedKey}" already exists`);
    }

    const [created] = await this.database.db
      .insert(teams)
      .values({
        organizationId: org.id,
        name: dto.name.trim(),
        key: normalizedKey,
        description: dto.description?.trim() || null,
      })
      .returning();

    const [user] = await this.database.db.select().from(users).limit(1);
    if (user) {
      await this.database.db.insert(teamMembers).values({
        teamId: created.id,
        userId: user.id,
        role: 'lead',
      });
    }

    return created;
  }

  async addMember(teamId: string, dto: AddTeamMemberDto) {
    await this.findById(teamId);

    const user = await this.database.db.select().from(users).where(eq(users.id, dto.userId));
    if (!user.length) throw new NotFoundException('User not found');

    const existing = await this.database.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, dto.userId)));

    if (existing.length) {
      throw new ConflictException('User is already a member of this team');
    }

    const [member] = await this.database.db
      .insert(teamMembers)
      .values({
        teamId,
        userId: dto.userId,
        role: dto.role || 'member',
      })
      .returning();

    return member;
  }

  async removeMember(teamId: string, userId: string) {
    await this.database.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

    return { success: true };
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.findById(id);

    const [updated] = await this.database.db
      .update(teams)
      .set({
        ...dto,
        key: dto.key ? dto.key.trim().toUpperCase() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.database.db.delete(teams).where(eq(teams.id, id));
    return { success: true };
  }
}
