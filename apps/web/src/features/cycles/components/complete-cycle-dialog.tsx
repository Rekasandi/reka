import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@reka/ui';
import { useCompleteCycle, useCycles } from '../hooks/use-cycles';
import type { Cycle } from '../api/cycles.api';

interface CompleteCycleDialogProps {
  cycle: Cycle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompleteCycleDialog({ cycle, open, onOpenChange }: CompleteCycleDialogProps) {
  const [action, setAction] = React.useState<'backlog' | 'next_cycle'>('next_cycle');
  const [nextCycleId, setNextCycleId] = React.useState<string>('auto');

  const { data: cycles = [] } = useCycles();
  const completeMutation = useCompleteCycle();

  const incompleteCount = (cycle?.totalIssues || 0) - (cycle?.completedIssues || 0);

  // Available upcoming cycles
  const upcomingCycles = React.useMemo(() => {
    return cycles.filter((c) => !c.isCompleted && c.id !== cycle?.id);
  }, [cycles, cycle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycle) return;

    completeMutation.mutate(
      {
        id: cycle.id,
        data: {
          incompleteIssuesAction: action,
          nextCycleId: nextCycleId === 'auto' ? undefined : nextCycleId,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  if (!cycle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Complete {cycle.name || `Cycle ${cycle.number}`}</DialogTitle>
            <DialogDescription>
              Wrap up this sprint and manage incomplete issues.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-[8px] border border-border/80 bg-card/40 p-3 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Completed issues:</span>
              <span className="font-mono font-semibold text-emerald-500">
                {cycle.completedIssues || 0} issues ({cycle.progress || 0}%)
              </span>
            </div>

            {incompleteCount > 0 ? (
              <div className="flex flex-col gap-3">
                <Field>
                  <FieldLabel>What to do with {incompleteCount} incomplete issues?</FieldLabel>
                  <FieldDescription>
                    Choose where to move issues that were not marked as done in this cycle.
                  </FieldDescription>
                  <Select
                    value={action}
                    onValueChange={(val) => setAction(val as 'backlog' | 'next_cycle')}
                  >
                    <SelectTrigger className="h-8 text-xs w-full mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="next_cycle">Move to next cycle</SelectItem>
                        <SelectItem value="backlog">Move back to Backlog</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {action === 'next_cycle' && upcomingCycles.length > 0 && (
                  <Field>
                    <FieldLabel className="text-muted-foreground">Target Cycle</FieldLabel>
                    <Select value={nextCycleId} onValueChange={setNextCycleId}>
                      <SelectTrigger className="h-8 text-xs w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="auto">Next upcoming cycle (automatic)</SelectItem>
                          {upcomingCycles.map((uc) => (
                            <SelectItem key={uc.id} value={uc.id}>
                              {uc.name || `Cycle ${uc.number}`}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Great job! All issues in this cycle are completed.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Completing...' : 'Complete & Rollover'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
