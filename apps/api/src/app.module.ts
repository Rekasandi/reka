import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { AuthGuard } from './auth/auth.guard';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TeamsModule } from './teams/teams.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { IssuesModule } from './issues/issues.module';
import { LabelsModule } from './labels/labels.module';
import { CommentsModule } from './comments/comments.module';
import { CyclesModule } from './cycles/cycles.module';
import { ActivitiesModule } from './activities/activities.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { ViewsModule } from './views/views.module';
import { GithubModule } from './github/github.module';
import { AutomationsModule } from './automations/automations.module';
import { TriageModule } from './triage/triage.module';
import { DocumentsModule } from './documents/documents.module';
import { InitiativesModule } from './initiatives/initiatives.module';
import { IssueSubscriptionsModule } from './issue-subscriptions/issue-subscriptions.module';
import { AttachmentsModule } from './attachments/attachments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    WorkspaceModule,
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    ClientsModule,
    ProjectsModule,
    IssuesModule,
    LabelsModule,
    CommentsModule,
    CyclesModule,
    ActivitiesModule,
    NotificationsModule,
    SearchModule,
    ViewsModule,
    GithubModule,
    AutomationsModule,
    TriageModule,
    DocumentsModule,
    InitiativesModule,
    IssueSubscriptionsModule,
    AttachmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
