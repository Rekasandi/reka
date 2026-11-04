import { NotificationsModule } from '../notifications/notifications.module';
import { Module } from '@nestjs/common';
import { IssuesModule } from '../issues/issues.module';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';

@Module({ imports: [NotificationsModule, IssuesModule], controllers: [TriageController], providers: [TriageService] })
export class TriageModule {}
