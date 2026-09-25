import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { users, issues, teamMembers } from '@reka/database';
import { eq, desc } from 'drizzle-orm';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async findAll() {
    const userList = await this.database.db.select().from(users).orderBy(desc(users.createdAt));
    const allIssues = await this.database.db.select().from(issues);
    const allTeamMembers = await this.database.db.select().from(teamMembers);

    return userList.map((u) => {
      const assignedIssues = allIssues.filter((i) => i.assigneeId === u.id);
      const teams = allTeamMembers.filter((tm) => tm.userId === u.id);

      return {
        ...u,
        assignedIssuesCount: assignedIssues.length,
        teamsCount: teams.length,
      };
    });
  }

  async findById(id: string) {
    const result = await this.database.db.select().from(users).where(eq(users.id, id));
    if (!result.length) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const u = result[0];
    const assignedIssues = await this.database.db.select().from(issues).where(eq(issues.assigneeId, u.id));
    const userTeams = await this.database.db.select().from(teamMembers).where(eq(teamMembers.userId, u.id));

    return {
      ...u,
      assignedIssues,
      assignedIssuesCount: assignedIssues.length,
      teamsCount: userTeams.length,
    };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.database.db.select().from(users).where(eq(users.email, dto.email.toLowerCase()));
    if (existing.length) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const [created] = await this.database.db
      .insert(users)
      .values({
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        avatarUrl: dto.avatarUrl?.trim() || null,
        role: dto.role || 'member',
      })
      .returning();

    return created;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    if (dto.email) {
      const existing = await this.database.db.select().from(users).where(eq(users.email, dto.email.toLowerCase()));
      if (existing.length && existing[0].id !== id) {
        throw new ConflictException(`Email "${dto.email}" is already used by another user`);
      }
    }

    const [updated] = await this.database.db
      .update(users)
      .set({
        ...dto,
        email: dto.email ? dto.email.toLowerCase().trim() : undefined,
        name: dto.name ? dto.name.trim() : undefined,
        avatarUrl: dto.avatarUrl !== undefined ? dto.avatarUrl?.trim() || null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.database.db.delete(users).where(eq(users.id, id));
    return { success: true };
  }
}
