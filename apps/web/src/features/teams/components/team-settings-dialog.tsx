import * as React from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { Alert, AlertDescription, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, FieldDescription, FieldGroup, FieldLabel, FieldError, Input, InputGroup, InputGroupAddon, InputGroupInput, InputGroupText, Skeleton, Spinner, Switch, Textarea } from '@reka/ui';
import { Plus, Trash2, Undo2 } from 'lucide-react';
import { useUpdateTeam, useTeamWorkflowStates, useUpdateTeamWorkflowStates } from '../hooks/use-teams';
import type { Team, TeamWorkflowState, WorkflowStateCategory } from '../api/teams.api';
import { SelectField } from '../../../components/common/select-field';
import { ColorPickerField } from '../../../components/common/color-picker-field';
import { ESTIMATE_SCALES, ESTIMATE_SCALE_LABELS, type EstimateScale } from '@reka/types';

const CATEGORIES: { value: WorkflowStateCategory; label: string }[] = [
  { value: 'triage', label: 'Triage' }, { value: 'backlog', label: 'Backlog' }, { value: 'unstarted', label: 'Unstarted' },
  { value: 'started', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'canceled', label: 'Canceled' },
];
type WorkflowDraft = Pick<TeamWorkflowState, 'key' | 'name' | 'category' | 'color' | 'position' | 'isActive'>;
const WORK_CATEGORIES: string[] = ['backlog', 'unstarted', 'started'];
/** The API only accepts these six fields (it rejects `createdAt`, `updatedAt`, `teamId`, ...), so drafts never carry extras. */
const toDraft = ({ key, name, category, color, position, isActive }: TeamWorkflowState | WorkflowDraft): WorkflowDraft => ({ key, name, category, color, position, isActive });
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function TeamSettingsForm({ team, onClose, onPendingChange }: { team: Team; onClose?: () => void; onPendingChange?: (pending: boolean) => void }) {
  const update = useUpdateTeam();
  const workflowQuery = useTeamWorkflowStates(team.id);
  const saveWorkflow = useUpdateTeamWorkflowStates(team.id);
  const generalForm = useForm({
    defaultValues: { name: team.name, description: team.description ?? '', isPrivate: team.isPrivate, cyclesEnabled: team.cyclesEnabled, estimatesEnabled: team.estimatesEnabled, estimateScale: team.estimateScale as EstimateScale },
    onSubmit: () => { void saveAll(); },
  });
  const seedStates = React.useMemo(() => (workflowQuery.data ?? []).map(toDraft), [workflowQuery.data]);
  const workflowForm = useForm({
    defaultValues: { states: seedStates },
    onSubmit: () => { void saveAll(); },
  });
  const states = useStore(workflowForm.store, state => state.values.states);
  const generalValues = useStore(generalForm.store, state => state.values);
  // Rows marked for deletion stay visible (struck through, with Undo) until the workflow is saved.
  const [removed, setRemoved] = React.useState<string[]>([]);
  React.useEffect(() => {
    generalForm.reset();
    update.reset(); saveWorkflow.reset();
  }, [team.id, team.name, team.description, team.isPrivate, team.cyclesEnabled, team.estimatesEnabled, team.estimateScale]);
  React.useEffect(() => {
    if (workflowQuery.data) { workflowForm.reset(); setRemoved([]); }
  }, [workflowQuery.data]);
  const pending = update.isPending || saveWorkflow.isPending;
  React.useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  const kept = states.filter(state => !removed.includes(state.key));
  // Mirrors the API rule: a team keeps at least one active work state and one active completed state.
  const workflowValid = kept.some(state => state.isActive && WORK_CATEGORIES.includes(state.category)) && kept.some(state => state.isActive && state.category === 'completed');
  const canRemove = (key: string) => {
    const rest = kept.filter(state => state.key !== key && state.isActive);
    return rest.some(state => WORK_CATEGORIES.includes(state.category)) && rest.some(state => state.category === 'completed');
  };
  const generalDirty = generalValues.name !== team.name || generalValues.description !== (team.description ?? '') || generalValues.isPrivate !== team.isPrivate
    || generalValues.cyclesEnabled !== team.cyclesEnabled || generalValues.estimatesEnabled !== team.estimatesEnabled || generalValues.estimateScale !== team.estimateScale;
  const workflowDirty = workflowQuery.isSuccess && (removed.length > 0 || JSON.stringify(states) !== JSON.stringify(seedStates));
  const dirtySections = [generalDirty && 'General', workflowDirty && 'Issue workflow'].filter(Boolean) as string[];
  const canSave = !pending && dirtySections.length > 0 && (!generalDirty || !!generalValues.name.trim()) && (!workflowDirty || (workflowValid && kept.every(state => state.name.trim())));

  async function saveAll() {
    if (!canSave) return;
    try {
      if (generalDirty) await update.mutateAsync({ id: team.id, data: { name: generalValues.name.trim(), description: generalValues.description, isPrivate: generalValues.isPrivate, cyclesEnabled: generalValues.cyclesEnabled, estimatesEnabled: generalValues.estimatesEnabled, estimateScale: generalValues.estimateScale } });
      if (workflowDirty) await saveWorkflow.mutateAsync(kept.map(toDraft));
      if (generalDirty) onClose?.();
    } catch { /* the mutation hooks surface the API error */ }
  }
  const discardAll = () => { generalForm.reset(); workflowForm.reset(); setRemoved([]); update.reset(); saveWorkflow.reset(); };
  const removeState = (key: string) => setRemoved(current => [...current, key]);
  const restoreState = (key: string) => setRemoved(current => current.filter(item => item !== key));
  const changeState = (key: string, patch: Partial<WorkflowDraft>) => workflowForm.setFieldValue('states', current => current.map(state => state.key === key ? { ...state, ...patch } : state));
  const addState = () => {
    let suffix = 1, key = 'new_state';
    while (states.some(state => state.key === key)) key = `new_state_${++suffix}`;
    workflowForm.setFieldValue('states', current => [...current, { key, name: 'New state', category: 'unstarted', color: '#8f8f8f', position: Math.max(-1, ...current.map(state => state.position)) + 1, isActive: true }]);
  };

  return <div className="team-settings-form @container/team-settings flex w-full min-w-0 max-w-4xl flex-col gap-8">
    <form aria-labelledby="team-general-heading" className="flex max-w-3xl flex-col gap-5" onSubmit={event => { event.preventDefault(); event.stopPropagation(); generalForm.handleSubmit(); }}>
      <h3 id="team-general-heading" className="text-sm font-semibold">General</h3>
      <FieldGroup className="gap-5">
        <generalForm.Field name="name" validators={{ onChange: ({ value }) => (!value.trim() ? 'Team name is required' : undefined) }}>
          {field => <Field className="team-setting-field gap-3"><div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-settings-name">Team name</FieldLabel><FieldDescription>The name shown throughout the workspace.</FieldDescription></div><Input id="team-settings-name" name={field.name} required maxLength={255} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={pending} />{field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors as string[]} />}</Field>}
        </generalForm.Field>
        <generalForm.Field name="description">
          {field => <Field className="team-setting-field gap-3"><div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-settings-description">Description</FieldLabel><FieldDescription>Describe what this team owns.</FieldDescription></div><Textarea id="team-settings-description" name={field.name} maxLength={4000} rows={3} value={field.state.value} placeholder="What does this team work on?" onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={pending} /></Field>}
        </generalForm.Field>
        <generalForm.Field name="isPrivate">
          {field => <Field className="team-setting-field gap-3"><div className="flex flex-col gap-1.5"><p className="text-xs font-medium">Team visibility</p><FieldDescription>{field.state.value ? 'Only explicitly added members can find or view this team.' : 'Every active workspace member can find this team. Members with write access can join.'}</FieldDescription></div><div className="flex min-h-9 items-center gap-2"><Checkbox id="team-settings-private" name={field.name} checked={field.state.value} onCheckedChange={value => field.handleChange(value === true)} disabled={pending} /><FieldLabel htmlFor="team-settings-private">Private team</FieldLabel></div></Field>}
        </generalForm.Field>
      </FieldGroup>
      {update.isError && <Alert variant="destructive"><AlertDescription>{update.error.message}</AlertDescription></Alert>}
    </form>

    <section aria-labelledby="team-features-heading" className="flex max-w-3xl flex-col gap-5 border-t border-border pt-6">
      <h3 id="team-features-heading" className="text-sm font-semibold">Features</h3>
      <FieldGroup className="gap-5">
        <generalForm.Field name="cyclesEnabled">
          {field => <Field orientation="horizontal" className="team-setting-field items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-cycles-enabled">Cycles</FieldLabel><FieldDescription>{field.state.value ? 'Plan work in scheduled cycles. Cycle pickers and the Cycles page are available for this team.' : 'Cycles are hidden for this team and issues cannot be added to one. Existing cycles and history are kept.'}</FieldDescription></div>
            <Switch id="team-cycles-enabled" aria-label="Enable cycles" checked={field.state.value} disabled={pending} onCheckedChange={checked => field.handleChange(checked)} />
          </Field>}
        </generalForm.Field>
        <generalForm.Field name="estimatesEnabled">
          {field => <Field orientation="horizontal" className="team-setting-field items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-estimates-enabled">Estimates</FieldLabel><FieldDescription>{field.state.value ? 'Issues can be sized with points and cycles show capacity.' : 'Estimate fields and cycle capacity are hidden for this team. Existing estimates are kept.'}</FieldDescription></div>
            <Switch id="team-estimates-enabled" aria-label="Enable estimates" checked={field.state.value} disabled={pending} onCheckedChange={checked => field.handleChange(checked)} />
          </Field>}
        </generalForm.Field>
        <generalForm.Field name="estimateScale">
          {field => <Field className="team-setting-field gap-3">
            <div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-estimate-scale">Estimate scale</FieldLabel><FieldDescription>Points available when sizing issues. Existing estimates outside the new scale are kept but flagged when edited.</FieldDescription></div>
            <SelectField id="team-estimate-scale" aria-label="Estimate scale" className="w-full sm:w-80" value={field.state.value} disabled={pending || !generalValues.estimatesEnabled}
              options={ESTIMATE_SCALES.map(scale => ({ value: scale, label: ESTIMATE_SCALE_LABELS[scale] }))} onValueChange={value => field.handleChange(value as EstimateScale)} />
          </Field>}
        </generalForm.Field>
      </FieldGroup>
    </section>

    <form aria-labelledby="team-workflow-heading" className="flex min-w-0 flex-col gap-4 border-t border-border pt-6" onSubmit={event => { event.preventDefault(); event.stopPropagation(); workflowForm.handleSubmit(); }}>
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 id="team-workflow-heading" className="text-sm font-semibold">Issue workflow</h3><span className="text-xs tabular-nums text-muted-foreground">{states.length} states</span></div><p className="mt-1 max-w-prose text-xs text-muted-foreground">Set each state's name, category and color. States used by issues cannot be disabled or deleted. Deleted states are removed when you save.</p></div><Button type="button" variant="outline" size="sm" onClick={addState} disabled={pending || !workflowQuery.isSuccess || states.length >= 16}><Plus data-icon="inline-start" />Add state</Button></header>
      {workflowQuery.isLoading ? <div className="flex flex-col gap-3"><Spinner aria-label="Loading workflow" className="sr-only" />{[0, 1, 2].map(row => <Skeleton key={row} className="h-16 w-full rounded-[6px]" />)}</div> : workflowQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Could not load workflow<Button type="button" variant="outline" size="sm" onClick={() => void workflowQuery.refetch()}>Retry</Button></AlertDescription></Alert> : <div className="min-w-0">
        <div aria-hidden="true" className="team-workflow-head pb-2 text-xs text-muted-foreground"><span>State</span><span>Category</span><span>Color</span><span>Active</span><span /></div>
        <ol aria-label="Workflow states" className="divide-y divide-border border-y border-border">
          {states.map(state => {
            const isRemoved = removed.includes(state.key);
            const rowPending = pending || isRemoved;
            return <li key={state.key} data-workflow-state={state.key} data-removed={isRemoved || undefined} className={`team-workflow-row py-2 ${isRemoved ? 'opacity-60' : ''}`}>
              <Field className="team-workflow-name min-w-0"><FieldLabel className="@min-[36rem]/team-settings:sr-only" htmlFor={`workflow-${state.key}-name`}>State name</FieldLabel>
                <InputGroup className="h-9 rounded-[6px]"><InputGroupInput id={`workflow-${state.key}-name`} aria-label={`${state.key} state name`} required maxLength={64} value={state.name} disabled={rowPending} className={isRemoved ? 'line-through' : undefined} onChange={event => changeState(state.key, { name: event.target.value })} />
                  {state.key !== slug(state.name) && <InputGroupAddon align="inline-end"><InputGroupText className="font-mono text-xs" title={`Key: ${state.key}`}>{state.key}</InputGroupText></InputGroupAddon>}
                </InputGroup>
              </Field>
              <Field className="min-w-0"><FieldLabel className="@min-[36rem]/team-settings:sr-only" htmlFor={`workflow-${state.key}-category`}>Category</FieldLabel><SelectField id={`workflow-${state.key}-category`} aria-label={`${state.key} category`} disabled={rowPending} size="default" className="w-full min-w-0 rounded-[6px] px-2 text-sm data-[size=default]:h-9" value={state.category} onValueChange={value => changeState(state.key, { category: value as WorkflowStateCategory })} options={CATEGORIES} /></Field>
              <Field><FieldLabel className="@min-[36rem]/team-settings:sr-only">Color</FieldLabel><ColorPickerField label={`${state.key} color`} value={state.color} disabled={rowPending} onValueChange={color => changeState(state.key, { color })} /></Field>
              <div className="flex h-9 items-center gap-2 self-end @min-[36rem]/team-settings:self-start"><Switch id={`workflow-${state.key}-active`} aria-label={`${state.key} active`} checked={state.isActive} disabled={rowPending} onCheckedChange={checked => changeState(state.key, { isActive: checked })} /><FieldLabel htmlFor={`workflow-${state.key}-active`} className="@min-[36rem]/team-settings:sr-only">Active</FieldLabel></div>
              <div className="flex justify-end self-end @min-[36rem]/team-settings:self-start">{isRemoved
                ? <Button type="button" variant="outline" size="sm" className="h-9 gap-1" aria-label={`Undo delete ${state.key} state`} disabled={pending} onClick={() => restoreState(state.key)}><Undo2 />Undo</Button>
                : <Button type="button" variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" aria-label={`Delete ${state.key} state`} title={canRemove(state.key) ? `Delete ${state.name}` : 'Keep at least one active work state and one active completed state'} disabled={pending || !canRemove(state.key)} onClick={() => removeState(state.key)}><Trash2 /></Button>}</div>
            </li>;
          })}
        </ol>
        {!states.length && <p className="py-6 text-sm text-muted-foreground">No workflow states yet. Add a state to configure this team.</p>}
      </div>}
      {saveWorkflow.isError && <Alert variant="destructive"><AlertDescription>{saveWorkflow.error.message}</AlertDescription></Alert>}
    </form>

    {(dirtySections.length > 0 || pending) && <Card role="region" aria-label="Unsaved changes" className="sticky bottom-2 z-10 flex-row flex-wrap items-center justify-between gap-3 bg-popover/95 px-4 py-3 [--card-spacing:--spacing(3)] shadow-lg backdrop-blur">
      <p role="status" className="min-w-0 text-sm"><span className="font-medium">{dirtySections.length === 1 ? '1 section' : `${dirtySections.length} sections`} with unsaved changes</span><span className="text-muted-foreground"> · {dirtySections.join(' and ')}</span>{workflowDirty && !workflowValid && <span className="mt-0.5 block text-xs text-destructive">Keep at least one active work state and one active completed state.</span>}</p>
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={pending} onClick={discardAll}>Discard</Button><Button type="button" disabled={!canSave} onClick={() => void saveAll()}>{pending ? 'Saving…' : 'Save changes'}</Button></div>
    </Card>}
  </div>;
}

export function TeamSettingsDialog({ team, open, onOpenChange }: { team: Team; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => { if (!open) setPending(false); }, [open]);
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Team settings</DialogTitle><DialogDescription>Manage team access and the workflow states used by its issues.</DialogDescription></DialogHeader>{open && <TeamSettingsForm team={team} onClose={() => onOpenChange(false)} onPendingChange={setPending} />}</DialogContent></Dialog>;
}
