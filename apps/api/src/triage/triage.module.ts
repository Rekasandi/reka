import { Module } from '@nestjs/common';
import { IssuesModule } from '../issues/issues.module';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';

@Module({ imports: [IssuesModule], controllers: [TriageController], providers: [TriageService] })
export class TriageModule {}
