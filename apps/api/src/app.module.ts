import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { TeamsModule } from './teams/teams.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { IssuesModule } from './issues/issues.module';
import { LabelsModule } from './labels/labels.module';
import { CommentsModule } from './comments/comments.module';
import { MilestonesModule } from './milestones/milestones.module';
import { CyclesModule } from './cycles/cycles.module';
import { ActivitiesModule } from './activities/activities.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { GithubModule } from './github/github.module';
import { AutomationsModule } from './automations/automations.module';

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
    UsersModule,
    OrganizationsModule,
    TeamsModule,
    ClientsModule,
    ProjectsModule,
    IssuesModule,
    LabelsModule,
    CommentsModule,
    MilestonesModule,
    CyclesModule,
    ActivitiesModule,
    NotificationsModule,
    SearchModule,
    GithubModule,
    AutomationsModule,
  ],
})
export class AppModule {}
