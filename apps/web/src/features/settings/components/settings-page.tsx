import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Field,
  FieldLabel,
  Input,
} from '@reka/ui';
import {
  GitBranch,
  KeyRound,
  Shield,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Lock,
  Globe,
  Sliders,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { useGithubRepositories, useDeleteGithubRepository } from '../hooks/use-github-repos';
import { AddRepositoryDialog } from './add-repository-dialog';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || 'size-4'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const [isAddRepoOpen, setIsAddRepoOpen] = React.useState(false);

  // Workflow Automation Settings State (persisted in localStorage or organization config)
  const [autoBranchInProgress, setAutoBranchInProgress] = React.useState(true);
  const [autoPrInReview, setAutoPrInReview] = React.useState(true);
  const [autoMergeDone, setAutoMergeDone] = React.useState(true);
  const [autoCloseBackToProgress, setAutoCloseBackToProgress] = React.useState(true);

  const { data: repositories = [], isLoading: isReposLoading } = useGithubRepositories();
  const deleteRepoMutation = useDeleteGithubRepository();

  const name = user?.name || 'Gustam';
  const email = user?.email || 'owner@rekasandi.com';
  const avatarUrl = user?.avatarUrl || undefined;
  const initial = (name[0] || 'G').toUpperCase();

  const githubUsername = email.includes('@users.noreply.github.com')
    ? email.replace('@users.noreply.github.com', '')
    : name.toLowerCase().replace(/\s+/g, '');

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto selection:bg-foreground selection:text-background pb-12">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
          Settings & Workflows
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage profile identity, GitHub repository connections, and git automated transitions.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* User Profile Card */}
        <Card className="rounded-[14px] border border-border/80 bg-card/40 p-5 shadow-2xs flex flex-col gap-5">
          <CardHeader className="p-0">
            <CardTitle className="text-base font-semibold text-foreground">
              User Profile
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Your public identity and workspace account details.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar className="size-16 rounded-full border border-border/80 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback className="text-lg font-bold bg-secondary text-foreground">
                {initial}
              </AvatarFallback>
            </Avatar>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
              <Field>
                <FieldLabel className="text-xs text-muted-foreground">Full Name</FieldLabel>
                <Input value={name} readOnly className="h-8 text-xs bg-background/80" />
              </Field>

              <Field>
                <FieldLabel className="text-xs text-muted-foreground">Email Address</FieldLabel>
                <Input value={email} readOnly className="h-8 text-xs font-mono bg-background/80" />
              </Field>
            </div>
          </CardContent>

          {/* GitHub Linked Identity Section */}
          <div className="rounded-[10px] border border-border/70 bg-background/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-[6px] bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/60">
                <GithubIcon className="size-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">GitHub Identity</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 bg-emerald-500/10 text-emerald-500 h-4.5 px-1.5 gap-1">
                    <Check className="size-2.5" />
                    <span>Connected</span>
                  </Badge>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  https://github.com/{githubUsername}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 text-xs rounded-[6px] gap-1.5"
            >
              <a href={`https://github.com/${githubUsername}`} target="_blank" rel="noopener noreferrer">
                <span>View on GitHub</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </Button>
          </div>
        </Card>

        {/* GitHub Workflow Automations (Linear-style rules) */}
        <Card className="rounded-[14px] border border-border/80 bg-card/40 p-5 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sliders className="size-4 text-foreground" />
              <CardTitle className="text-base font-semibold text-foreground">
                GitHub Workflow Automations
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10">
              Active Rules
            </Badge>
          </div>
          <CardDescription className="text-xs text-muted-foreground -mt-1">
            Configure how pull requests and git branch activities automatically transition issue statuses.
          </CardDescription>

          <div className="rounded-[10px] border border-border/70 divide-y divide-border/50 bg-background/80 overflow-hidden">
            {/* Rule 1: Branch Created */}
            <div className="flex items-center justify-between p-3.5 text-xs gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground text-xs">Branch Checkout / Creation</span>
                <span className="text-muted-foreground text-[11px]">
                  When a branch starting with <code className="text-foreground font-mono">feature/RS-x</code> is checked out or pushed &rarr; move issue to <span className="font-semibold text-foreground">In Progress</span>.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoBranchInProgress}
                onChange={(e) => setAutoBranchInProgress(e.target.checked)}
                className="size-4 rounded border border-border bg-transparent checked:bg-primary accent-primary cursor-pointer shrink-0"
              />
            </div>

            {/* Rule 2: PR Opened */}
            <div className="flex items-center justify-between p-3.5 text-xs gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground text-xs">Pull Request Opened / Linked</span>
                <span className="text-muted-foreground text-[11px]">
                  When a PR linking the issue is opened or linked &rarr; move issue to <span className="font-semibold text-foreground">In Review</span>.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoPrInReview}
                onChange={(e) => setAutoPrInReview(e.target.checked)}
                className="size-4 rounded border border-border bg-transparent checked:bg-primary accent-primary cursor-pointer shrink-0"
              />
            </div>

            {/* Rule 3: PR Merged */}
            <div className="flex items-center justify-between p-3.5 text-xs gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground text-xs">Pull Request Merged</span>
                <span className="text-muted-foreground text-[11px]">
                  When a PR is merged to main &rarr; automatically close and move issue to <span className="font-semibold text-emerald-500">Done</span>.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoMergeDone}
                onChange={(e) => setAutoMergeDone(e.target.checked)}
                className="size-4 rounded border border-border bg-transparent checked:bg-primary accent-primary cursor-pointer shrink-0"
              />
            </div>

            {/* Rule 4: PR Closed unmerged */}
            <div className="flex items-center justify-between p-3.5 text-xs gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-foreground text-xs">Pull Request Closed without Merge</span>
                <span className="text-muted-foreground text-[11px]">
                  If PR is closed without merging &rarr; reopen and move issue back to <span className="font-semibold text-foreground">In Progress</span>.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoCloseBackToProgress}
                onChange={(e) => setAutoCloseBackToProgress(e.target.checked)}
                className="size-4 rounded border border-border bg-transparent checked:bg-primary accent-primary cursor-pointer shrink-0"
              />
            </div>
          </div>
        </Card>

        {/* GitHub Connected Repositories Management */}
        <Card className="rounded-[14px] border border-border/80 bg-card/40 p-5 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <GitBranch className="size-4 text-foreground" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Connected GitHub Repositories
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] h-4.5 px-1.5">
                  {repositories.length}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Connected repositories enable automatic branch tracking, commit syncing, and PR resolution.
              </CardDescription>
            </div>

            <Button
              size="sm"
              onClick={() => setIsAddRepoOpen(true)}
              className="h-8 rounded-[6px] text-xs gap-1.5 font-medium"
            >
              <Plus className="size-3.5" />
              <span>Connect Repo</span>
            </Button>
          </div>

          <div className="rounded-[10px] border border-border/70 divide-y divide-border/50 bg-background/80 overflow-hidden">
            {repositories.map((repo) => (
              <div key={repo.id} className="flex items-center justify-between p-3.5 text-xs gap-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-7 rounded-[6px] bg-secondary flex items-center justify-center shrink-0 border border-border/60">
                    <GithubIcon className="size-3.5 text-foreground" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground text-xs truncate">
                        {repo.fullName}
                      </span>
                      {repo.isPrivate ? (
                        <Badge variant="outline" className="text-[10px] h-4.5 px-1 gap-1 border-border/70 text-muted-foreground">
                          <Lock className="size-2.5" />
                          <span>Private</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-4.5 px-1 gap-1 border-border/70 text-muted-foreground">
                          <Globe className="size-2.5" />
                          <span>Public</span>
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      default: {repo.defaultBranch}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon-xs" asChild className="size-7 text-muted-foreground hover:text-foreground">
                    <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noopener noreferrer" title="Open repository">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Disconnect repository ${repo.fullName}?`)) {
                        deleteRepoMutation.mutate(repo.id);
                      }
                    }}
                    className="text-muted-foreground/30 hover:text-destructive p-1 rounded transition-colors"
                    title="Disconnect repository"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {repositories.length === 0 && !isReposLoading && (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <span>No repositories connected yet.</span>
                <span className="text-[11px] text-muted-foreground/70">
                  Click &ldquo;Connect Repo&rdquo; to connect your GitHub repositories (e.g. rekasandi/reka).
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Add Repository Modal */}
      <AddRepositoryDialog
        open={isAddRepoOpen}
        onOpenChange={setIsAddRepoOpen}
      />
    </div>
  );
}
