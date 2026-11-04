import * as React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Skeleton, Select, SelectTrigger, SelectContent, SelectGroup, SelectItem, DatePicker, Tabs, TabsList, TabsTrigger, TabsContent, Avatar, AvatarImage, AvatarFallback, toast, cn, Progress, Spinner } from '@reka/ui';
import {
  Plus, CheckCircle2, AlertTriangle, AlertCircle, Trash2, RefreshCw,
  GitBranch, Lock, Globe, ExternalLink, Users, Circle, CircleDot,
  CirclePause, CircleX, Minus, SignalLow, SignalMedium, SignalHigh,
  Link2, PanelRight, Tag, Star,
} from 'lucide-react';
import { useProject, useUpdateProject, useDeleteProject } from '../hooks/use-projects';
import { useProjectRepositories, useUnlinkProjectRepository } from '../hooks/use-project-repos';
import { ProjectDependenciesPanel, ProjectMilestonesPanel, ProjectUpdatesPanel } from './project-planning-panels';
import { DocumentsPage } from './documents-page';
import { useIssues } from '../../issues/hooks/use-issues';
import { useUsers } from '../../users/hooks/use-users';
import { useTeams } from '../../teams/hooks/use-teams';
import { IssueListView } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { LinkRepositoryDialog } from './link-repository-dialog';
import { ProjectMembersDialog } from './project-members-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { parseProjectDescription } from '../lib/project-description';
import { getIssueStatusCategory, type Issue } from '@reka/types';
import type { Project, ProjectRepository } from '../api/projects.api';
import { useFavorites, useToggleFavorite } from '../../favorites/hooks/use-favorites';
import { useAuth } from '../../auth/hooks/use-auth';

const ProjectDescriptionEditor = React.lazy(() => import('./project-description-editor'));
const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned', icon: Circle },
  { value: 'in_progress', label: 'In Progress', icon: CircleDot },
  { value: 'paused', label: 'Paused', icon: CirclePause },
  { value: 'completed', label: 'Completed', icon: CheckCircle2 },
  { value: 'canceled', label: 'Canceled', icon: CircleX },
];
const PRIORITY_OPTIONS = [
  { value: 'no_priority', label: 'No priority', icon: Minus },
  { value: 'low', label: 'Low', icon: SignalLow },
  { value: 'medium', label: 'Medium', icon: SignalMedium },
  { value: 'high', label: 'High', icon: SignalHigh },
  { value: 'urgent', label: 'Urgent', icon: AlertCircle },
];
const HEALTH_OPTIONS = [
  { value: 'on_track', label: 'On Track', icon: CheckCircle2 },
  { value: 'at_risk', label: 'At Risk', icon: AlertTriangle },
  { value: 'off_track', label: 'Off Track', icon: AlertCircle },
];

const STATUS_COLORS: Record<string, string> = {
  in_progress: 'border-blue-500/30 bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:bg-blue-500/20',
  planned: 'border-purple-500/30 bg-purple-500/10 text-purple-500 dark:text-purple-400 hover:bg-purple-500/20',
  paused: 'border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400 hover:bg-amber-500/20',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20',
  canceled: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20',
};

const STATUS_ICON_COLORS: Record<string, string> = {
  in_progress: 'text-blue-500 dark:text-blue-400',
  planned: 'text-purple-500 dark:text-purple-400',
  paused: 'text-amber-500 dark:text-amber-400',
  completed: 'text-emerald-500 dark:text-emerald-400',
  canceled: 'text-zinc-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20',
  high: 'border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400 hover:bg-amber-500/20',
  medium: 'border-blue-500/30 bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:bg-blue-500/20',
  low: 'border-sky-500/30 bg-sky-500/10 text-sky-500 dark:text-sky-400 hover:bg-sky-500/20',
  no_priority: 'border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted/70',
};

const PRIORITY_ICON_COLORS: Record<string, string> = {
  urgent: 'text-rose-500 dark:text-rose-400',
  high: 'text-amber-500 dark:text-amber-400',
  medium: 'text-blue-500 dark:text-blue-400',
  low: 'text-sky-500 dark:text-sky-400',
  no_priority: 'text-muted-foreground/40',
};

const HEALTH_COLORS: Record<string, string> = {
  on_track: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20',
  at_risk: 'border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400 hover:bg-amber-500/20',
  off_track: 'border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20',
};

const HEALTH_ICON_COLORS: Record<string, string> = {
  on_track: 'text-emerald-500 dark:text-emerald-400',
  at_risk: 'text-amber-500 dark:text-amber-400',
  off_track: 'text-rose-500 dark:text-rose-400',
};

function PropertyBadgeSelect({
  label,
  value,
  options,
  colorMap,
  iconColorMap,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { readonly value: string; readonly label: string; readonly icon: React.ComponentType<{ className?: string }> }[];
  colorMap: Record<string, string>;
  iconColorMap?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  const current = options.find((opt) => opt.value === value) || options[0];
  const CurrentIcon = current.icon;
  const colorClass = colorMap[value] || 'border-border text-foreground hover:bg-muted';
  const iconColor = iconColorMap?.[value];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          'h-6.5 w-auto rounded-full border px-2.5 py-0 text-xs font-medium gap-1.5 transition-all select-none',
          colorClass
        )}
      >
        <span data-slot="select-value" className="flex items-center gap-1.5 font-medium">
          <CurrentIcon className={cn('size-3.5 shrink-0', iconColor)} />
          <span>{current.label}</span>
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          {options.map(({ value: optVal, label: optLabel, icon: Icon }) => {
            const itemIconColor = iconColorMap?.[optVal] || 'text-muted-foreground';
            return (
              <SelectItem key={optVal} value={optVal} className="gap-2 text-xs">
                <Icon className={cn('size-3.5 shrink-0', itemIconColor)} />
                <span className="font-medium">{optLabel}</span>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function LeadBadgePicker({
  leadId,
  users,
  onChange,
}: {
  leadId: string;
  users: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  onChange: (leadId: string) => void;
}) {
  const current = users.find((u) => u.id === leadId);
  return (
    <Select value={leadId} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Project lead"
        className="h-6.5 w-auto rounded-full border border-border/80 bg-muted/40 hover:bg-muted/80 text-foreground px-2.5 py-0 text-xs font-medium gap-1.5 transition-all select-none"
      >
        <span data-slot="select-value" className="flex items-center gap-1.5 font-medium">
          {current ? (
            <>
              <Avatar className="size-4 rounded-full">
                {current.avatarUrl && <AvatarImage src={current.avatarUrl} />}
                <AvatarFallback className="text-[9px] font-bold">
                  {current.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[120px]">{current.name}</span>
            </>
          ) : (
            <>
              <Users className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Select lead</span>
            </>
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function HealthBadge({ health }: { health: Project['health'] }) {
  const option = HEALTH_OPTIONS.find((item) => item.value === health) || HEALTH_OPTIONS[0];
  const Icon = option.icon;
  return <Badge variant={health === 'on_track' ? 'success' : health === 'at_risk' ? 'warning' : 'destructive'}><Icon data-icon="inline-start" />{option.label}</Badge>;
}

function GithubIcon({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.032 1.026 1.032 1.026.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = React.useState('overview');
  const [showProperties, setShowProperties] = React.useState(true);
  const [progressGrouping, setProgressGrouping] = React.useState('assignees');
  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);
  const [issueFilterTab, setIssueFilterTab] = React.useState('all');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isLinkRepoOpen, setIsLinkRepoOpen] = React.useState(false);
  const [isMembersOpen, setIsMembersOpen] = React.useState(false);
  const [unlinkRepoTarget, setUnlinkRepoTarget] = React.useState<ProjectRepository | null>(null);
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { user } = useAuth();
  const canFavorite = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'member';
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const isProjectFavorite = favorites.some(item => item.resourceType === 'project' && item.resourceId === id);
  const { data: allIssues = [], isLoading: isIssuesLoading, isError: isIssuesError, refetch: refetchIssues } = useIssues();
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeams();
  const { data: projectRepos = [], isLoading: isReposLoading, isError: isReposError, refetch: refetchRepos } = useProjectRepositories(id);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const unlinkRepoMutation = useUnlinkProjectRepository(id);
  const projectIssues = React.useMemo(() => allIssues.filter((issue) => issue.projectId === id), [allIssues, id]);
  const filteredIssues = projectIssues.filter((issue) => issueFilterTab === 'active'
    ? ['unstarted', 'started'].includes(getIssueStatusCategory(issue))
    : issueFilterTab === 'done' ? ['completed', 'canceled'].includes(getIssueStatusCategory(issue)) : true);
  const progressIssues = projectIssues.filter((issue) => getIssueStatusCategory(issue) !== 'canceled');
  const completedCount = progressIssues.filter((issue) => getIssueStatusCategory(issue) === 'completed').length;
  const progressPercent = progressIssues.length ? Math.round(completedCount / progressIssues.length * 100) : 0;

  if (isLoading) return <div className="flex flex-col gap-6"><Spinner aria-label="Loading project" className="sr-only" /><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (isError || !project) return (
    <div className="flex flex-col items-center gap-3 py-20">
      <p className="text-sm text-muted-foreground">Failed to load project details.</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
    </div>
  );

  const team = teams.find((team) => team.id === project.teamId);
  const status = STATUS_OPTIONS.find((option) => option.value === project.status) || STATUS_OPTIONS[0];
  const formatDate = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const summary = parseProjectDescription(project.description).split('\n')[0] || '';
  const groups = new Map<string, { name: string; total: number; completed: number }>();
  for (const issue of progressIssues) {
    const items = progressGrouping === 'labels'
      ? issue.labels?.length ? issue.labels.map((label) => ({ id: label.id, name: label.name })) : [{ id: 'none', name: 'No label' }]
      : progressGrouping === 'teams'
        ? [{ id: issue.teamId, name: teams.find((team) => team.id === issue.teamId)?.name || 'Unknown team' }]
        : [{ id: issue.assigneeId || 'none', name: users.find((user) => user.id === issue.assigneeId)?.name || (issue.assigneeId ? 'Unknown assignee' : 'No assignee') }];
    for (const item of items) {
      const group = groups.get(item.id) || { name: item.name, total: 0, completed: 0 };
      group.total++;
      if (getIssueStatusCategory(issue) === 'completed') group.completed++;
      groups.set(item.id, group);
    }
  }

  return (
    <Tabs value={mainTab} onValueChange={setMainTab} className="project-detail -mt-4 gap-0 pb-10 sm:-mt-6">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="w-full min-w-0 overflow-x-auto lg:w-auto lg:flex-1">
        <TabsList variant="category" aria-label="Project views" className="min-w-max">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={isProjectFavorite ? 'Remove project from favorites' : 'Add project to favorites'} title={isProjectFavorite ? 'Remove from favorites' : 'Add to favorites'} disabled={!canFavorite} onClick={() => toggleFavorite.mutate({ resourceType: 'project', resourceId: project.id, favorite: !isProjectFavorite })}><Star className={isProjectFavorite ? 'fill-current text-amber-500' : ''} /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Copy project link" onClick={async () => {
            try { await navigator.clipboard.writeText(window.location.href); toast.success('Project link copied'); }
            catch { toast.error('Could not copy the project link'); }
          }}><Link2 /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle project properties" aria-expanded={showProperties} aria-controls="project-properties" onClick={() => setShowProperties(!showProperties)}><PanelRight /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete project" onClick={() => setIsDeleteDialogOpen(true)}><Trash2 /></Button>
        </div>
      </div>

      <div className={cn('grid min-w-0 gap-8 pt-6', showProperties && 'xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="min-w-0">
          <TabsContent value="overview" forceMount hidden={mainTab !== 'overview'} className="project-overview">
            <header className="flex flex-col items-start gap-4 px-1 pt-6 sm:px-6 sm:pt-12 xl:pt-16">
              <h1 className="max-w-full break-words text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-3xl">{project.name}</h1>
              {summary && <p className="max-w-[70ch] text-base leading-7 text-foreground/80">{summary}</p>}

              {/* Interactive Colored Property Badges */}
              <div className="mt-2 flex flex-col gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <PropertyBadgeSelect
                    label="Project status"
                    value={project.status}
                    options={STATUS_OPTIONS}
                    colorMap={STATUS_COLORS}
                    iconColorMap={STATUS_ICON_COLORS}
                    onChange={(status) => updateMutation.mutate({ id: project.id, data: { status } })}
                  />
                  <PropertyBadgeSelect
                    label="Project priority"
                    value={project.priority}
                    options={PRIORITY_OPTIONS}
                    colorMap={PRIORITY_COLORS}
                    iconColorMap={PRIORITY_ICON_COLORS}
                    onChange={(priority) => updateMutation.mutate({ id: project.id, data: { priority } })}
                  />
                  <PropertyBadgeSelect
                    label="Project health"
                    value={project.health}
                    options={HEALTH_OPTIONS}
                    colorMap={HEALTH_COLORS}
                    iconColorMap={HEALTH_ICON_COLORS}
                    onChange={(health) => updateMutation.mutate({ id: project.id, data: { health } })}
                  />
                  <LeadBadgePicker
                    leadId={project.ownerId}
                    users={users}
                    onChange={(ownerId) => updateMutation.mutate({ id: project.id, data: { ownerId } })}
                  />
                  <DatePicker
                    date={project.startDate ? new Date(project.startDate) : undefined}
                    placeholder="Set start date"
                    aria-label="Start date"
                    className="h-6.5 w-auto rounded-full border-border/80 bg-muted/40 hover:bg-muted/80 text-foreground px-2.5 text-xs font-medium"
                    onDateChange={(date) => updateMutation.mutate({ id: project.id, data: { startDate: date?.toISOString() ?? null } })}
                  />
                  <DatePicker
                    date={project.targetDate ? new Date(project.targetDate) : undefined}
                    placeholder="Set target date"
                    aria-label="Target date"
                    className="h-6.5 w-auto rounded-full border-border/80 bg-muted/40 hover:bg-muted/80 text-foreground px-2.5 text-xs font-medium"
                    onDateChange={(date) => updateMutation.mutate({ id: project.id, data: { targetDate: date?.toISOString() ?? null } })}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMembersOpen(true)}
                    className="h-6.5 rounded-full border-border/80 bg-muted/40 hover:bg-muted/80 text-foreground px-2.5 text-xs font-medium gap-1.5"
                  >
                    <Users className="size-3.5 text-muted-foreground" />
                    <span>Manage members</span>
                  </Button>
                </div>

                {/* Team & Resources sub-bar */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs pt-0.5">
                  {team && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">Team</span>
                      <Link
                        to={`/teams/${team.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2.5 py-0.5 text-xs hover:bg-muted transition-colors font-medium text-foreground"
                      >
                        <span aria-hidden="true" className="inline-flex size-4 shrink-0 items-center justify-center rounded border border-border bg-background text-[8px] font-semibold text-muted-foreground">
                          {team.key}
                        </span>
                        <span>{team.name}</span>
                      </Link>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">Resources</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {projectRepos.slice(0, 2).map((repo) => (
                        <a
                          key={repo.id}
                          href={`https://github.com/${repo.fullName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2.5 py-0.5 text-xs hover:underline text-foreground transition-colors"
                        >
                          <GithubIcon className="size-3 text-muted-foreground" />
                          <span>{repo.name}</span>
                        </a>
                      ))}
                      {!projectRepos.length && (
                        <span className="text-muted-foreground text-xs">
                          {isReposLoading ? 'Loading…' : isReposError ? 'Unavailable' : 'No repo connected'}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Connect repository"
                        className="size-5 rounded-full"
                        onClick={() => setIsLinkRepoOpen(true)}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <Card className="project-snapshot mx-1 mt-8 gap-4 sm:mx-4">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Project status</CardTitle>
                <CardDescription>{project.updatedAt ? `Updated ${formatDate(project.updatedAt)}` : 'Current project snapshot'}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3"><HealthBadge health={project.health} /><span className="text-sm text-muted-foreground">{status.label}</span></div>
                <p className="text-base leading-7">{isIssuesLoading ? 'Loading project progress…' : isIssuesError ? 'Project progress is currently unavailable.' : `${completedCount} of ${progressIssues.length} active issues completed.${project.targetDate ? ` Target date is ${formatDate(project.targetDate)}.` : ' No target date set.'}`}</p>
              </CardContent>
            </Card>

            <div className="mt-10 px-1 sm:px-6">
              <React.Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <ProjectDescriptionEditor key={project.id} projectId={project.id} description={project.description} />
              </React.Suspense>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="flex flex-col gap-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold tracking-tight">Project issues</h1><Button size="sm" onClick={() => setIsCreateIssueOpen(true)}><Plus data-icon="inline-start" />Add Issue</Button></div>
            <div className="flex flex-wrap gap-1" aria-label="Issue filters">
              {[{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'done', label: 'Done' }].map((tab) => <Button key={tab.id} variant="category" size="sm" aria-pressed={issueFilterTab === tab.id} onClick={() => setIssueFilterTab(tab.id)}>{tab.label}</Button>)}
            </div>
            {isIssuesLoading ? <Skeleton className="h-48 w-full" /> : isIssuesError ? <div className="flex items-center gap-3"><p className="text-sm text-muted-foreground">Could not load project issues.</p><Button variant="outline" size="sm" onClick={() => refetchIssues()}>Retry</Button></div> : <IssueListView issues={filteredIssues} onSelectIssue={(issue) => { setSelectedIssue(issue); setIsIssueDetailOpen(true); }} />}
          </TabsContent>

          <TabsContent value="milestones" className="flex flex-col gap-5 py-3">
            <ProjectMilestonesPanel projectId={project.id} issues={projectIssues} />
          </TabsContent>

          <TabsContent value="dependencies" className="flex flex-col gap-5 py-3">
            <ProjectDependenciesPanel project={project} />
          </TabsContent>

          <TabsContent value="updates" className="flex flex-col gap-5 py-3">
            <ProjectUpdatesPanel projectId={project.id} />
          </TabsContent>

          <TabsContent value="documents" className="flex flex-col gap-5 py-3">
            <DocumentsPage fixedProjectId={project.id} />
          </TabsContent>

          <TabsContent value="repositories" className="flex flex-col gap-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold tracking-tight">Repositories</h1><Button size="sm" onClick={() => setIsLinkRepoOpen(true)}><Plus data-icon="inline-start" />Connect Repository</Button></div>
            {isReposLoading ? <Skeleton className="h-40 w-full" /> : isReposError ? <div className="flex items-center gap-3"><p className="text-sm text-muted-foreground">Could not load repositories.</p><Button variant="outline" size="sm" onClick={() => refetchRepos()}>Retry</Button></div> : projectRepos.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center"><GithubIcon className="size-8 text-muted-foreground" /><h2 className="text-sm font-medium">No repositories connected</h2><p className="max-w-sm text-sm text-muted-foreground">Connect GitHub repositories to link pull requests and branches to this project.</p><Button variant="outline" size="sm" onClick={() => setIsLinkRepoOpen(true)}>Connect Repository</Button></div>
            ) : <div className="flex flex-col divide-y divide-border">
              {projectRepos.map((repo) => <div key={repo.id} className="flex items-start justify-between gap-3 py-4">
                <div className="flex min-w-0 gap-3"><GithubIcon className="mt-1 size-5 shrink-0 text-muted-foreground" /><div className="min-w-0"><a href={`https://github.com/${repo.fullName}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-2 text-sm font-medium hover:underline"><span className="truncate">{repo.fullName}</span><ExternalLink className="size-3 shrink-0" /></a><div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><GitBranch className="size-3" />{repo.defaultBranch || 'main'}</span><Badge variant="outline">{repo.isPrivate ? <Lock data-icon="inline-start" /> : <Globe data-icon="inline-start" />}{repo.isPrivate ? 'Private' : 'Public'}</Badge></div></div></div>
                <Button variant="ghost" size="icon-sm" aria-label={`Disconnect ${repo.fullName}`} onClick={() => setUnlinkRepoTarget(repo)}><Trash2 /></Button>
              </div>)}
              <p className="py-4 text-sm leading-6 text-muted-foreground">Branches and pull requests containing issue identifiers automatically link to project issues.</p>
            </div>}
          </TabsContent>
        </div>

        {showProperties && <aside id="project-properties" aria-label="Project properties" className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100svh-148px)] xl:overflow-y-auto xl:overscroll-contain">
          <Card className="project-side-panel gap-3.5">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</CardTitle>
              <Badge variant="outline" className="font-mono text-xs font-semibold">{progressPercent}%</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {isIssuesLoading ? <Skeleton className="h-24 w-full" /> : isIssuesError ? <p className="text-sm text-muted-foreground">Progress unavailable</p> : <>
                <Progress aria-label="Project completion" value={progressPercent} className="h-2 rounded-full bg-secondary" />
                <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Scope</span>
                    <span className="font-mono text-base font-semibold tabular-nums text-foreground">{projectIssues.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Completed</span>
                    <span className="font-mono text-base font-semibold tabular-nums text-foreground">{completedCount}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5" aria-label="Group project progress">
                  {['assignees', 'labels', 'teams'].map((group) => (
                    <Button
                      key={group}
                      type="button"
                      variant={progressGrouping === group ? 'secondary' : 'ghost'}
                      size="xs"
                      className="flex-1 h-6 text-xs font-medium"
                      aria-pressed={progressGrouping === group}
                      onClick={() => setProgressGrouping(group)}
                    >
                      {group === 'assignees' ? 'Assignees' : group === 'labels' ? 'Labels' : 'Teams'}
                    </Button>
                  ))}
                </div>
                <ul className="flex flex-col gap-2.5">
                  {Array.from(groups, ([id, group]) => {
                    const pct = group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0;
                    return (
                      <li key={id} className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-foreground font-medium">
                            {progressGrouping === 'labels' ? <Tag className="size-3 text-muted-foreground shrink-0" /> : <Users className="size-3 text-muted-foreground shrink-0" />}
                            <span className="truncate max-w-[170px]">{group.name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {group.completed}/{group.total}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                          <div className="h-full bg-primary/70 transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {!projectIssues.length && <p className="text-xs text-muted-foreground">No issues in this project yet.</p>}
              </>}
            </CardContent>
          </Card>
          <Link to={`/projects${location.search}`} className="px-1 py-2 text-xs text-muted-foreground hover:text-foreground">Back to Projects</Link>
        </aside>}
      </div>

      <CreateIssueDialog open={isCreateIssueOpen} onOpenChange={setIsCreateIssueOpen} defaultProjectId={project.id} defaultTeamId={project.teamId ?? undefined} />
      <IssueDetailSheet issue={selectedIssue} open={isIssueDetailOpen} onOpenChange={setIsIssueDetailOpen} />
      <ConfirmDeleteDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen} title={`Delete project "${project.name}"?`} description="This will permanently delete this project and disassociate its issues." onConfirm={() => deleteMutation.mutate(project.id, { onSuccess: () => navigate('/projects') })} />
      <ProjectMembersDialog projectId={project.id} projectName={project.name} open={isMembersOpen} onOpenChange={setIsMembersOpen} />
      <LinkRepositoryDialog projectId={project.id} projectName={project.name} linkedRepositories={projectRepos} open={isLinkRepoOpen} onOpenChange={setIsLinkRepoOpen} />
      <ConfirmDeleteDialog open={!!unlinkRepoTarget} onOpenChange={(open) => !open && setUnlinkRepoTarget(null)} title={`Disconnect repository "${unlinkRepoTarget?.fullName}"?`} description="This will disconnect this repository from the project. Webhook events will no longer link commits/PRs to this specific project." onConfirm={() => { if (unlinkRepoTarget) unlinkRepoMutation.mutate(unlinkRepoTarget.id); }} />
    </Tabs>
  );
}
