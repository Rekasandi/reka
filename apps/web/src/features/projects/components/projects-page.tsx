import * as React from 'react';
import {
  Avatar, AvatarFallback, AvatarImage, Button, Skeleton, cn,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@reka/ui';
import {
  Plus, Calendar, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Circle, CircleDot, CirclePause, CircleX, ArrowDown, ArrowUp,
  Minus, SignalLow, SignalMedium, SignalHigh,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { resolveEntityIcon } from '../../../components/entity-icon-picker';
import { WorkPageHeader, WorkListGroupHeader } from '../../../components/common/work-list';
import { useAuthStore } from '../../../stores/auth.store';
import { PRIORITY_CONFIG } from '../../issues/components/priority-picker';
import { useTeams } from '../../teams/hooks/use-teams';
import { useUsers } from '../../users/hooks/use-users';
import { useProjects } from '../hooks/use-projects';
import { CreateProjectDialog } from './create-project-dialog';
import type { Project } from '../api/projects.api';

const PROJECT_STATUSES = [
  { key: 'in_progress', label: 'In progress', icon: CircleDot, color: 'text-foreground' },
  { key: 'planned', label: 'Planned', icon: Circle, color: 'text-muted-foreground' },
  { key: 'paused', label: 'Paused', icon: CirclePause, color: 'text-muted-foreground' },
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
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', option.color)}><Icon className="size-3.5 shrink-0" />{option.label}</span>;
}

function ProjectPriority({ priority }: { priority: Project['priority'] }) {
  const Icon = { urgent: AlertCircle, high: SignalHigh, medium: SignalMedium, low: SignalLow, no_priority: Minus }[priority] ?? Minus;
  return <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', priority === 'urgent' ? 'text-destructive' : 'text-muted-foreground')} />;
}

export function ProjectsPage() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<Project['status']>('in_progress');
  const [sortDirection, setSortDirection] = React.useState('asc');
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const { data: users = [] } = useUsers();
  const { data: teams = [] } = useTeams();
  const usersById = new Map(users.map(person => [person.id, person]));
  const teamId = new URLSearchParams(location.search).get('teamId');
  const scopedProjects = teamId ? projects.filter(project => project.teamId === teamId) : projects;
  const canCreate = !!user && ['owner', 'admin', 'member'].includes(user.role)
    && teams.some(team => (!teamId || team.id === teamId) && team.canWrite);
  const sortedProjects = [...scopedProjects].sort((a, b) => (sortDirection === 'asc' ? 1 : -1) * (a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
  const groups = PROJECT_STATUSES.map(status => ({ ...status, projects: sortedProjects.filter(project => project.status === status.key) })).filter(group => group.projects.length);
  const SortIcon = sortDirection === 'asc' ? ArrowDown : ArrowUp;
  const openCreate = (status: Project['status'] = 'in_progress') => { setCreateStatus(status); setIsCreateOpen(true); };

  return (
    <div className="projects-page @container mx-auto flex min-w-0 max-w-none flex-col gap-5 pb-10 selection:bg-foreground selection:text-background [&_[data-slot=table-container]]:overflow-visible">
      <WorkPageHeader title="Projects" count={scopedProjects.length} description={teamId ? 'Projects owned by this team.' : 'Track project status, progress, and ownership.'}>
        {canCreate && <Button className="px-3" onClick={() => openCreate()}><Plus data-icon="inline-start" />New project</Button>}
      </WorkPageHeader>

      {isLoading && <div role="status" aria-label="Loading projects" className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full rounded-lg" />)}
      </div>}
      {isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
        <span>Failed to load projects from server.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
      </div>}
      {!isLoading && !isError && (scopedProjects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 bg-card/10 p-14 text-center text-xs text-muted-foreground">
          <p>No projects yet.</p>
          {canCreate && <Button size="sm" variant="outline" onClick={() => openCreate()}><Plus data-icon="inline-start" />New project</Button>}
        </div>
      ) : (
        <Table aria-label="Projects" className="table-fixed text-xs leading-4">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>
                <Button variant="ghost" size="xs" className="border-0" onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} aria-label={`Sort projects by name ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}>
                  Name<SortIcon data-icon="inline-end" />
                </Button>
              </TableHead>
              <TableHead className="hidden text-muted-foreground @min-[56rem]:table-cell @min-[56rem]:w-28">Health</TableHead>
              <TableHead className="hidden text-muted-foreground @min-[56rem]:table-cell @min-[56rem]:w-16">Priority</TableHead>
              <TableHead className="hidden text-muted-foreground @min-[56rem]:table-cell @min-[56rem]:w-14">Lead</TableHead>
              <TableHead className="hidden text-muted-foreground @min-[56rem]:table-cell @min-[56rem]:w-36">Target date</TableHead>
              <TableHead className="hidden text-right text-muted-foreground @min-[56rem]:table-cell @min-[56rem]:w-14">Issues</TableHead>
              <TableHead className="w-20 text-right text-muted-foreground @min-[56rem]:w-24">Status</TableHead>
            </TableRow>
          </TableHeader>
          {groups.map((group, groupIndex) => {
            const collapsed = !!collapsedGroups[group.key];
            const GroupIcon = group.icon;
            const contentId = `project-group-${group.key}`;
            const groupHeader = <WorkListGroupHeader label={group.label} count={group.projects.length} icon={<GroupIcon className={cn('size-3.5', group.color)} />} resource="projects"
              collapsed={collapsed} controlsId={contentId} sticky={false} onToggle={() => setCollapsedGroups(previous => ({ ...previous, [group.key]: !previous[group.key] }))}
              onCreate={canCreate ? () => openCreate(group.key) : undefined} />;
            return <React.Fragment key={group.key}>
              {groupIndex > 0 && <TableBody aria-hidden="true"><TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={2} className="h-5 p-0 @min-[56rem]:hidden" />
                <TableCell colSpan={7} className="hidden h-5 p-0 @min-[56rem]:table-cell" />
              </TableRow></TableBody>}
              <TableBody><TableRow data-project-group-header={group.key} className="sticky top-0 z-20 border-0 hover:bg-transparent has-aria-expanded:bg-transparent">
                {/* Match the visible column count so native table layout does not create empty mobile columns. */}
                <TableCell colSpan={2} className="p-0 @min-[56rem]:hidden">{groupHeader}</TableCell>
                <TableCell colSpan={7} className="hidden p-0 @min-[56rem]:table-cell">{groupHeader}</TableCell>
              </TableRow></TableBody>
              <TableBody id={contentId} hidden={collapsed} aria-label={`${group.label} projects`} className="border-b border-border/40">
              {!collapsed && group.projects.map(project => {
                const progress = typeof project.progress === 'number' && Number.isFinite(project.progress) ? Math.min(100, Math.max(0, project.progress)) : null;
                const target = project.targetDate ? new Date(project.targetDate) : null;
                const targetLabel = target && !Number.isNaN(target.getTime()) ? target.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No target date';
                const lead = usersById.get(project.ownerId);
                const initials = lead?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
                const status = PROJECT_STATUSES.find(item => item.key === project.status);
                const StatusIcon = status?.icon ?? Circle;
                const ProjectIcon = resolveEntityIcon(project.icon);
                const priority = PRIORITY_CONFIG.find(item => item.key === project.priority)?.label ?? 'None';
                return <TableRow key={project.id} data-project-id={project.id} data-work-list-row="" className="h-10 border-border/40 hover:bg-muted/40">
                  <TableCell className="whitespace-normal py-2 @max-[50rem]:py-3">
                    <Link to={`/projects/${project.id}${location.search}`} className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open project ${project.name}`}>
                      <span className="flex min-w-0 items-center gap-3"><ProjectIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="project-row-title min-w-0 text-[13px] leading-5 font-normal tracking-tight text-foreground @max-[50rem]:line-clamp-2 @max-[50rem]:text-sm @max-[50rem]:leading-[22px] @min-[50rem]:truncate" title={project.name}>{project.name}</span></span>
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
                  <TableCell className="hidden @min-[56rem]:table-cell"><span role="img" aria-label={`Priority: ${priority}`}><ProjectPriority priority={project.priority} /></span></TableCell>
                  <TableCell className="hidden @min-[56rem]:table-cell">{lead ? <Avatar size="sm" aria-label={lead.name} title={lead.name}><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden text-muted-foreground @min-[56rem]:table-cell"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Calendar className="size-3.5 shrink-0" />{targetLabel}</span></TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[56rem]:table-cell">{project.totalIssues ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-2" title={status?.label}><StatusIcon aria-label={status?.label} className={cn('size-3.5 shrink-0', status?.color)} /><span className="tabular-nums">{progress === null ? '—' : `${progress}%`}</span></span>
                      {progress !== null && <div role="meter" aria-label={`${project.name}: ${progress}% complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1 w-12 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>}
                    </div>
                  </TableCell>
                </TableRow>;
              })}
              </TableBody>
            </React.Fragment>;
          })}
        </Table>
      ))}
      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} defaultTeamId={teamId || undefined} defaultStatus={createStatus} />
    </div>
  );
}
