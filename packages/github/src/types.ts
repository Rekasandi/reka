export interface GithubWebhookHeaders {
  'x-github-event': string;
  'x-github-delivery': string;
  'x-hub-signature-256'?: string;
}

export interface ParsedIssueReference {
  raw: string;
  teamKey: string;
  number: number;
}
