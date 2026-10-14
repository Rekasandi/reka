import * as React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
  Skeleton,
  Field,
  FieldLabel,
  toast,
} from '@reka/ui';
import {
  GitBranch,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  Lock,
  Globe,
  Building2,
  FolderKanban,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import {
  useGithubRepositories,
  useDeleteGithubRepository,
  useGithubInstallations,
  useDeleteGithubInstallation,
  useGithubWebhookDeliveries,
} from '../hooks/use-github-repos';
import { AddRepositoryDialog } from './add-repository-dialog';
import { ConnectOrganizationDialog } from './connect-organization-dialog';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { WorkspaceSettings } from './workspace-settings';
import { useTheme } from '../../../components/theme/theme-provider';

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
  const { theme, setTheme } = useTheme();
  const { hash } = useLocation();
  React.useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);
  const canManageGithub = user?.role === 'owner' || user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAddRepoOpen, setIsAddRepoOpen] = React.useState(false);
  const [isConnectOrgOpen, setIsConnectOrgOpen] = React.useState(false);
  const [disconnectTargetOrg, setDisconnectTargetOrg] = React.useState<{ id: string; name: string } | null>(null);
  const [disconnectTargetRepo, setDisconnectTargetRepo] = React.useState<{ id: string; fullName: string } | null>(null);

  const { data: installations = [], isLoading: isInstallationsLoading, isError: isInstallationsError, refetch: retryInstallations } = useGithubInstallations();
  const deleteOrgMutation = useDeleteGithubInstallation();
  const { data: deliveries = [], isLoading: deliveriesLoading, isError: deliveriesError, refetch: retryDeliveries } = useGithubWebhookDeliveries(canManageGithub);

  const { data: repositories = [], isLoading: isReposLoading, isError: isReposError, refetch: retryRepositories } = useGithubRepositories();
  const deleteRepoMutation = useDeleteGithubRepository();

  const name = user?.name || '';
  const email = user?.email || '';
  const avatarUrl = user?.avatarUrl || undefined;
  const initial = (name[0] || email[0] || 'U').toUpperCase();

  const githubUsername = user?.githubUsername || '';

  React.useEffect(() => {
    const result = searchParams.get('github');
    if (!result) return;
    if (result === 'installed') toast.success('GitHub App installation verified and connected');
    else if (result === 'verification_failed') toast.error('GitHub App installation could not be verified. Check the App configuration and retry.');
    const clean = new URLSearchParams(searchParams);
    clean.delete('github');
    setSearchParams(clean, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
          Settings & Workflows
        </h1>
        <p className="text-xs text-muted-foreground">
          Workspace access, your profile, appearance, and GitHub workflows.
        </p>
      </div>

      <nav aria-label="Settings sections" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[['workspace', 'Workspace'], ['profile', 'Profile'], ['appearance', 'Appearance'], ['github-workflows', 'GitHub workflows'], ['github-connections', 'Connections']].map(([id, label]) => <Button key={id} variant="outline" size="sm" asChild><a href={`#${id}`}>{label}</a></Button>)}
      </nav>
      <div className="settings-sections flex flex-col gap-8">
        <WorkspaceSettings />
        {/* User profile */}
        <Card id="profile" className="rounded-lg border border-border bg-card p-5 shadow-none flex flex-col gap-5">
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

            <dl className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1"><dt className="text-xs text-muted-foreground">GitHub Username</dt><dd className="break-words text-sm">{githubUsername ? `@${githubUsername}` : 'Not available'}</dd></div>
              <div className="flex min-w-0 flex-col gap-1"><dt className="text-xs text-muted-foreground">Full Name</dt><dd className="break-words text-sm">{name || 'Not available'}</dd></div>
              <div className="flex min-w-0 flex-col gap-1"><dt className="text-xs text-muted-foreground">Email Address</dt><dd className="break-all text-sm">{email || 'Not available'}</dd></div>
            </dl>
          </CardContent>

          {/* GitHub linked identity is shown only when supplied by the account. */}
          {githubUsername && <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-[6px] bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/60">
                <GithubIcon className="size-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">GitHub Identity</span>
                  <Badge variant="success" className="text-xs font-mono h-4.5 px-1.5 gap-1">
                    <Check className="size-2.5" />
                    <span>Connected</span>
                  </Badge>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  https://github.com/{githubUsername}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a href={`https://github.com/${githubUsername}`} target="_blank" rel="noopener noreferrer">
                <span>View on GitHub</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </Button>
          </div>}
        </Card>

        <Card id="appearance">
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose a theme for this browser. System follows your device preference.</CardDescription></CardHeader>
          <CardContent><Field className="max-w-sm"><FieldLabel htmlFor="appearance-theme">Theme</FieldLabel><select id="appearance-theme" value={theme} onChange={event => setTheme(event.target.value as 'dark' | 'light' | 'system')} className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></Field></CardContent>
        </Card>

        {/* Read-only documentation of the worker's supported automation rules. */}
        <Card id="github-workflows" className="flex flex-col gap-4">
          <CardHeader className="p-0">
            <CardTitle>GitHub Workflow Automations</CardTitle>
            <CardDescription>Verified webhook events update matching REKA work. Per-rule automation configuration is not available.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-0">
            <div className="flex flex-col gap-1"><h3 className="text-sm font-medium">Branch pushes and deletes</h3><p className="text-sm text-muted-foreground">Track the latest commit for issue-key branches; newly linked branches move pending issues into an active workflow state.</p></div>
            <div className="flex flex-col gap-1"><h3 className="text-sm font-medium">Pull requests and reviews</h3><p className="text-sm text-muted-foreground">Open/reopen moves work to an active state; requested reviews and submitted approvals/changes update review status. Merge moves work to a completed state; unmerged close does not.</p></div>
            <p className="text-xs text-muted-foreground">Team workflow categories determine status targets. Issue identifiers in the pull request title or branch name link the work to REKA.</p>
          </CardContent>
        </Card>

        {canManageGithub && <Card className="flex flex-col gap-4">
          <CardHeader className="flex flex-row items-start justify-between gap-3 p-0">
            <div className="flex flex-col gap-1"><CardTitle>Recent GitHub webhook deliveries</CardTitle><CardDescription>Worker outcomes for this workspace. Failed deliveries are retained for retry; delivery IDs are scoped to connected installations.</CardDescription></div>
            <Button type="button" variant="outline" size="sm" onClick={() => void retryDeliveries()} aria-label="Refresh webhook deliveries"><RefreshCw className="size-3.5" /><span className="sr-only">Refresh</span></Button>
          </CardHeader>
          <CardContent className="p-0">
            {deliveriesLoading ? <Skeleton className="h-16 w-full" />
              : deliveriesError ? <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive"><span>Could not load delivery status.</span><Button type="button" variant="outline" size="sm" onClick={() => void retryDeliveries()}>Retry</Button></div>
              : deliveries.length ? <ul className="divide-y divide-border/60 rounded-md border border-border/70">{deliveries.map(delivery => <li key={delivery.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-xs font-medium">{delivery.event}</span><Badge variant={delivery.error ? 'destructive' : delivery.processed ? 'outline' : 'secondary'}>{delivery.error ? 'Failed' : delivery.processed ? 'Processed' : 'Queued'}</Badge></div><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={delivery.deliveryId}>{delivery.deliveryId}</p>{delivery.error && <p role="alert" className="mt-1 break-words text-xs text-destructive">{delivery.error}</p>}</div><time className="shrink-0 text-[10px] text-muted-foreground">{new Date(delivery.createdAt).toLocaleString()}</time></li>)}</ul>
              : <p className="rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground">No webhook deliveries have been recorded for this workspace.</p>}
          </CardContent>
        </Card>}

        {/* Connected GitHub Organization Management (Workspace Level) */}
        <Card id="github-connections" className="rounded-lg border border-border bg-card p-5 shadow-none flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-foreground" />
                <CardTitle className="text-base font-semibold text-foreground">
                  Connected GitHub Organizations
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs h-4.5 px-1.5">
                  {installations.length}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                GitHub App installations verified for this workspace.
              </CardDescription>
            </div>

            {canManageGithub && <Button
              size="sm"
              onClick={() => setIsConnectOrgOpen(true)}
              className="h-8 rounded-[6px] text-xs gap-1.5 font-medium shrink-0"
            >
              <Plus className="size-3.5" />
              <span>Connect Organization</span>
            </Button>}
          </div>

          <div className="rounded-lg border border-border/70 divide-y divide-border/50 bg-background/80 overflow-hidden">
            {isInstallationsLoading && <Skeleton className="h-20 w-full" />}
            {isInstallationsError && <div role="alert" className="flex flex-wrap items-center gap-3 p-4"><p className="text-sm text-muted-foreground">Could not load GitHub connections.</p><Button variant="outline" size="sm" onClick={() => retryInstallations()}>Retry</Button></div>}
            {installations.map((inst) => (
              <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 text-xs gap-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-[6px] bg-secondary flex items-center justify-center shrink-0 border border-border/60">
                    <GithubIcon className="size-4 text-foreground" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground text-xs truncate">
                        {inst.accountLogin}
                      </span>
                      <Badge variant="success" className="text-xs h-4.5 px-1.5 gap-1 font-mono">
                        <Check className="size-2.5" />
                        <span>Connected</span>
                      </Badge>
                      <Badge variant="outline" className="text-xs h-4.5 px-1 border-border/70 text-muted-foreground font-mono">
                        {inst.accountType}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      Installation ID #{inst.installationId} &bull; {inst.repositoryCount ?? 0} repositories accessible
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon-xs" asChild className="size-7 text-muted-foreground hover:text-foreground">
                    <a href={`https://github.com/${inst.accountLogin}`} target="_blank" rel="noopener noreferrer" title="View organization on GitHub">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>

                  {canManageGithub && <button
                    type="button"
                    onClick={() => setDisconnectTargetOrg({ id: inst.id, name: inst.accountLogin })}
                    className="text-muted-foreground/30 hover:text-destructive p-1 rounded transition-colors text-xs"
                    title="Disconnect organization"
                  >
                    <Trash2 className="size-3.5" />
                  </button>}
                </div>
              </div>
            ))}

            {installations.length === 0 && !isInstallationsLoading && !isInstallationsError && (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <Building2 className="size-7 text-muted-foreground/40" />
                <span className="font-semibold text-foreground">No GitHub organization connected yet.</span>
                <span className="text-xs text-muted-foreground max-w-md">
                  Install the REKA GitHub App through GitHub&apos;s verified account and repository selection flow. Once connected, each project can link to its specific repository.
                </span>
                {canManageGithub && <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsConnectOrgOpen(true)}
                  className="h-7 text-xs rounded-[6px] gap-1.5 mt-1"
                >
                  <Plus className="size-3" />
                  <span>Connect Organization</span>
                </Button>}
              </div>
            )}
          </div>

          {/* Flow note explaining Project linking */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
            <FolderKanban className="size-4 shrink-0 text-foreground mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Project-level Linking: </span>
              After connecting your organization above, open any <span className="text-foreground font-medium">Project &rarr; Repositories</span> tab to choose which specific repository connects to that project.
            </div>
          </div>
        </Card>

        {/* Repositories Discovered / Connected in Workspace */}
        {installations.length > 0 && (
          <Card className="rounded-lg border border-border bg-card p-5 shadow-none flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-4 text-foreground" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    Available Workspace Repositories
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-xs h-4.5 px-1.5">
                    {repositories.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Repositories synced from your connected organization, available for linking inside Projects.
                </CardDescription>
              </div>

              {canManageGithub && <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddRepoOpen(true)}
                className="h-8 rounded-[6px] text-xs gap-1.5 font-medium"
              >
                <Plus className="size-3.5" />
                <span>Add Repo</span>
              </Button>}
            </div>

            <div className="rounded-lg border border-border/70 divide-y divide-border/50 bg-background/80 overflow-hidden max-h-[300px] overflow-y-auto">
              {isReposLoading && <Skeleton className="h-20 w-full" />}
              {isReposError && <div role="alert" className="flex flex-wrap items-center gap-3 p-4"><p className="text-sm text-muted-foreground">Could not load repositories.</p><Button variant="outline" size="sm" onClick={() => retryRepositories()}>Retry</Button></div>}
              {repositories.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between p-3 text-xs gap-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center shrink-0 border border-border/60">
                      <GithubIcon className="size-3 text-foreground" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-medium text-foreground text-xs truncate">
                        {repo.fullName}
                      </span>
                      {repo.isPrivate ? (
                        <Badge variant="outline" className="text-xs h-4 px-1 gap-0.5 border-border/70 text-muted-foreground">
                          <Lock className="size-2" />
                          <span>Private</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs h-4 px-1 gap-0.5 border-border/70 text-muted-foreground">
                          <Globe className="size-2" />
                          <span>Public</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {repo.defaultBranch}
                    </span>
                    <Button variant="ghost" size="icon-xs" asChild className="size-6 text-muted-foreground hover:text-foreground">
                      <a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noopener noreferrer" title="Open repository">
                        <ExternalLink className="size-3" />
                      </a>
                    </Button>
                    {canManageGithub && <button
                      type="button"
                      onClick={() => setDisconnectTargetRepo({ id: repo.id, fullName: repo.fullName })}
                      className="text-muted-foreground/30 hover:text-destructive p-1 rounded transition-colors"
                      title="Disconnect repository"
                    >
                      <Trash2 className="size-3" />
                    </button>}
                  </div>
                </div>
              ))}

              {repositories.length === 0 && !isReposLoading && !isReposError && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No repositories added to workspace cache yet. Click &ldquo;Add Repo&rdquo; to add.
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Add Repository Modal */}
      <AddRepositoryDialog
        open={isAddRepoOpen}
        onOpenChange={setIsAddRepoOpen}
      />

      {/* Connect Organization Modal */}
      <ConnectOrganizationDialog
        open={isConnectOrgOpen}
        onOpenChange={setIsConnectOrgOpen}
      />

      {/* Disconnect Organization Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!disconnectTargetOrg}
        onOpenChange={(open) => !open && setDisconnectTargetOrg(null)}
        title={`Disconnect GitHub organization "${disconnectTargetOrg?.name}"?`}
        description="This will remove organization access and unlink repositories associated with this installation."
        confirmLabel="Disconnect"
        onConfirm={() => {
          if (disconnectTargetOrg) {
            deleteOrgMutation.mutate(disconnectTargetOrg.id);
            setDisconnectTargetOrg(null);
          }
        }}
      />

      {/* Disconnect Repo Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={!!disconnectTargetRepo}
        onOpenChange={(open) => !open && setDisconnectTargetRepo(null)}
        title={`Disconnect repository "${disconnectTargetRepo?.fullName}"?`}
        description="This will disconnect GitHub webhook syncing and branch tracking for this repository."
        confirmLabel="Disconnect"
        onConfirm={() => {
          if (disconnectTargetRepo) {
            deleteRepoMutation.mutate(disconnectTargetRepo.id);
            setDisconnectTargetRepo(null);
          }
        }}
      />
    </div>
  );
}
