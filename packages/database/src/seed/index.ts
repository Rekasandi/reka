import * as dotenv from 'dotenv';
import { createDbClient } from '../client';
import * as schema from '../schema/index';

dotenv.config({ path: '../../.env' });

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required to run seed');
    process.exit(1);
  }

  const db = createDbClient(databaseUrl);
  console.log('🌱 Starting seed...');

  // 1. Create Organization
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: 'Rekasandi',
      slug: 'rekasandi',
    })
    .returning();

  console.log(`Created org: ${org.name} (${org.id})`);

  // 2. Create Owner User
  const [owner] = await db
    .insert(schema.users)
    .values({
      email: 'owner@rekasandi.com',
      name: 'Gustam',
      role: 'owner',
    })
    .returning();

  await db.insert(schema.organizationMembers).values({
    organizationId: org.id,
    userId: owner.id,
    role: 'owner',
  });

  // 3. Create Team
  const [team] = await db
    .insert(schema.teams)
    .values({
      organizationId: org.id,
      name: 'Engineering',
      key: 'RS',
      description: 'Core engineering team',
    })
    .returning();

  await db.insert(schema.teamMembers).values({
    teamId: team.id,
    userId: owner.id,
    role: 'lead',
  });

  // 4. Create Project
  const [project] = await db
    .insert(schema.projects)
    .values({
      organizationId: org.id,
      teamId: team.id,
      name: 'REKA Platform',
      slug: 'reka',
      description: 'Internal project and task management platform',
      status: 'in_progress',
      ownerId: owner.id,
    })
    .returning();

  console.log(`Created project: ${project.name} (${project.id})`);

  // 5. Create Sample Issue
  const [issue] = await db
    .insert(schema.issues)
    .values({
      identifier: 'RS-1',
      number: 1,
      title: 'Scaffold REKA monorepo foundation',
      description: 'Set up monorepo with pnpm, Turborepo, NestJS, React, and Drizzle',
      status: 'in_progress',
      priority: 'high',
      type: 'feature',
      teamId: team.id,
      projectId: project.id,
      reporterId: owner.id,
      assigneeId: owner.id,
    })
    .returning();

  console.log(`Created issue: ${issue.identifier} - ${issue.title}`);
  console.log('✅ Seeding completed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
