import * as React from 'react';
import { Alert, AlertDescription, Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, FieldDescription, FieldGroup, FieldLabel, Input, Textarea } from '@reka/ui';
import { useUpdateTeam, useTeamWorkflowStates, useUpdateTeamWorkflowStates } from '../hooks/use-teams';
import type { Team, TeamWorkflowState, WorkflowStateCategory } from '../api/teams.api';

const CATEGORIES: { value: WorkflowStateCategory; label: string }[] = [
  { value: 'triage', label: 'Triage' }, { value: 'backlog', label: 'Backlog' }, { value: 'unstarted', label: 'Unstarted' },
  { value: 'started', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'canceled', label: 'Canceled' },
];
type WorkflowDraft = Omit<TeamWorkflowState, 'teamId'>;

export function TeamSettingsForm({ team, onClose, onPendingChange }: { team: Team; onClose?: () => void; onPendingChange?: (pending: boolean) => void }) {
  const update = useUpdateTeam();
  const workflowQuery = useTeamWorkflowStates(team.id);
  const saveWorkflow = useUpdateTeamWorkflowStates(team.id);
  const [name, setName] = React.useState(team.name);
  const [description, setDescription] = React.useState(team.description ?? '');
  const [isPrivate, setIsPrivate] = React.useState(team.isPrivate);
  const [states, setStates] = React.useState<WorkflowDraft[]>([]);
  React.useEffect(() => {
    setName(team.name); setDescription(team.description ?? ''); setIsPrivate(team.isPrivate);
    update.reset(); saveWorkflow.reset();
  }, [team.id, team.name, team.description, team.isPrivate]);
  React.useEffect(() => {
    if (workflowQuery.data) setStates(workflowQuery.data.map(({ teamId: _teamId, ...state }) => state));
  }, [workflowQuery.data]);
  const pending = update.isPending || saveWorkflow.isPending;
  React.useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const changeState = (key: string, patch: Partial<WorkflowDraft>) => setStates(current => current.map(state => state.key === key ? { ...state, ...patch } : state));
  const addState = () => {
    let suffix = 1, key = 'new_state';
    while (states.some(state => state.key === key)) key = `new_state_${++suffix}`;
    setStates(current => [...current, { key, name: 'New state', category: 'unstarted', color: '#8f8f8f', position: Math.max(-1, ...current.map(state => state.position)) + 1, isActive: true }]);
  };

  return <div className="flex max-w-4xl flex-col gap-6">
      <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); update.mutate({ id: team.id, data: { name: name.trim(), description, isPrivate } }, { onSuccess: () => onClose?.() }); }}>
        <FieldGroup>
          <Field><FieldLabel htmlFor="team-settings-name">Team name</FieldLabel><Input id="team-settings-name" required maxLength={255} value={name} onChange={event => setName(event.target.value)} disabled={update.isPending} /></Field>
          <Field><FieldLabel htmlFor="team-settings-description">Description</FieldLabel><Textarea id="team-settings-description" maxLength={4000} rows={3} value={description} onChange={event => setDescription(event.target.value)} disabled={update.isPending} /></Field>
          <Field orientation="horizontal" className="items-start gap-3"><Checkbox id="team-settings-private" checked={isPrivate} onCheckedChange={value => setIsPrivate(value === true)} disabled={update.isPending} /><div className="flex flex-col gap-1"><FieldLabel htmlFor="team-settings-private">Private team</FieldLabel><FieldDescription>{isPrivate ? 'Only explicitly added members can find or view this team.' : 'Every active workspace member can find this team. Members with write access can join.'}</FieldDescription></div></Field>
        </FieldGroup>
        {update.isError && <Alert variant="destructive"><AlertDescription>{update.error.message}</AlertDescription></Alert>}
        <div className="flex justify-end gap-2">{onClose && <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>}<Button type="submit" disabled={pending || !name.trim()}>{update.isPending ? 'Saving…' : 'Save settings'}</Button></div>
      </form>

      <section className="flex flex-col gap-3 border-t border-border pt-4" aria-labelledby="team-workflow-heading">
        <div className="flex items-start justify-between gap-3"><div><h3 id="team-workflow-heading" className="text-sm font-medium">Issue workflow</h3><p className="mt-1 text-xs text-muted-foreground">Choose labels, categories and order. States used by issues cannot be disabled.</p></div><Button type="button" variant="outline" size="sm" onClick={addState} disabled={workflowQuery.isLoading || states.length >= 16}>Add state</Button></div>
        {workflowQuery.isLoading ? <p role="status" className="text-xs text-muted-foreground">Loading workflow…</p> : workflowQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Could not load workflow<Button type="button" variant="outline" size="sm" onClick={() => void workflowQuery.refetch()}>Retry</Button></AlertDescription></Alert> : (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {states.map(state => <div key={state.key} className="grid grid-cols-[minmax(0,1fr)_minmax(110px,0.8fr)_34px_auto] items-center gap-2 rounded-md border border-border/70 p-2">
              <div className="min-w-0"><Input aria-label={`${state.key} state name`} maxLength={64} value={state.name} onChange={event => changeState(state.key, { name: event.target.value })} /><span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">{state.key}</span></div>
              <select aria-label={`${state.key} category`} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs" value={state.category} onChange={event => changeState(state.key, { category: event.target.value as WorkflowStateCategory })}>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select>
              <input aria-label={`${state.key} color`} type="color" className="size-8 cursor-pointer rounded border border-input bg-background p-1" value={state.color} onChange={event => changeState(state.key, { color: event.target.value })} />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Checkbox aria-label={`${state.key} active`} checked={state.isActive} onCheckedChange={checked => changeState(state.key, { isActive: checked === true })} />Active</label>
            </div>)}
          </div>
        )}
        {saveWorkflow.isError && <Alert variant="destructive"><AlertDescription>{saveWorkflow.error.message}</AlertDescription></Alert>}
        {workflowQuery.isSuccess && <div className="flex justify-end"><Button type="button" variant="secondary" size="sm" disabled={saveWorkflow.isPending || states.length === 0} onClick={() => saveWorkflow.mutate(states)}>{saveWorkflow.isPending ? 'Saving…' : 'Save workflow'}</Button></div>}
      </section>
  </div>;
}

export function TeamSettingsDialog({ team, open, onOpenChange }: { team: Team; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => { if (!open) setPending(false); }, [open]);
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Team settings</DialogTitle><DialogDescription>Manage team access and the workflow states used by its issues.</DialogDescription></DialogHeader>{open && <TeamSettingsForm team={team} onClose={() => onOpenChange(false)} onPendingChange={setPending} />}</DialogContent></Dialog>;
}
