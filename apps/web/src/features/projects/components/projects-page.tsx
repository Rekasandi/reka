import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Input, Skeleton } from '@reka/ui';
import { Plus, Calendar, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useProjects } from '../hooks/use-projects';
import { useUsers } from '../../users/hooks/use-users';
import { CreateProjectDialog } from './create-project-dialog';
import type { Project } from '../api/projects.api';

function HealthBadge({ health }: { health: Project['health'] }) {
  if (health === 'on_track') {
    return (
      <Badge variant="success">
        <CheckCircle2 data-icon="inline-start" />
        On Track
      </Badge>
    );
  }
  if (health === 'at_risk') {
    return (
      <Badge variant="warning">
        <AlertTriangle data-icon="inline-start" />
        At Risk
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <AlertCircle data-icon="inline-start" />
      Off Track
    </Badge>
  );
}

export function ProjectsPage() {
  const location = useLocation();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const { data: users = [] } = useUsers();
  const teamId = new URLSearchParams(location.search).get('teamId');
  const scopedProjects = teamId ? projects.filter((project) => project.teamId === teamId) : projects;

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'in_progress', label: 'Active' },
    { id: 'planned', label: 'Planned' },
    { id: 'completed', label: 'Completed' },
    { id: 'paused', label: 'Paused' },
    { id: 'canceled', label: 'Canceled' },
  ];
  const filteredProjects = scopedProjects.filter(project =>
    (filterStatus === 'all' || project.status === filterStatus) &&
    project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Projects</h1>
            <Badge variant="outline">{scopedProjects.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Track project status, progress, and ownership.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="self-end sm:self-auto">
          <Plus data-icon="inline-start" />
          New Project
        </Button>
      </div>

      <div className="flex min-w-0 flex-col gap-3 border-b border-border/70 pb-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto" aria-label="Project filters">
        {filterOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant="category"
            size="sm"
            aria-pressed={filterStatus === option.id}
            onClick={() => setFilterStatus(option.id)}
          >
            <span>{option.label}</span>
          </Button>
        ))}
      </div>
      <Input type="search" aria-label="Filter projects" placeholder="Filter projects…" value={query} onChange={event => setQuery(event.target.value)} className="w-full xl:w-64" />
      </div>

      {isLoading && (
        <div role="status" aria-label="Loading projects" className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full rounded-md" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-md" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between gap-3">
          <span>Failed to load projects from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        filteredProjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 p-10 text-center text-sm text-muted-foreground sm:p-14">
            No matching projects. Choose another filter or create a project.
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-muted/20 text-muted-foreground">
                <tr className="border-b border-border/70">
                  <th scope="col" className="px-3 py-2.5 font-medium lg:px-4">Name</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium lg:table-cell lg:w-32">Health</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium lg:table-cell lg:w-12">Lead</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium lg:table-cell lg:w-36">Target date</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-right font-medium lg:table-cell lg:w-16">Issues</th>
                  <th scope="col" className="w-20 px-3 py-2.5 text-right font-medium lg:w-28 lg:px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredProjects.map((project) => {
                  const progress = typeof project.progress === 'number'
                    ? Math.min(100, Math.max(0, project.progress))
                    : null;
                  const target = project.targetDate ? new Date(project.targetDate) : null;
                  const targetLabel = target && !Number.isNaN(target.getTime())
                    ? target.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No target date';
                  const lead = users.find((user) => user.id === project.ownerId);
                  const initials = lead?.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

                  return (
                    <tr key={project.id} className="group transition-colors hover:bg-muted/30">
                      <td className="px-3 py-3 align-middle lg:px-4">
                        <Link
                          to={`/projects/${project.id}${location.search}`}
                          className="block min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          aria-label={`Open project ${project.name}`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground" title={project.name}>{project.name}</span>
                              <span className="mt-1 block text-xs capitalize text-muted-foreground">{project.status.replaceAll('_', ' ')}</span>
                            </span>
                          </span>
                          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted-foreground lg:hidden">
                            <HealthBadge health={project.health} />
                            {lead && <span className="inline-flex items-center gap-1.5"><Avatar size="sm"><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>{lead.name}</span>}
                            <span className="inline-flex items-center gap-1.5"><Calendar className="size-3" />{targetLabel}</span>
                            <span>{project.totalIssues ?? '—'} issues</span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-3 text-right align-middle lg:table-cell"><HealthBadge health={project.health} /></td>
                      <td className="hidden px-3 py-3 text-right align-middle lg:table-cell">
                        {lead ? <Avatar size="sm" aria-label={lead.name} title={lead.name}><AvatarImage src={lead.avatarUrl || undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="hidden px-3 py-3 text-right align-middle text-muted-foreground lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Calendar className="size-3 shrink-0" />{targetLabel}</span>
                      </td>
                      <td className="hidden px-3 py-3 text-right align-middle tabular-nums lg:table-cell">{project.totalIssues ?? '—'}</td>
                      <td className="px-3 py-3 align-middle lg:px-4">
                        <div className="flex flex-col items-end gap-1.5 lg:items-stretch">
                          <span className="tabular-nums text-foreground">{progress === null ? '—' : `${progress}%`}</span>
                          {progress !== null && <div role="meter" aria-label={`${project.name}: ${progress}% complete`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1 w-14 overflow-hidden rounded-full bg-secondary lg:w-full"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} defaultTeamId={teamId || undefined} />
    </div>
  );
}
