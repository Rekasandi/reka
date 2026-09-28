import * as React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  DatePicker,
} from '@reka/ui';
import {
  ArrowLeft,
  Plus,
  FolderKanban,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Target,
  Flag,
  Check,
  GitBranch,
  Lock,
  Globe,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { useProject, useUpdateProject, useDeleteProject } from '../hooks/use-projects';
import { useProjectRepositories, useUnlinkProjectRepository } from '../hooks/use-project-repos';
import { useIssues } from '../../issues/hooks/use-issues';
import { IssueListView } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { LinkRepositoryDialog } from './link-repository-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { Issue } from '@reka/types';
import type { Project, ProjectRepository } from '../api/projects.api';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function HealthBadge({ health }: { health: Project['health'] }) {
  if (health === 'on_track') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-normal gap-1 h-5">
        <CheckCircle2 className="size-2.5" />
        <span>On Track</span>
      </Badge>
    );
  }
  if (health === 'at_risk') {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs font-normal gap-1 h-5">
        <AlertTriangle className="size-2.5" />
        <span>At Risk</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-500 text-xs font-normal gap-1 h-5">
      <AlertCircle className="size-2.5" />
      <span>Off Track</span>
    </Badge>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);
  const [issueFilterTab, setIssueFilterTab] = React.useState('all');

  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { data: allIssues = [] } = useIssues();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  // Filter issues belonging to this project
  const projectIssues = React.useMemo(() => {
    return allIssues.filter((i) => i.projectId === id);
  }, [allIssues, id]);

  const filteredIssues = React.useMemo(() => {
    if (issueFilterTab === 'active') {
      return projectIssues.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'in_review');
    }
    if (issueFilterTab === 'done') {
      return projectIssues.filter((i) => i.status === 'done' || i.status === 'canceled');
    }
    return projectIssues;
  }, [projectIssues, issueFilterTab]);

  const completedCount = projectIssues.filter((i) => i.status === 'done').length;
  const progressPercent = projectIssues.length > 0 ? Math.round((completedCount / projectIssues.length) * 100) : 0;
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isLinkRepoOpen, setIsLinkRepoOpen] = React.useState(false);
  const [unlinkRepoTarget, setUnlinkRepoTarget] = React.useState<ProjectRepository | null>(null);
  const [mainTab, setMainTab] = React.useState<'issues' | 'repositories'>('issues');

  const { data: projectRepos = [], isLoading: isReposLoading } = useProjectRepositories(id);
  const unlinkRepoMutation = useUnlinkProjectRepository(id);

  const handleDelete = () => {
    if (!project) return;
    setIsDeleteDialogOpen(true);
  };

  const handleOpenIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsIssueDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-xs text-destructive flex items-center justify-between max-w-3xl mx-auto">
        <span>Failed to load project details.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const targetDateFormatted = project.targetDate
    ? new Date(project.targetDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No target date';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to={`/projects${location.search}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Projects</span>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleDelete}
          className="text-muted-foreground/50 hover:text-destructive"
          title="Delete project"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Project Overview Card Header */}
      <div className="rounded-lg border border-border/80 bg-card/40 p-6 flex flex-col gap-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70">
              <FolderKanban className="size-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {project.name}
                </h1>
                <HealthBadge health={project.health} />
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                /{project.slug}
              </p>
            </div>
          </div>

          {/* Quick Property Changers */}
          <div className="flex items-center gap-2.5">
            {/* Status Select */}
            <Select
              value={project.status}
              onValueChange={(val) => updateMutation.mutate({ id: project.id, data: { status: val } })}
            >
              <SelectTrigger className="h-8 text-xs bg-background/80 rounded-[6px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Health Select */}
            <Select
              value={project.health}
              onValueChange={(val) => updateMutation.mutate({ id: project.id, data: { health: val } })}
            >
              <SelectTrigger className="h-8 text-xs bg-background/80 rounded-[6px]">
                <SelectValue placeholder="Health" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="off_track">Off Track</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
          {project.description || 'No project description added yet.'}
        </p>

        {/* Progress & Target Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border/50">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Progress</span>
            <div className="flex items-center justify-between text-xs font-mono">
              <span>{completedCount}/{projectIssues.length} issues done</span>
              <span className="font-semibold text-foreground">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Target Date</span>
            <div className="mt-0.5">
              <DatePicker
                date={project.targetDate ? new Date(project.targetDate) : undefined}
                onDateChange={(selected) => {
                  updateMutation.mutate({
                    id: project.id,
                    data: { targetDate: selected ? selected.toISOString() : undefined },
                  });
                }}
                placeholder="Set target date"
                className="h-8 max-w-[200px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Priority</span>
            <div className="flex items-center gap-1.5 text-xs capitalize text-foreground mt-0.5">
              <Target className="size-3.5 text-muted-foreground" />
              <span>{project.priority.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs: Issues vs Repositories */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-1">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setMainTab('issues')}
              className={`flex items-center gap-2 pb-2.5 text-xs font-semibold tracking-tight transition-colors border-b-2 -mb-1.5 ${
                mainTab === 'issues'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Project Issues</span>
              <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                {projectIssues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMainTab('repositories')}
              className={`flex items-center gap-2 pb-2.5 text-xs font-semibold tracking-tight transition-colors border-b-2 -mb-1.5 ${
                mainTab === 'repositories'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <GithubIcon className="size-3.5 text-muted-foreground" />
                <span>Repositories</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                {projectRepos.length}
              </span>
            </button>
          </div>

          <div>
            {mainTab === 'issues' && (
              <Button
                size="sm"
                onClick={() => setIsCreateIssueOpen(true)}
                className="rounded-[6px] h-7 px-2.5 text-xs font-medium gap-1"
              >
                <Plus className="size-3" />
                <span>Add Issue</span>
              </Button>
            )}
            {mainTab === 'repositories' && (
              <Button
                size="sm"
                onClick={() => setIsLinkRepoOpen(true)}
                className="rounded-[6px] h-7 px-2.5 text-xs font-medium gap-1"
              >
                <Plus className="size-3" />
                <span>Connect Repository</span>
              </Button>
            )}
          </div>
        </div>

        {mainTab === 'issues' && (
          <div className="flex flex-col gap-3">
            {/* Filter sub-tabs */}
            <div className="flex items-center gap-1 pb-1">
              {[
                { id: 'all', label: 'All', count: projectIssues.length },
                {
                  id: 'active',
                  label: 'Active',
                  count: projectIssues.filter((i) => i.status !== 'done' && i.status !== 'canceled').length,
                },
                { id: 'done', label: 'Done', count: completedCount },
              ].map((tab) => {
                const isSelected = issueFilterTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setIssueFilterTab(tab.id)}
                    className={`h-6 px-2 text-xs rounded-[5px] font-medium transition-colors flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-foreground text-background shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Issue List View */}
            <IssueListView
              issues={filteredIssues}
              onSelectIssue={handleOpenIssueDetail}
            />
          </div>
        )}

        {mainTab === 'repositories' && (
          /* Repositories List */
          <div className="flex flex-col gap-4">
            {projectRepos.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border rounded-lg flex flex-col items-center gap-2">
                <GithubIcon className="size-7 text-muted-foreground/40" />
                <p className="text-xs font-semibold text-foreground">No repositories connected</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Connect GitHub repositories to link pull requests, branches, and code automation directly to this project.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs mt-2 gap-1.5"
                  onClick={() => setIsLinkRepoOpen(true)}
                >
                  <Plus className="size-3" />
                  <span>Connect Repository</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projectRepos.map((repo) => (
                    <Card
                      key={repo.id}
                      className="rounded-lg border border-border bg-card p-4 shadow-none flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 rounded-[6px] bg-secondary flex items-center justify-center shrink-0 border border-border/80">
                            <GithubIcon className="size-4 text-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://github.com/${repo.fullName}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs font-semibold text-foreground hover:underline flex items-center gap-1 truncate"
                              >
                                <span>{repo.fullName}</span>
                                <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                              </a>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                                <GitBranch className="size-2.5" />
                                {repo.defaultBranch || 'main'}
                              </span>
                              {repo.isPrivate ? (
                                <Badge variant="outline" className="text-xs h-4 px-1 gap-0.5 border-border">
                                  <Lock className="size-2" />
                                  <span>Private</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs h-4 px-1 gap-0.5 border-border">
                                  <Globe className="size-2" />
                                  <span>Public</span>
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setUnlinkRepoTarget(repo)}
                          className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-muted transition-colors shrink-0"
                          title="Disconnect repository"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Helpful GitHub Linking Note */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Code2 className="size-4 shrink-0 text-foreground mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground">GitHub Linking Active: </span>
                    Branches or PRs with issue identifiers (e.g. <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded text-foreground">RS-123</code>) in these repositories will automatically link to issues within this project.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog for creating issue pre-assigned to this project */}
      <CreateIssueDialog
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        defaultProjectId={project.id}
        defaultTeamId={project.teamId ?? undefined}
      />

      {/* Detail Sheet for issues */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isIssueDetailOpen}
        onOpenChange={setIsIssueDetailOpen}
      />

      {/* Delete Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete project "${project.name}"?`}
        description="This will permanently delete this project and disassociate its issues."
        onConfirm={() => {
          deleteMutation.mutate(project.id, {
            onSuccess: () => navigate('/projects'),
          });
        }}
      />

      {/* Connect GitHub Repository Dialog */}
      {project && (
        <LinkRepositoryDialog
          projectId={project.id}
          projectName={project.name}
          linkedRepositories={projectRepos}
          open={isLinkRepoOpen}
          onOpenChange={setIsLinkRepoOpen}
        />
      )}

      {/* Disconnect Repository Confirmation */}
      <ConfirmDeleteDialog
        open={!!unlinkRepoTarget}
        onOpenChange={(open) => !open && setUnlinkRepoTarget(null)}
        title={`Disconnect repository "${unlinkRepoTarget?.fullName}"?`}
        description="This will disconnect this repository from the project. Webhook events will no longer link commits/PRs to this specific project."
        onConfirm={() => {
          if (unlinkRepoTarget) {
            unlinkRepoMutation.mutate(unlinkRepoTarget.id);
            setUnlinkRepoTarget(null);
          }
        }}
      />
    </div>
  );
}
