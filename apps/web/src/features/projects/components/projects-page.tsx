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
import { useNavigate } from 'react-router-dom';
import { useProjects, useDeleteProject } from '../hooks/use-projects';
import { CreateProjectDialog } from './create-project-dialog';
import type { Project } from '../api/projects.api';

function HealthBadge({ health }: { health: Project['health'] }) {
  if (health === 'on_track') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px] font-normal gap-1 h-5">
        <CheckCircle2 className="size-2.5" />
        <span>On Track</span>
      </Badge>
    );
  }
  if (health === 'at_risk') {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] font-normal gap-1 h-5">
        <AlertTriangle className="size-2.5" />
        <span>At Risk</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-500 text-[10px] font-normal gap-1 h-5">
      <AlertCircle className="size-2.5" />
      <span>Off Track</span>
    </Badge>
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
    <Badge variant={item.variant} className="capitalize text-[10px] font-mono font-normal h-5 px-2">
      {item.label}
    </Badge>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState('all');

  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const deleteMutation = useDeleteProject();

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete project "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const filterOptions = React.useMemo(() => [
    { id: 'all', label: 'All', count: projects.length },
    { id: 'in_progress', label: 'Active', count: projects.filter((p) => p.status === 'in_progress').length },
    { id: 'planned', label: 'Planned', count: projects.filter((p) => p.status === 'planned').length },
    { id: 'completed', label: 'Completed', count: projects.filter((p) => p.status === 'completed').length },
  ], [projects]);

  const filteredProjects = React.useMemo(() => {
    if (filterStatus === 'all') return projects;
    return projects.filter((p) => p.status === filterStatus);
  }, [projects, filterStatus]);

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Projects</h1>
            <span className="font-mono text-[11px] font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {projects.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            High-level software delivery streams and cross-functional roadmaps.
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
              <span className="font-mono text-[10px] text-muted-foreground">
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
            <Skeleton key={i} className="h-44 w-full rounded-[12px]" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
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
                onClick={() => navigate(`/projects/${p.id}`)}
                className="rounded-[12px] border border-border/80 bg-card/40 hover:bg-card/70 hover:border-border transition-all cursor-pointer shadow-2xs flex flex-col justify-between group"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center text-muted-foreground shrink-0 border border-border/60">
                        <FolderKanban className="size-3.5" />
                      </div>
                      <CardTitle className="text-sm font-semibold truncate group-hover:text-foreground">
                        {p.name}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={p.status} />
                      <button
                        type="button"
                        onClick={(e) => handleDelete(p.id, p.name, e)}
                        className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[4px] hover:bg-destructive/10"
                        title="Delete project"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed mt-1">
                    {p.description || 'No description provided.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 py-2 flex flex-col gap-2.5">
                  {/* Progress Bar */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground">
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
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3 text-muted-foreground/70" />
                    <span className="text-[11px] font-mono">{target ? target : 'No target date'}</span>
                  </div>
                  <HealthBadge health={p.health} />
                </CardFooter>
              </Card>
            );
          })}

          {filteredProjects.length === 0 && (
            <div className="col-span-full rounded-[12px] border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
              No projects found in this filter. Click &ldquo;New Project&rdquo; to create your first delivery stream.
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
