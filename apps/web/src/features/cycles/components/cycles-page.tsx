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
import {
  Plus,
  RefreshCw,
  Repeat,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Check,
} from 'lucide-react';
import { useCycles, useUpdateCycle, useDeleteCycle } from '../hooks/use-cycles';
import { CreateCycleDialog } from './create-cycle-dialog';
import { CompleteCycleDialog } from './complete-cycle-dialog';
import { useNavigate } from 'react-router-dom';
import type { Cycle } from '../api/cycles.api';

function CycleStatusBadge({ status }: { status: Cycle['status'] }) {
  if (status === 'active') {
    return (
      <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-500 text-[10px] font-normal gap-1 h-5">
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Active</span>
      </Badge>
    );
  }
  if (status === 'completed') {
    return (
      <Badge variant="outline" className="border-border/60 bg-muted/40 text-muted-foreground text-[10px] font-normal gap-1 h-5">
        <Check className="size-3" />
        <span>Completed</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-normal gap-1 h-5">
      <Clock className="size-3 text-muted-foreground" />
      <span>Upcoming</span>
    </Badge>
  );
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sStr = s.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const eStr = e.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sStr} — ${eStr}`;
}

export function CyclesPage() {
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [completeCycleTarget, setCompleteCycleTarget] = React.useState<Cycle | null>(null);
  const [filterTab, setFilterTab] = React.useState('all');

  const { data: cycles = [], isLoading, isError, refetch } = useCycles();
  const updateMutation = useUpdateCycle();
  const deleteMutation = useDeleteCycle();

  const activeCycle = React.useMemo(() => {
    return cycles.find((c) => c.status === 'active');
  }, [cycles]);

  const filterOptions = React.useMemo(() => [
    { id: 'all', label: 'All', count: cycles.length },
    { id: 'active', label: 'Active', count: cycles.filter((c) => c.status === 'active').length },
    { id: 'upcoming', label: 'Upcoming', count: cycles.filter((c) => c.status === 'upcoming').length },
    { id: 'completed', label: 'Completed', count: cycles.filter((c) => c.status === 'completed').length },
  ], [cycles]);

  const filteredCycles = React.useMemo(() => {
    if (filterTab === 'all') return cycles;
    return cycles.filter((c) => c.status === filterTab);
  }, [cycles, filterTab]);

  const handleToggleComplete = (c: Cycle, e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      id: c.id,
      data: { isCompleted: !c.isCompleted },
    });
  };

  const handleDelete = (c: Cycle, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${c.name || `Cycle ${c.number}`}?`)) {
      deleteMutation.mutate(c.id);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Cycles</h1>
            <span className="font-mono text-[11px] font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {cycles.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Time-boxed engineering sprints to measure team velocity and delivery cadence.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="rounded-[6px] h-8 px-3 text-xs font-medium">
          <Plus data-icon="inline-start" className="size-3.5" />
          <span>New Cycle</span>
        </Button>
      </div>

      {/* Active Sprint Spotlight Hero Card */}
      {activeCycle && (
        <Card
          onClick={() => navigate(`/cycles/${activeCycle.id}`)}
          className="rounded-[14px] border border-border/80 bg-card/60 p-5 shadow-2xs flex flex-col gap-4 relative overflow-hidden cursor-pointer hover:border-border transition-colors group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-[7px] bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Repeat className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">
                    {activeCycle.name || `Cycle ${activeCycle.number}`}
                  </h2>
                  <CycleStatusBadge status="active" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-0.5">
                  <Calendar className="size-3 text-muted-foreground/70" />
                  <span>{formatDateRange(activeCycle.startDate, activeCycle.endDate)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setCompleteCycleTarget(activeCycle);
                }}
                className="h-7 text-xs rounded-[6px] border-border/70"
              >
                <CheckCircle2 data-icon="inline-start" className="size-3 text-muted-foreground" />
                <span>End Cycle</span>
              </Button>
            </div>
          </div>

          {activeCycle.description && (
            <p className="text-xs text-foreground/80 leading-relaxed max-w-2xl">
              {activeCycle.description}
            </p>
          )}

          {/* Active Progress Bar */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
              <span>{activeCycle.completedIssues || 0} of {activeCycle.totalIssues || 0} issues completed</span>
              <span className="font-semibold text-foreground">{activeCycle.progress || 0}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${activeCycle.progress || 0}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-2">
        {filterOptions.map((opt) => {
          const isSelected = filterTab === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterTab(opt.id)}
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
            <Skeleton key={i} className="h-40 w-full rounded-[12px]" />
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load cycles from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Cycles Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCycles.map((c) => {
            const progress = c.progress || 0;
            return (
              <Card
                key={c.id}
                onClick={() => navigate(`/cycles/${c.id}`)}
                className="rounded-[12px] border border-border/80 bg-card/40 hover:bg-card/70 hover:border-border transition-all shadow-2xs flex flex-col justify-between group cursor-pointer"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center text-muted-foreground shrink-0 border border-border/60">
                        <Repeat className="size-3.5" />
                      </div>
                      <CardTitle className="text-sm font-semibold truncate">
                        {c.name || `Cycle ${c.number}`}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <CycleStatusBadge status={c.status} />
                      <button
                        type="button"
                        onClick={(e) => handleDelete(c, e)}
                        className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[4px] hover:bg-destructive/10"
                        title="Delete cycle"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed mt-1">
                    {c.description || 'No cycle objectives specified.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 py-2 flex flex-col gap-2">
                  {/* Progress Bar */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground">
                      <span>{c.completedIssues || 0}/{c.totalIssues || 0} issues</span>
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
                    <span className="text-[11px] font-mono">{formatDateRange(c.startDate, c.endDate)}</span>
                  </div>

                  {c.isCompleted ? (
                    <button
                      type="button"
                      onClick={(e) => handleToggleComplete(c, e)}
                      className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompleteCycleTarget(c);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                    >
                      End Cycle...
                    </button>
                  )}
                </CardFooter>
              </Card>
            );
          })}

          {filteredCycles.length === 0 && (
            <div className="col-span-full rounded-[12px] border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
              No cycles found in this filter. Click &ldquo;New Cycle&rdquo; to start your first sprint.
            </div>
          )}
        </div>
      )}

      {/* Create Cycle Modal */}
      <CreateCycleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Complete Cycle & Rollover Modal */}
      <CompleteCycleDialog
        cycle={completeCycleTarget}
        open={!!completeCycleTarget}
        onOpenChange={(open) => !open && setCompleteCycleTarget(null)}
      />
    </div>
  );
}
