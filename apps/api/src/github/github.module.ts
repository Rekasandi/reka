import { Module } from '@nestjs/common';
import { GithubWebhooksController } from './webhooks/webhooks.controller';
import { GithubWebhooksService } from './webhooks/webhooks.service';
import { GithubInstallationsController } from './installations/installations.controller';
import { GithubInstallationsService } from './installations/installations.service';
import { GithubRepositoriesController } from './repositories/repositories.controller';
import { GithubRepositoriesService } from './repositories/repositories.service';
import { GithubPullRequestsController } from './pull-requests/pull-requests.controller';
import { GithubPullRequestsService } from './pull-requests/pull-requests.service';

@Module({
  controllers: [
    GithubWebhooksController,
    GithubInstallationsController,
    GithubRepositoriesController,
    GithubPullRequestsController,
  ],
  providers: [
    GithubWebhooksService,
    GithubInstallationsService,
    GithubRepositoriesService,
    GithubPullRequestsService,
  ],
  exports: [GithubWebhooksService],
})
export class GithubModule {}
