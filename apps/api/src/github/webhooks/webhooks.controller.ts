import { Controller, Post, Headers, Body } from '@nestjs/common';
import { GithubWebhooksService } from './webhooks.service';

@Controller('integrations/github/webhook')
export class GithubWebhooksController {
  constructor(private readonly webhooksService: GithubWebhooksService) {}

  @Post()
  async handleWebhook(
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    return this.webhooksService.handleWebhook(deliveryId, event, signature, payload);
  }
}
