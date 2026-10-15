import * as React from 'react';
import {
  Avatar, AvatarFallback, AvatarImage, Badge, Button, Input, Skeleton, cn,
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@reka/ui';
import {
  Plus, Calendar, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  Circle, CircleDot, CirclePause, CircleX, ChevronDown, ArrowDown, ArrowUp,
  Filter, SlidersHorizontal, Search, Minus, SignalLow, SignalMedium, SignalHigh,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { resolveEntityIcon } from '../../../components/entity-icon-picker';
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
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0', priority === 'urgent' ? 'text-destructive' : 'text-muted-foreground')} />;
}

export function ProjectsPage() {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<Project['status']>('in_progress');
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterHealth, setFilterHealth] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [groupBy, setGroupBy] = React.useState('status');
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
  const activeFilterCount = Number(filterStatus !== 'all') + Number(filterHealth !== 'all');
  const filteredProjects = scopedProjects.filter(project =>
    (filterStatus === 'all' || project.status === filterStatus)
    && (filterHealth === 'all' || project.health === filterHealth)
    && project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ).sort((a, b) => (sortDirection === 'asc' ? 1 : -1) * (a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
  const groups = groupBy === 'status'
    ? PROJECT_STATUSES.map(status => ({ ...status, projects: filteredProjects.filter(project => project.status === status.key) })).filter(group => group.projects.length)
    : [{ key: 'all', label: 'All projects', icon: Circle, color: 'text-muted-foreground', projects: filteredProjects }];
  const SortIcon = sortDirection === 'asc' ? ArrowDown : ArrowUp;
  const openCreate = (status: Project['status'] = 'in_progress') => { setCreateStatus(status); setIsCreateOpen(true); };
  const clearFilters = () => { setFilterStatus('all'); setFilterHealth('all'); setQuery(''); };

  return (
    <div className="projects-page @container -mt-4 flex min-w-0 flex-col gap-4 pb-10 sm:-mt-6">
      <div className="-mx-4 flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:-mx-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground">Projects</h1>
        {canCreate && <Button onClick={() => openCreate()}><Plus data-icon="inline-start" />New project</Button>}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Project toolbar">
        <Badge variant="outline" className="h-8 gap-2 bg-card px-4 text-sm">All projects <span className="tabular-nums text-muted-foreground">{scopedProjects.length}</span></Badge>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-60">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Filter projects" placeholder="Filter projects…" value={query} onChange={event => setQuery(event.target.value)} className="pl-8" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={activeFilterCount ? 'secondary' : 'outline'} size="icon" className="rounded-full max-sm:size-11" aria-label="Project filters" title={activeFilterCount ? `${activeFilterCount} active filters` : 'Filter projects'}><Filter /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filterStatus} onValueChange={setFilterStatus}>
                <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
                {PROJECT_STATUSES.map(({ key, label, icon: Icon }) => <DropdownMenuRadioItem key={key} value={key}><Icon />{label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Health</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filterHealth} onValueChange={setFilterHealth}>
                <DropdownMenuRadioItem value="all">All health</DropdownMenuRadioItem>
                {PROJECT_HEALTH.map(({ key, label, icon: Icon }) => <DropdownMenuRadioItem key={key} value={key}><Icon />{label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="rounded-full max-sm:size-11" aria-label="Project display options" title="Display options"><SlidersHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Grouping</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={groupBy} onValueChange={setGroupBy}>
                <DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">No grouping</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sort by name</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sortDirection} onValueChange={setSortDirection}>
                <DropdownMenuRadioItem value="asc">A to Z</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">Z to A</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {(activeFilterCount > 0 || query.trim()) && <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status">
        <span>{filteredProjects.length} matching projects</span>
        {filterStatus !== 'all' && <Badge variant="outline">{PROJECT_STATUSES.find(status => status.key === filterStatus)?.label}</Badge>}
        {filterHealth !== 'all' && <Badge variant="outline">{PROJECT_HEALTH.find(health => health.key === filterHealth)?.label}</Badge>}
        {filteredProjects.length > 0 && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
      </div>}

      {isLoading && <div role="status" aria-label="Loading projects" className="flex flex-col gap-2">
        <Skeleton className="h-9 w-full rounded-md" />
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full rounded-md" />)}
      </div>}
      {isError && <div role="alert" className="flex items-center justify-between gap-4 rounded-[6px] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <span>Failed to load projects from server.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
      </div>}
      {!isLoading && !isError && (filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center text-sm text-muted-foreground">
          <p>{scopedProjects.length ? 'No matching projects. Try another search or filter.' : 'No projects yet.'}</p>
          {(activeFilterCount > 0 || query.trim()) ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
            : canCreate && <Button size="sm" variant="outline" onClick={() => openCreate()}><Plus data-icon="inline-start" />New project</Button>}
        </div>
      ) : (
        <Table aria-label="Projects" className="table-fixed text-sm leading-5">
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead aria-sort={sortDirection === 'asc' ? 'ascending' : 'descending'}>
                <Button variant="ghost" size="sm" className="border-0" onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} aria-label={`Sort projects by name ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}>
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
          {groups.map(group => {
            const collapsed = !!collapsedGroups[group.key];
            const GroupIcon = group.icon;
            const contentId = `project-group-${group.key}`;
            const groupHeader = <div className="flex items-center justify-between gap-2 rounded-[6px] bg-secondary px-2 py-1">
                    <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start gap-2 border-0 aria-expanded:bg-transparent" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.label} projects`} aria-expanded={!collapsed} aria-controls={contentId} onClick={() => setCollapsedGroups(previous => ({ ...previous, [group.key]: !previous[group.key] }))}>
                      <ChevronDown className={cn(collapsed && '-rotate-90')} /><GroupIcon className={group.color} />
                      <span>{group.label}</span><span className="tabular-nums text-muted-foreground">{group.projects.length}</span>
                    </Button>
                    {canCreate && <Button variant="ghost" size="icon-sm" className="border-0" aria-label={`New project in ${group.label}`} title={`New project in ${group.label}`} onClick={() => openCreate(group.key as Project['status'])}><Plus /></Button>}
                  </div>;
            return <React.Fragment key={group.key}>
              {groupBy === 'status' && <TableBody><TableRow className="border-0 hover:bg-transparent has-aria-expanded:bg-transparent">
                {/* Match the visible column count so native table layout does not create empty mobile columns. */}
                <TableCell colSpan={2} className="px-0 pb-1 pt-4 @min-[56rem]:hidden">{groupHeader}</TableCell>
                <TableCell colSpan={7} className="hidden px-0 pb-1 pt-4 @min-[56rem]:table-cell">{groupHeader}</TableCell>
              </TableRow></TableBody>}
              <TableBody id={contentId} hidden={groupBy === 'status' && collapsed} aria-label={groupBy === 'status' ? `${group.label} projects` : group.label}>
              {(groupBy !== 'status' || !collapsed) && group.projects.map(project => {
                const progress = typeof project.progress === 'number' && Number.isFinite(project.progress) ? Math.min(100, Math.max(0, project.progress)) : null;
                const target = project.targetDate ? new Date(project.targetDate) : null;
                const targetLabel = target && !Number.isNaN(target.getTime()) ? target.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No target date';
                const lead = usersById.get(project.ownerId);
                const initials = lead?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase();
                const status = PROJECT_STATUSES.find(item => item.key === project.status);
                const StatusIcon = status?.icon ?? Circle;
                const ProjectIcon = resolveEntityIcon(project.icon);
                const priority = PRIORITY_CONFIG.find(item => item.key === project.priority)?.label ?? 'None';
                return <TableRow key={project.id} data-project-id={project.id}>
                  <TableCell className="whitespace-normal py-3 @min-[56rem]:py-4">
                    <Link to={`/projects/${project.id}${location.search}`} className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open project ${project.name}`}>
                      <span className="flex min-w-0 items-center gap-3"><ProjectIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="truncate font-medium text-foreground" title={project.name}>{project.name}</span></span>
                      <span className="ml-7 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-4 text-muted-foreground @min-[56rem]:hidden">
                        <ProjectHealth health={project.health} />
                        <span className="inline-flex items-center gap-1.5"><ProjectPriority priority={project.priority} />{priority === 'None' ? 'No priority' : priority}</span>
                        {lead && <span className="inline-flex items-center gap-1.5"><Avatar size="sm"><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>{lead.name}</span>}
                        <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 shrink-0" />{targetLabel}</span>
                        <span>{project.totalIssues ?? '—'} issues</span>
                        {groupBy === 'none' && <span>{status?.label ?? project.status}</span>}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden @min-[56rem]:table-cell"><ProjectHealth health={project.health} /></TableCell>
                  <TableCell className="hidden @min-[56rem]:table-cell"><span role="img" aria-label={`Priority: ${priority}`}><ProjectPriority priority={project.priority} /></span></TableCell>
                  <TableCell className="hidden @min-[56rem]:table-cell">{lead ? <Avatar size="sm" aria-label={lead.name} title={lead.name}><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden text-muted-foreground @min-[56rem]:table-cell"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Calendar className="size-3.5 shrink-0" />{targetLabel}</span></TableCell>
                  <TableCell className="hidden text-right tabular-nums @min-[56rem]:table-cell">{project.totalIssues ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-2">
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
