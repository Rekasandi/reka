import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Skeleton,
} from '@reka/ui';
import { Plus, FolderKanban, Calendar, CheckCircle2, AlertTriangle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjects, useDeleteProject } from '../hooks/use-projects';
import { CreateProjectDialog } from './create-project-dialog';
import type { Project } from '../api/projects.api';

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

function StatusBadge({ status }: { status: Project['status'] }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    planned: { label: 'Planned', variant: 'outline' },
    in_progress: { label: 'In Progress', variant: 'secondary' },
    paused: { label: 'Paused', variant: 'outline' },
    completed: { label: 'Completed', variant: 'default' },
    canceled: { label: 'Canceled', variant: 'outline' },
  };

  const item = map[status] || { label: status, variant: 'outline' };
  return (
    <Badge variant={item.variant} className="capitalize text-xs font-mono font-normal h-5 px-2">
      {item.label}
    </Badge>
  );
}

export function ProjectsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState('all');

  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const teamId = new URLSearchParams(location.search).get('teamId');
  const scopedProjects = teamId ? projects.filter((project) => project.teamId === teamId) : projects;

  const filterOptions = React.useMemo(() => [
    { id: 'all', label: 'All', count: scopedProjects.length },
    { id: 'in_progress', label: 'Active', count: scopedProjects.filter((p) => p.status === 'in_progress').length },
    { id: 'planned', label: 'Planned', count: scopedProjects.filter((p) => p.status === 'planned').length },
    { id: 'completed', label: 'Completed', count: scopedProjects.filter((p) => p.status === 'completed').length },
  ], [scopedProjects]);

  const filteredProjects = React.useMemo(() => {
    if (filterStatus === 'all') return scopedProjects;
    return scopedProjects.filter((p) => p.status === filterStatus);
  }, [scopedProjects, filterStatus]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Projects</h1>
            <span className="font-mono text-xs font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {scopedProjects.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            What the team is building: delivery streams and cross-functional roadmaps.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="rounded-[6px] h-8 px-3 text-xs font-medium">
          <Plus data-icon="inline-start" className="size-3.5" />
          <span>New Project</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-2">
        {filterOptions.map((opt) => {
          const isSelected = filterStatus === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterStatus(opt.id)}
              className={`h-7 px-2.5 text-xs rounded-[6px] font-medium transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-secondary text-foreground shadow-2xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <span>{opt.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load projects from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Projects Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const progress = p.progress || 0;
            const target = p.targetDate ? new Date(p.targetDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : null;

            return (
              <Card
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}${location.search}`)}
                className="rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors cursor-pointer flex flex-col justify-between group shadow-none"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="size-2 rounded-full shrink-0 bg-blue-500" />
                      <CardTitle className="text-sm font-semibold truncate group-hover:text-foreground">
                        {p.name}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>

                  <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed mt-1">
                    {p.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 py-2 flex flex-col gap-2.5">
                  {/* Progress Bar */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
                      <span>{p.completedIssues || 0}/{p.totalIssues || 0} issues</span>
                      <span className="font-semibold text-foreground">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3 text-muted-foreground/70" />
                      <span className="text-xs font-mono">{target ? target : 'No target date'}</span>
                    </div>

                    {p.repositories && p.repositories.length > 0 && (
                      <Badge variant="outline" className="text-xs h-4.5 px-1.5 gap-1 border-border font-mono text-muted-foreground">
                        <GithubIcon className="size-2.5 text-foreground" />
                        <span>{p.repositories[0].name}{p.repositories.length > 1 ? ` +${p.repositories.length - 1}` : ''}</span>
                      </Badge>
                    )}
                  </div>
                  <HealthBadge health={p.health} />
                </CardFooter>
              </Card>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
              No projects found in this filter. Click &ldquo;New Project&rdquo; to create your first delivery stream.
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} defaultTeamId={teamId || undefined} />
    </div>
  );
}
