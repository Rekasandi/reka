import * as React from 'react';
import { useForm } from '@tanstack/react-form';
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
} from '@reka/ui';
import { SelectField } from '../../../components/common/select-field';
import { useCompleteCycle, useCycles } from '../hooks/use-cycles';
import type { Cycle } from '../api/cycles.api';

interface CompleteCycleDialogProps {
  cycle: Cycle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompleteCycleDialog({ cycle, open, onOpenChange }: CompleteCycleDialogProps) {
  const { data: cycles = [] } = useCycles();
  const completeMutation = useCompleteCycle();
  const incompleteCount = cycle?.remainingIssues ?? Math.max((cycle?.totalIssues || 0) - (cycle?.completedIssues || 0), 0);
  const upcomingCycles = React.useMemo(() => cycles
    .filter(c => c.teamId === cycle?.teamId && !c.isCompleted && c.id !== cycle?.id && new Date(c.startDate) >= new Date(cycle?.endDate ?? 0))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()), [cycles, cycle?.teamId, cycle?.id, cycle?.endDate]);
  const form = useForm({
    defaultValues: { action: (upcomingCycles.length ? 'next_cycle' : 'backlog') as 'backlog' | 'next_cycle', nextCycleId: 'auto' },
    onSubmit: async ({ value }) => {
      if (!cycle) return;
      completeMutation.mutate(
        { id: cycle.id, data: { incompleteIssuesAction: value.action, nextCycleId: value.nextCycleId === 'auto' ? undefined : value.nextCycleId } },
        { onSuccess: () => { onOpenChange(false); } },
      );
    },
  });

  React.useEffect(() => {
    if (open) form.reset();
  }, [open, cycle?.id, upcomingCycles.length]);

  if (!cycle) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit(); }} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Complete {cycle.name || `Cycle ${cycle.number}`}</DialogTitle>
            <DialogDescription>
              Wrap up this sprint and manage incomplete issues.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="rounded-lg border border-border/80 bg-card/40 p-3 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Completed issues:</span>
              <span className="font-mono font-semibold text-success">
                {cycle.completedIssues || 0} issues ({cycle.progress || 0}%)
              </span>
            </div>

            {incompleteCount > 0 ? (
              <div className="flex flex-col gap-3">
                <form.Field
                  name="action"
                  children={(field) => (
                    <Field>
                      <FieldLabel>What to do with {incompleteCount} incomplete issues?</FieldLabel>
                      <FieldDescription>
                        Choose where to move issues that were not marked as done in this cycle.
                      </FieldDescription>
                      <SelectField
                        className="w-full mt-1.5"
                        value={upcomingCycles.length ? field.state.value : 'backlog'}
                        onValueChange={(val) => field.handleChange(val as 'backlog' | 'next_cycle')}
                        disabled={!upcomingCycles.length}
                        options={[
                          ...(upcomingCycles.length > 0 ? [{ value: 'next_cycle', label: 'Move to next cycle' }] : []),
                          { value: 'backlog', label: 'Move back to Backlog' },
                        ]}
                      />
                    </Field>
                  )}
                />

                {!upcomingCycles.length && <p className="text-xs text-muted-foreground">No later open cycle exists. Incomplete work will return to Backlog.</p>}
                <form.Subscribe
                  selector={(state) => state.values.action}
                  children={(action) => action === 'next_cycle' && upcomingCycles.length > 0 ? (
                    <form.Field
                      name="nextCycleId"
                      children={(field) => (
                        <Field>
                          <FieldLabel className="text-muted-foreground">Target Cycle</FieldLabel>
                          <SelectField
                            className="w-full mt-1"
                            value={field.state.value}
                            onValueChange={field.handleChange}
                            options={[
                              { value: 'auto', label: 'Next upcoming cycle (automatic)' },
                              ...upcomingCycles.map((uc) => ({ value: uc.id, label: uc.name || `Cycle ${uc.number}` })),
                            ]}
                          />
                        </Field>
                      )}
                    />
                  ) : null}
                />
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
              {completeMutation.isPending ? 'Completing…' : 'Complete & Rollover'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
