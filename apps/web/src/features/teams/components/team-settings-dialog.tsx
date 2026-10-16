import * as React from 'react';
import { Alert, AlertDescription, Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, FieldDescription, FieldGroup, FieldLabel, Input, Skeleton, Textarea } from '@reka/ui';
import { Plus } from 'lucide-react';
import { useUpdateTeam, useTeamWorkflowStates, useUpdateTeamWorkflowStates } from '../hooks/use-teams';
import type { Team, TeamWorkflowState, WorkflowStateCategory } from '../api/teams.api';
import { ColorPickerField } from '../../../components/common/color-picker-field';

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

  return <div className="team-settings-form @container/team-settings flex w-full min-w-0 max-w-4xl flex-col gap-8">
    <form aria-labelledby="team-general-heading" className="flex max-w-3xl flex-col gap-5" onSubmit={event => { event.preventDefault(); update.mutate({ id: team.id, data: { name: name.trim(), description, isPrivate } }, { onSuccess: () => onClose?.() }); }}>
      <h3 id="team-general-heading" className="text-sm font-semibold">General</h3>
      <FieldGroup className="gap-5">
        <Field className="team-setting-field gap-3"><div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-settings-name">Team name</FieldLabel><FieldDescription>The name shown throughout the workspace.</FieldDescription></div><Input id="team-settings-name" required maxLength={255} value={name} onChange={event => setName(event.target.value)} disabled={pending} /></Field>
        <Field className="team-setting-field gap-3"><div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-settings-description">Description</FieldLabel><FieldDescription>Describe what this team owns.</FieldDescription></div><Textarea id="team-settings-description" maxLength={4000} rows={3} value={description} placeholder="What does this team work on?" onChange={event => setDescription(event.target.value)} disabled={pending} /></Field>
        <Field className="team-setting-field gap-3"><div className="flex flex-col gap-1.5"><p className="text-xs font-medium">Team visibility</p><FieldDescription>{isPrivate ? 'Only explicitly added members can find or view this team.' : 'Every active workspace member can find this team. Members with write access can join.'}</FieldDescription></div><div className="flex min-h-9 items-center gap-2"><Checkbox id="team-settings-private" checked={isPrivate} onCheckedChange={value => setIsPrivate(value === true)} disabled={pending} /><FieldLabel htmlFor="team-settings-private">Private team</FieldLabel></div></Field>
      </FieldGroup>
      {update.isError && <Alert variant="destructive"><AlertDescription>{update.error.message}</AlertDescription></Alert>}
      <div className="team-setting-field"><div className="team-settings-actions flex flex-wrap gap-2">{onClose && <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>}<Button type="submit" disabled={pending || !name.trim()}>{update.isPending ? 'Saving…' : 'Save settings'}</Button></div></div>
    </form>

    <form aria-labelledby="team-workflow-heading" className="flex min-w-0 flex-col gap-4 border-t border-border pt-6" onSubmit={event => { event.preventDefault(); if (!pending && workflowQuery.isSuccess && states.length) saveWorkflow.mutate(states); }}>
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 id="team-workflow-heading" className="text-sm font-semibold">Issue workflow</h3><span className="text-xs tabular-nums text-muted-foreground">{states.length} states</span></div><p className="mt-1 max-w-prose text-xs text-muted-foreground">Set each state's name, category and color. States used by issues cannot be disabled.</p></div><Button type="button" variant="outline" size="sm" onClick={addState} disabled={pending || !workflowQuery.isSuccess || states.length >= 16}><Plus data-icon="inline-start" />Add state</Button></header>
      {workflowQuery.isLoading ? <div role="status" aria-label="Loading workflow" className="flex flex-col gap-3">{[0, 1, 2].map(row => <Skeleton key={row} className="h-16 w-full rounded-[6px]" />)}</div> : workflowQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Could not load workflow<Button type="button" variant="outline" size="sm" onClick={() => void workflowQuery.refetch()}>Retry</Button></AlertDescription></Alert> : <div className="min-w-0">
        <div aria-hidden="true" className="team-workflow-head pb-2 text-xs text-muted-foreground"><span>State</span><span>Category</span><span>Color</span><span>Active</span></div>
        <ol aria-label="Workflow states" className="divide-y divide-border border-y border-border">
          {states.map(state => <li key={state.key} data-workflow-state={state.key} className="team-workflow-row py-3">
            <Field className="team-workflow-name min-w-0"><FieldLabel className="@min-[36rem]/team-settings:sr-only" htmlFor={`workflow-${state.key}-name`}>State name</FieldLabel><Input id={`workflow-${state.key}-name`} aria-label={`${state.key} state name`} required maxLength={64} value={state.name} disabled={pending} onChange={event => changeState(state.key, { name: event.target.value })} /><span className="truncate font-mono text-xs text-muted-foreground" title={state.key}>{state.key}</span></Field>
            <Field className="min-w-0"><FieldLabel className="@min-[36rem]/team-settings:sr-only" htmlFor={`workflow-${state.key}-category`}>Category</FieldLabel><select id={`workflow-${state.key}-category`} aria-label={`${state.key} category`} disabled={pending} className="h-9 min-w-0 rounded-[6px] border border-input bg-background px-2 text-sm" value={state.category} onChange={event => changeState(state.key, { category: event.target.value as WorkflowStateCategory })}>{CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></Field>
            <Field><FieldLabel className="@min-[36rem]/team-settings:sr-only">Color</FieldLabel><ColorPickerField label={`${state.key} color`} value={state.color} disabled={pending} onValueChange={color => changeState(state.key, { color })} /></Field>
            <div className="flex h-9 items-center gap-2 self-end @min-[36rem]/team-settings:self-center"><Checkbox id={`workflow-${state.key}-active`} aria-label={`${state.key} active`} checked={state.isActive} disabled={pending} onCheckedChange={checked => changeState(state.key, { isActive: checked === true })} /><FieldLabel htmlFor={`workflow-${state.key}-active`}>Active</FieldLabel></div>
          </li>)}
        </ol>
        {!states.length && <p className="py-6 text-sm text-muted-foreground">No workflow states yet. Add a state to configure this team.</p>}
      </div>}
      {saveWorkflow.isError && <Alert variant="destructive"><AlertDescription>{saveWorkflow.error.message}</AlertDescription></Alert>}
      {workflowQuery.isSuccess && <div className="flex justify-start"><Button type="submit" disabled={pending || states.length === 0}>{saveWorkflow.isPending ? 'Saving…' : 'Save workflow'}</Button></div>}
    </form>
  </div>;
}

export function TeamSettingsDialog({ team, open, onOpenChange }: { team: Team; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => { if (!open) setPending(false); }, [open]);
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Team settings</DialogTitle><DialogDescription>Manage team access and the workflow states used by its issues.</DialogDescription></DialogHeader>{open && <TeamSettingsForm team={team} onClose={() => onOpenChange(false)} onPendingChange={setPending} />}</DialogContent></Dialog>;
}
