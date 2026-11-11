import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage, Button, Skeleton, cn, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableSortHead, Alert, Spinner, Progress } from '@reka/ui';
import {
  Plus, Calendar, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Circle, CircleDot, CirclePause, CircleX,
  Minus, SignalLow, SignalMedium, SignalHigh,
  FolderKanban,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { resolveEntityIcon } from '../../../components/entity-icon-picker';
import { WorkPageHeader } from '../../../components/common/work-list';
import { useAuth } from '../../auth/hooks/use-auth';
import { PRIORITY_CONFIG } from '../../issues/components/priority-picker';
import { useTeams } from '../../teams/hooks/use-teams';
import { useUsers } from '../../users/hooks/use-users';
import { useProjects } from '../hooks/use-projects';
import { CreateProjectDialog } from './create-project-dialog';
import { EmptyState, PageContainer } from '../../../components/common/page';
import type { Project } from '../api/projects.api';

const PROJECT_STATUSES = [
  { key: 'in_progress', label: 'In progress', icon: CircleDot, color: 'text-info' },
  { key: 'planned', label: 'Planned', icon: Circle, color: 'text-highlight' },
  { key: 'paused', label: 'Paused', icon: CirclePause, color: 'text-warning' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-success' },
  { key: 'canceled', label: 'Canceled', icon: CircleX, color: 'text-muted-foreground' },
] as const;
const PROJECT_HEALTH = [
  { key: 'on_track', label: 'On track', icon: CheckCircle2, color: 'text-success' },
  { key: 'at_risk', label: 'At risk', icon: AlertTriangle, color: 'text-warning-foreground' },
  { key: 'off_track', label: 'Off track', icon: AlertCircle, color: 'text-destructive' },
] as const;

function ProjectHealth({ health }: { health: Project['health'] }) {
  const option = PROJECT_HEALTH.find(item => item.key === health);
  if (!option) return <span className="text-muted-foreground">—</span>;
  const Icon = option.icon;
  let colorClass = 'border-destructive/30 bg-destructive/10 text-destructive';
  if (health === 'on_track') {
    colorClass = 'border-success/30 bg-success/10 text-success';
  } else if (health === 'at_risk') {
    colorClass = 'border-warning/30 bg-warning/10 text-warning';
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', colorClass)}>
      <Icon className="size-3 shrink-0" />
      <span>{option.label}</span>
    </span>
  );
}

function ProjectPriority({ priority, 'aria-label': label }: { priority: Project['priority']; 'aria-label'?: string }) {
  const Icon = { urgent: AlertCircle, high: SignalHigh, medium: SignalMedium, low: SignalLow, no_priority: Minus }[priority] ?? Minus;
  return <Icon role="img" aria-label={label} aria-hidden={label ? undefined : 'true'} className={cn('size-3.5 shrink-0', priority === 'urgent' ? 'text-destructive' : 'text-muted-foreground')} />;
}

export function ProjectsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<Project['status']>('in_progress');
  const [sortDirection, setSortDirection] = React.useState('asc');
  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeams();
  const usersById = new Map(users.map(person => [person.id, person]));
  const teamId = new URLSearchParams(location.search).get('teamId');
  const scopedProjects = teamId
    ? projects.filter(project => project.teamId === teamId || project.teamIds?.includes(teamId) || project.teams?.some(t => t.id === teamId))
    : projects;
  const canCreate = !!user && ['owner', 'admin', 'member'].includes(user.role)
    && teams.some(team => (!teamId || team.id === teamId) && team.canWrite);
  const sortedProjects = [...scopedProjects].sort((a, b) => (sortDirection === 'asc' ? 1 : -1) * (a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
  const openCreate = (status: Project['status'] = 'in_progress') => { setCreateStatus(status); setIsCreateOpen(true); };

  return (
    <PageContainer className="projects-page @container selection:bg-foreground selection:text-background">
      <WorkPageHeader title="Projects" count={scopedProjects.length} description={teamId ? 'Projects owned by this team.' : 'Track project status, progress, and ownership.'}>
        {canCreate && <Button className="px-3" onClick={() => openCreate()}><Plus data-icon="inline-start" />New project</Button>}
      </WorkPageHeader>

      {isLoading && <div className="flex flex-col gap-2"><Spinner aria-label="Loading projects" className="sr-only" />
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full rounded-lg" />)}
      </div>}
      {isError && <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
        <span>Failed to load projects from server.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
      </Alert>}
      {!isLoading && !isError && (scopedProjects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" description="Projects group issues toward a shared goal and deadline."
          action={canCreate && <Button variant="outline" onClick={() => openCreate()}><Plus data-icon="inline-start" />New project</Button>} />
      ) : (
        <Table aria-label="Projects" className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableSortHead direction={sortDirection === 'asc' ? 'asc' : 'desc'} onSort={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} sortLabel={`Sort projects by name ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}>Name</TableSortHead>
                <TableHead className="hidden @min-[56rem]:table-cell @min-[56rem]:w-28">Health</TableHead>
                <TableHead className="hidden @min-[56rem]:table-cell @min-[56rem]:w-16">Priority</TableHead>
                <TableHead className="hidden @min-[56rem]:table-cell @min-[56rem]:w-14">Lead</TableHead>
                <TableHead className="hidden @min-[56rem]:table-cell @min-[56rem]:w-36">Target date</TableHead>
                <TableHead className="hidden text-right @min-[56rem]:table-cell @min-[56rem]:w-14">Issues</TableHead>
                <TableHead className="w-20 text-right @min-[56rem]:w-24">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map(project => {
                const progress = typeof project.progress === 'number' && Number.isFinite(project.progress) ? Math.min(100, Math.max(0, project.progress)) : null;
                const target = project.targetDate ? new Date(project.targetDate) : null;
                const targetLabel = target && !Number.isNaN(target.getTime()) ? target.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No target date';
                const lead = usersById.get(project.ownerId);
                const initials = lead?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
                const status = PROJECT_STATUSES.find(item => item.key === project.status);
                const StatusIcon = status?.icon ?? Circle;
                const ProjectIcon = resolveEntityIcon(project.icon);
                const priority = PRIORITY_CONFIG.find(item => item.key === project.priority)?.label ?? 'None';
                return (
                  <TableRow key={project.id} data-project-id={project.id} data-work-list-row="">
                    <TableCell className="whitespace-normal @max-[50rem]:py-3">
                      <Link to={`/projects/${project.id}${location.search}`} className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open project ${project.name}`}>
                        <span className="flex min-w-0 items-center gap-3"><ProjectIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="project-row-title min-w-0 font-medium text-foreground @max-[50rem]:line-clamp-2 @min-[50rem]:truncate" title={project.name}>{project.name}</span></span>
                        <span className="ml-7 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-4 text-muted-foreground @min-[56rem]:hidden">
                          <ProjectHealth health={project.health} />
                          <span className="inline-flex items-center gap-1.5"><ProjectPriority priority={project.priority} />{priority === 'None' ? 'No priority' : priority}</span>
                          {lead && <span className="inline-flex items-center gap-1.5"><Avatar size="sm"><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>{lead.name}</span>}
                          <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0" />{targetLabel}</span>
                          <span>{project.totalIssues ?? '—'} issues</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden @min-[56rem]:table-cell"><ProjectHealth health={project.health} /></TableCell>
                    <TableCell className="hidden @min-[56rem]:table-cell"><ProjectPriority priority={project.priority} aria-label={`Priority: ${priority}`} /></TableCell>
                    <TableCell className="hidden @min-[56rem]:table-cell">{lead ? <Avatar size="sm" aria-label={lead.name} title={lead.name}><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden text-muted-foreground @min-[56rem]:table-cell"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Calendar className="size-3.5 shrink-0" />{targetLabel}</span></TableCell>
                    <TableCell className="hidden text-right tabular-nums @min-[56rem]:table-cell">{project.totalIssues ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-2" title={status?.label}><StatusIcon aria-label={status?.label} className={cn('size-3.5 shrink-0', status?.color)} /><span className="tabular-nums">{progress === null ? '—' : `${progress}%`}</span></span>
                        {progress !== null && <Progress role="meter" aria-label={`${project.name}: ${progress}% complete`} value={progress} className="h-1 w-12 bg-secondary" />}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
        </Table>
      ))}
      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} defaultTeamId={teamId || undefined} defaultStatus={createStatus} />
    </PageContainer>
  );
}
