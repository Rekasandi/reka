import * as React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button,
  Skeleton, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup,
  SelectItem, DatePicker, Tabs, TabsList, TabsTrigger, TabsContent,
  Avatar, AvatarImage, AvatarFallback, toast, cn,
} from '@reka/ui';
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
import { useFavorites, useToggleFavorite } from '../../views/hooks/use-views';
import { useAuthStore } from '../../../stores/auth.store';

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

function PropertySelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: typeof STATUS_OPTIONS;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} size="sm" className="project-property-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent><SelectGroup>
        {options.map(({ value, label, icon: Icon }) => (
          <SelectItem key={value} value={value}><Icon />{label}</SelectItem>
        ))}
      </SelectGroup></SelectContent>
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
  const { user } = useAuthStore();
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

  if (isLoading) return <div className="flex flex-col gap-6" role="status" aria-label="Loading project"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (isError || !project) return (
    <div className="flex flex-col items-center gap-3 py-20">
      <p className="text-sm text-muted-foreground">Failed to load project details.</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
    </div>
  );

  const lead = users.find((user) => user.id === project.ownerId);
  const team = teams.find((team) => team.id === project.teamId);
  const status = STATUS_OPTIONS.find((option) => option.value === project.status) || STATUS_OPTIONS[0];
  const StatusIcon = status.icon;
  const priority = PRIORITY_OPTIONS.find((option) => option.value === project.priority) || PRIORITY_OPTIONS[0];
  const PriorityIcon = priority.icon;
  const formatDate = (value: string) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const descriptionDoc = parseProjectDescription(project.description);
  const summary = descriptionDoc.content?.find((node) => node.type === 'paragraph' && node.content?.length)?.content?.map((node) => node.text || '').join('');
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
              <dl className="mt-4 flex flex-col gap-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <dt className="w-20 text-muted-foreground">Properties</dt>
                  <dd className="flex items-center gap-2"><StatusIcon className="size-4 text-muted-foreground" />{status.label}</dd>
                  <dd className="flex items-center gap-2"><PriorityIcon className="size-4 text-muted-foreground" />{priority.label}</dd>
                  {lead && <dd className="flex items-center gap-2"><Avatar className="size-5"><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{lead.name.slice(0, 2)}</AvatarFallback></Avatar>{lead.name}</dd>}
                  {project.targetDate && <dd className="text-muted-foreground">Due {formatDate(project.targetDate)}</dd>}
                </div>
                {team && <div className="flex flex-wrap items-center gap-x-5 gap-y-3"><dt className="w-20 text-muted-foreground">Team</dt><dd><Link to={`/teams/${team.id}`} className="inline-flex items-center gap-2 hover:underline"><span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-border bg-muted px-0.5 text-[9px] font-semibold text-muted-foreground">{team.key}</span>{team.name}</Link></dd></div>}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <dt className="w-20 text-muted-foreground">Resources</dt>
                  <dd className="flex flex-wrap items-center gap-3">
                    {projectRepos.slice(0, 2).map((repo) => <a key={repo.id} href={`https://github.com/${repo.fullName}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline"><GithubIcon className="size-4 text-muted-foreground" />{repo.name}</a>)}
                    {!projectRepos.length && <span className="text-muted-foreground">{isReposLoading ? 'Loading repositories…' : isReposError ? 'Repositories unavailable' : 'No repositories connected'}</span>}
                    <Button variant="ghost" size="icon-sm" aria-label="Connect repository" onClick={() => setIsLinkRepoOpen(true)}><Plus /></Button>
                  </dd>
                </div>
              </dl>
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
          <Card className="project-side-panel gap-4">
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Properties</CardTitle></CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4 text-sm">
                <div className="project-property-row"><dt>Status</dt><dd><PropertySelect label="Project status" value={project.status} options={STATUS_OPTIONS} onChange={(status) => updateMutation.mutate({ id: project.id, data: { status } })} /></dd></div>
                <div className="project-property-row"><dt>Priority</dt><dd><PropertySelect label="Project priority" value={project.priority} options={PRIORITY_OPTIONS} onChange={(priority) => updateMutation.mutate({ id: project.id, data: { priority } })} /></dd></div>
                <div className="project-property-row"><dt>Health</dt><dd><PropertySelect label="Project health" value={project.health} options={HEALTH_OPTIONS} onChange={(health) => updateMutation.mutate({ id: project.id, data: { health } })} /></dd></div>
                <div className="project-property-row"><dt>Lead</dt><dd><Select value={project.ownerId} onValueChange={(ownerId) => updateMutation.mutate({ id: project.id, data: { ownerId } })}><SelectTrigger aria-label="Project lead" size="sm" className="project-property-select"><SelectValue placeholder="Select lead" /></SelectTrigger><SelectContent><SelectGroup>{users.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>)}</SelectGroup></SelectContent></Select></dd></div>
                <div className="project-property-row"><dt>Members</dt><dd><Button variant="ghost" size="sm" onClick={() => setIsMembersOpen(true)}><Users data-icon="inline-start" />Manage members</Button></dd></div>
                <div className="project-property-row"><dt>Dates</dt><dd className="flex min-w-0 flex-col gap-2"><label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Start date<DatePicker date={project.startDate ? new Date(project.startDate) : undefined} placeholder="Set start date" onDateChange={(date) => updateMutation.mutate({ id: project.id, data: { startDate: date?.toISOString() ?? null } })} /></label><label className="flex flex-col gap-1 text-[11px] text-muted-foreground">Target date<DatePicker date={project.targetDate ? new Date(project.targetDate) : undefined} placeholder="Set target date" onDateChange={(date) => updateMutation.mutate({ id: project.id, data: { targetDate: date?.toISOString() ?? null } })} /></label></dd></div>
                <div className="project-property-row"><dt>Team</dt><dd className="py-1">{team ? <Link to={`/teams/${team.id}`} className="flex items-center gap-2 hover:underline"><span aria-hidden="true" className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-border bg-muted px-0.5 text-[9px] font-semibold text-muted-foreground">{team.key}</span><span className="truncate">{team.name}</span></Link> : <span className="text-muted-foreground">No team</span>}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card className="project-side-panel gap-4">
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-5">
              {isIssuesLoading ? <Skeleton className="h-24 w-full" /> : isIssuesError ? <p className="text-sm text-muted-foreground">Progress unavailable</p> : <>
                <dl className="grid grid-cols-2 gap-4 text-sm"><div className="flex flex-col gap-1"><dt className="text-muted-foreground">Scope</dt><dd className="text-lg tabular-nums">{projectIssues.length}</dd></div><div className="flex flex-col gap-1"><dt className="text-muted-foreground">Completed</dt><dd className="text-lg tabular-nums">{completedCount}</dd></div></dl>
                <div className="flex flex-col gap-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Completion</span><span className="tabular-nums">{progressPercent}%</span></div><div role="progressbar" aria-label="Project completion" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} /></div></div>
                <div className="flex flex-wrap gap-1" aria-label="Group project progress">{['assignees', 'labels', 'teams'].map((group) => <Button key={group} variant="category" size="sm" aria-pressed={progressGrouping === group} onClick={() => setProgressGrouping(group)}>{group === 'assignees' ? 'Assignees' : group === 'labels' ? 'Labels' : 'Teams'}</Button>)}</div>
                <ul className="flex flex-col gap-3">{Array.from(groups, ([id, group]) => <li key={id} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2">{progressGrouping === 'labels' ? <Tag className="size-4 shrink-0 text-muted-foreground" /> : <Users className="size-4 shrink-0 text-muted-foreground" />}<span className="truncate">{group.name}</span></span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{group.completed} / {group.total}</span></li>)}</ul>
                {!projectIssues.length && <p className="text-sm text-muted-foreground">No issues in this project yet.</p>}
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
