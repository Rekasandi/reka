import * as React from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { Alert, AlertDescription, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, FieldDescription, FieldGroup, FieldLabel, FieldError, Input, InputGroup, InputGroupAddon, InputGroupInput, InputGroupText, Skeleton, Spinner, Switch, Textarea } from '@reka/ui';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, Undo2 } from 'lucide-react';
import { StatusIconOnly } from '../../issues/components/status-picker';
import { useUpdateTeam, useTeamWorkflowStates, useUpdateTeamWorkflowStates } from '../hooks/use-teams';
import type { Team, TeamWorkflowState, WorkflowStateCategory } from '../api/teams.api';
import { SelectField } from '../../../components/common/select-field';
import { ColorPickerField } from '../../../components/common/color-picker-field';
import { ESTIMATE_SCALES, ESTIMATE_SCALE_LABELS, estimateScaleValues, type EstimateScale } from '@reka/types';

const CATEGORIES: { value: WorkflowStateCategory; label: string }[] = [
  { value: 'triage', label: 'Triage' }, { value: 'backlog', label: 'Backlog' }, { value: 'unstarted', label: 'Unstarted' },
  { value: 'started', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'canceled', label: 'Canceled' },
];
const CATEGORY_ORDER = CATEGORIES.map(category => category.value);
/** Reuses the issue status icons so each group reads the same as it does on boards and lists. */
const CATEGORY_ICON: Record<WorkflowStateCategory, string> = { triage: 'triage', backlog: 'backlog', unstarted: 'todo', started: 'in_progress', completed: 'done', canceled: 'canceled' };
const CATEGORY_COLOR: Record<WorkflowStateCategory, string> = { triage: '#ec9a3c', backlog: '#8f8f8f', unstarted: '#8f8f8f', started: '#f5a623', completed: '#7928ca', canceled: '#8f8f8f' };
type WorkflowDraft =Pick<TeamWorkflowState, 'key' | 'name' | 'category' | 'color' | 'position' | 'isActive'>;
const WORK_CATEGORIES: string[] = ['backlog', 'unstarted', 'started'];
/** The API only accepts these six fields (it rejects `createdAt`, `updatedAt`, `teamId`, ...), so drafts never carry extras. */
const toDraft = ({ key, name, category, color, position, isActive }: TeamWorkflowState | WorkflowDraft): WorkflowDraft => ({ key, name, category, color, position, isActive });
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const toMonths = (value: number | null) => value === null ? 'off' : String(value);
const fromMonths = (value: string) => value === 'off' ? null : Number(value);
const STATUS_FIELDS = ['defaultStatus', 'duplicateStatus', 'githubDraftStatus', 'githubOpenStatus', 'githubMergedStatus'] as const;
/** Form values for the team PATCH; status references use 'auto' for null so they fit a select. */
const formValuesFor = (team: Team) => ({
  name: team.name, description: team.description ?? '', isPrivate: team.isPrivate, cyclesEnabled: team.cyclesEnabled, estimatesEnabled: team.estimatesEnabled,
  estimateScale: team.estimateScale as EstimateScale, autoCloseParent: team.autoCloseParent, autoArchiveMonths: toMonths(team.autoArchiveMonths),
  autoCloseChildren: team.autoCloseChildren ?? false, autoCloseStaleMonths: toMonths(team.autoCloseStaleMonths ?? null), triageEnabled: team.triageEnabled ?? true, slaEnabled: team.slaEnabled ?? false,
  ...Object.fromEntries(STATUS_FIELDS.map(field => [field, team[field] ?? 'auto'])) as Record<(typeof STATUS_FIELDS)[number], string>,
});
const MONTH_OPTIONS = [{ value: 'off', label: 'Never' }, ...[1, 3, 6, 12].map(months => ({ value: String(months), label: `After ${months} ${months === 1 ? 'month' : 'months'}` }))];

export function TeamSettingsForm({ team, onClose, onPendingChange }: { team: Team; onClose?: () => void; onPendingChange?: (pending: boolean) => void }) {
  const update = useUpdateTeam();
  const workflowQuery = useTeamWorkflowStates(team.id);
  const saveWorkflow = useUpdateTeamWorkflowStates(team.id);
  const generalForm = useForm({
    defaultValues: formValuesFor(team),
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
  }, [team.id, JSON.stringify(formValuesFor(team))]);
  React.useEffect(() => {
    if (workflowQuery.data) { workflowForm.reset(); setRemoved([]); }
  }, [workflowQuery.data]);
  const pending = update.isPending || saveWorkflow.isPending;
  React.useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  const kept = states.filter(state => !removed.includes(state.key));
  // Mirrors the API rule: a team keeps at least one active work state and one active completed state.
  const workflowValid = kept.some(state => state.isActive && WORK_CATEGORIES.includes(state.category)) && kept.some(state => state.isActive && state.category === 'completed');
  // Issues per state (archived included); the API refuses to remove or disable a state that has any.
  const usage = new Map((workflowQuery.data ?? []).map(state => [state.key, state.issueCount ?? 0]));
  const inUse = (key: string) => (usage.get(key) ?? 0) > 0;
  const canRemove = (key: string) => {
    if (inUse(key)) return false;
    const rest = kept.filter(state => state.key !== key && state.isActive);
    return rest.some(state => WORK_CATEGORIES.includes(state.category)) && rest.some(state => state.category === 'completed');
  };
  const scaleValues = estimateScaleValues(generalValues.estimateScale);
  const offScaleCount = !generalValues.estimatesEnabled || !scaleValues ? 0 : (team.issues ?? []).filter(issue => issue.estimate != null && !scaleValues.includes(issue.estimate)).length;
  const generalDirty = JSON.stringify(generalValues) !== JSON.stringify(formValuesFor(team));
  // Default/duplicate/GitHub targets can only point at saved, active states.
  const savedStates = (workflowQuery.data ?? []).filter(state => state.isActive);
  const stateOptions = (categories?: WorkflowStateCategory[]) => savedStates.filter(state => !categories || categories.includes(state.category)).map(state => ({ value: state.key, label: state.name }));
  const workflowDirty = workflowQuery.isSuccess && (removed.length > 0 || JSON.stringify(states) !== JSON.stringify(seedStates));
  const dirtySections = [generalDirty && 'General', workflowDirty && 'Issue workflow'].filter(Boolean) as string[];
  const canSave = !pending && dirtySections.length > 0 && (!generalDirty || !!generalValues.name.trim()) && (!workflowDirty || (workflowValid && kept.every(state => state.name.trim())));

  async function saveAll() {
    if (!canSave) return;
    try {
      if (generalDirty) await update.mutateAsync({ id: team.id, data: { ...generalValues, name: generalValues.name.trim(),
        autoArchiveMonths: fromMonths(generalValues.autoArchiveMonths), autoCloseStaleMonths: fromMonths(generalValues.autoCloseStaleMonths),
        ...Object.fromEntries(STATUS_FIELDS.map(field => [field, generalValues[field] === 'auto' ? null : generalValues[field]])) } });
      // Persist positions in the grouped order shown on screen (category order, then position).
      const ordered = [...kept].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.position - b.position);
      if (workflowDirty) await saveWorkflow.mutateAsync(ordered.map((state, position) => toDraft({ ...state, position })));
      if (generalDirty) onClose?.();
    } catch { /* the mutation hooks surface the API error */ }
  }
  const discardAll = () => { generalForm.reset(); workflowForm.reset(); setRemoved([]); update.reset(); saveWorkflow.reset(); };
  const removeState = (key: string) => setRemoved(current => [...current, key]);
  const restoreState = (key: string) => setRemoved(current => current.filter(item => item !== key));
  const changeState = (key: string, patch: Partial<WorkflowDraft>) => workflowForm.setFieldValue('states', current => current.map(state => state.key === key ? { ...state, ...patch } : state));
  const addState = (category: WorkflowStateCategory = 'unstarted') => {
    let suffix = 1, key = 'new_state';
    while (states.some(state => state.key === key)) key = `new_state_${++suffix}`;
    workflowForm.setFieldValue('states', current => [...current, { key, name: 'New state', category, color: CATEGORY_COLOR[category], position: Math.max(-1, ...current.map(state => state.position)) + 1, isActive: true }]);
    requestAnimationFrame(() => { const input = document.getElementById(`workflow-${key}-name`) as HTMLInputElement | null; input?.focus(); input?.select(); });
  };
  // Moving to another category appends the state to the end of that group.
  const changeCategory = (key: string, category: WorkflowStateCategory) => changeState(key, { category, position: Math.max(-1, ...states.map(state => state.position)) + 1 });
  const groups = CATEGORIES.map(category => ({ ...category, states: states.filter(state => state.category === category.value).sort((a, b) => a.position - b.position) }));
  // Drag-and-drop reorder within a category: reuse the group's own position values so other groups keep theirs.
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const [dropHint, setDropHint] = React.useState<{ key: string; after: boolean } | null>(null);
  const dropState = (targetKey: string, after: boolean) => {
    const group = groups.find(item => item.states.some(state => state.key === targetKey))?.states;
    if (!dragKey || !group?.some(state => state.key === dragKey) || dragKey === targetKey) return;
    const order = group.filter(state => state.key !== dragKey);
    order.splice(order.findIndex(state => state.key === targetKey) + (after ? 1 : 0), 0, group.find(state => state.key === dragKey)!);
    const slots = group.map(state => state.position).sort((a, b) => a - b);
    const next = new Map(order.map((state, index) => [state.key, slots[index]]));
    workflowForm.setFieldValue('states', current => current.map(state => next.has(state.key) ? { ...state, position: next.get(state.key)! } : state));
  };
  const moveState = (key: string, direction: -1 | 1) => {
    const group = groups.find(item => item.states.some(state => state.key === key))!.states;
    const index = group.findIndex(state => state.key === key);
    const neighbour = group[index + direction];
    if (!neighbour) return;
    const a = group[index].position, b = neighbour.position;
    // Positions can collide in older data; nudge so the swap is always visible.
    const [nextA, nextB] = a === b ? [b + direction, a] : [b, a];
    workflowForm.setFieldValue('states', current => current.map(state => state.key === key ? { ...state, position: nextA } : state.key === neighbour.key ? { ...state, position: nextB } : state));
  };

  const switchField = (name: 'triageEnabled' | 'slaEnabled' | 'autoCloseChildren', label: string, description: (on: boolean) => string) =>
    <generalForm.Field name={name}>
      {field => <Field orientation="horizontal" className="team-setting-field items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5"><FieldLabel htmlFor={`team-${name}`}>{label}</FieldLabel><FieldDescription>{description(field.state.value)}</FieldDescription></div>
        <Switch id={`team-${name}`} aria-label={label} checked={field.state.value} disabled={pending} onCheckedChange={checked => field.handleChange(checked)} />
      </Field>}
    </generalForm.Field>;
  const selectField = (name: 'autoCloseStaleMonths' | (typeof STATUS_FIELDS)[number], label: string, description: string, options: { value: string; label: string }[]) =>
    <generalForm.Field name={name}>
      {field => <Field className="team-setting-field gap-3">
        <div className="flex flex-col gap-1.5"><FieldLabel htmlFor={`team-${name}`}>{label}</FieldLabel><FieldDescription>{description}</FieldDescription></div>
        <SelectField id={`team-${name}`} aria-label={label} className="w-full sm:w-80" value={field.state.value} disabled={pending || !workflowQuery.isSuccess} options={options} onValueChange={field.handleChange} />
      </Field>}
    </generalForm.Field>;
  const githubOptions = [{ value: 'auto', label: 'Automatic' }, { value: '-', label: 'No status change' }, ...stateOptions()];

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
        <generalForm.Field name="autoCloseParent">
          {field => <Field orientation="horizontal" className="team-setting-field items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-auto-close-parent">Auto-close parent issues</FieldLabel><FieldDescription>When every sub-issue is completed or canceled, close the parent too (completed if any sub-issue was completed, otherwise canceled).</FieldDescription></div>
            <Switch id="team-auto-close-parent" aria-label="Auto-close parent issues" checked={field.state.value} disabled={pending} onCheckedChange={checked => field.handleChange(checked)} />
          </Field>}
        </generalForm.Field>
        <generalForm.Field name="autoArchiveMonths">
          {field => <Field className="team-setting-field gap-3">
            <div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-auto-archive">Auto-archive closed issues</FieldLabel><FieldDescription>Archive completed and canceled issues that nobody has touched for this long. Archived issues can still be restored.</FieldDescription></div>
            <SelectField id="team-auto-archive" aria-label="Auto-archive closed issues" className="w-full sm:w-80" value={field.state.value} disabled={pending}
              options={MONTH_OPTIONS} onValueChange={field.handleChange} />
          </Field>}
        </generalForm.Field>
        {switchField('autoCloseChildren', 'Auto-close sub-issues', () => 'When a parent is completed or canceled, close its open sub-issues the same way.')}
        {selectField('autoCloseStaleMonths', 'Auto-close stale issues', 'Cancel backlog, unstarted and triage issues that nobody has touched for this long. Issues planned in an open cycle are skipped.', MONTH_OPTIONS)}
        {switchField('triageEnabled', 'Triage', on => on ? 'Intake forms send new issues to the Triage queue for review first.' : 'Intake goes straight to the default status and the Triage page is hidden for this team.')}
        {switchField('slaEnabled', 'SLA', on => on ? 'Urgent issues must be closed within 1 day and high priority issues within 7 days. Rows show the time left.' : 'No response deadlines are tracked for this team.')}
        <generalForm.Field name="estimateScale">
          {field => <Field className="team-setting-field gap-3">
            <div className="flex flex-col gap-1.5"><FieldLabel htmlFor="team-estimate-scale">Estimate scale</FieldLabel><FieldDescription>Points available when sizing issues. Existing estimates outside the new scale are kept but flagged when edited.</FieldDescription></div>
            <SelectField id="team-estimate-scale" aria-label="Estimate scale" className="w-full sm:w-80" value={field.state.value} disabled={pending || !generalValues.estimatesEnabled}
              options={ESTIMATE_SCALES.map(scale => ({ value: scale, label: ESTIMATE_SCALE_LABELS[scale] }))} onValueChange={value => field.handleChange(value as EstimateScale)} />
            {offScaleCount > 0 && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{offScaleCount} issue{offScaleCount === 1 ? '' : 's'} in this team {offScaleCount === 1 ? 'has an estimate' : 'have estimates'} outside this scale. {offScaleCount === 1 ? 'It is' : 'They are'} kept as is and flagged "outside scale" when edited.</p>}
          </Field>}
        </generalForm.Field>
      </FieldGroup>
    </section>

    <section aria-labelledby="team-status-defaults-heading" className="flex max-w-3xl flex-col gap-5 border-t border-border pt-6">
      <div><h3 id="team-status-defaults-heading" className="text-sm font-semibold">Status automation</h3><p className="mt-1 max-w-prose text-xs text-muted-foreground">Choose from the saved workflow below. Save new states first to use them here.</p></div>
      <FieldGroup className="gap-5">
        {selectField('defaultStatus', 'Default status', 'Status for new issues when none is chosen.', [{ value: 'auto', label: 'Automatic (first unstarted state)' }, ...stateOptions(['backlog', 'unstarted'])])}
        {selectField('duplicateStatus', 'Duplicate status', 'Where an issue goes when it is marked as a duplicate.', [{ value: 'auto', label: 'Automatic (Duplicate, else first canceled state)' }, ...stateOptions(['canceled'])])}
        {selectField('githubDraftStatus', 'Draft PR opened', 'When a draft pull request mentioning the issue is opened.', githubOptions)}
        {selectField('githubOpenStatus', 'PR opened or ready for review', 'When a pull request is opened, reopened or marked ready for review.', githubOptions)}
        {selectField('githubMergedStatus', 'PR merged', 'When the pull request is merged.', githubOptions)}
      </FieldGroup>
    </section>

    <form aria-labelledby="team-workflow-heading" className="flex min-w-0 flex-col gap-4 border-t border-border pt-6" onSubmit={event => { event.preventDefault(); event.stopPropagation(); workflowForm.handleSubmit(); }}>
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 id="team-workflow-heading" className="text-sm font-semibold">Issue workflow</h3><span className="text-xs tabular-nums text-muted-foreground">{states.length} of 16 states</span></div><p className="mt-1 max-w-prose text-xs text-muted-foreground">States are grouped by category. The category decides how an issue behaves on boards, in cycles and in insights. States that issues are using can't be turned off or deleted.</p></div><Button type="button" variant="outline" size="sm" onClick={() => addState()} disabled={pending || !workflowQuery.isSuccess || states.length >= 16}><Plus data-icon="inline-start" />Add state</Button></header>
      {workflowQuery.isLoading ? <div className="flex flex-col gap-3"><Spinner aria-label="Loading workflow" className="sr-only" />{[0, 1, 2].map(row => <Skeleton key={row} className="h-16 w-full rounded-[6px]" />)}</div> : workflowQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Could not load workflow<Button type="button" variant="outline" size="sm" onClick={() => void workflowQuery.refetch()}>Retry</Button></AlertDescription></Alert> : <div className="flex min-w-0 flex-col gap-3">
        {workflowDirty && !workflowValid && <Alert variant="destructive"><AlertDescription>Keep at least one active state in Backlog, Unstarted or In progress, and one active state in Completed.</AlertDescription></Alert>}
        <div aria-hidden="true" className="team-workflow-head px-2 text-xs text-muted-foreground"><span /><span /><span>Name</span><span>Category</span><span>Active</span><span /></div>
        {groups.map(group => {
          const headingId = `workflow-group-${group.value}`;
          return <section key={group.value} aria-labelledby={headingId} data-workflow-group={group.value} className="overflow-hidden rounded-lg border border-border">
            <div className="flex h-9 items-center gap-2 bg-muted/40 pl-3 pr-1">
              <span aria-hidden="true" className="flex size-4 items-center justify-center"><StatusIconOnly status={CATEGORY_ICON[group.value]} /></span>
              <h4 id={headingId} className="text-xs font-medium">{group.label}</h4>
              <span className="text-xs tabular-nums text-muted-foreground">{group.states.length}</span>
              <Button type="button" variant="ghost" size="icon" className="ml-auto size-7 text-muted-foreground" aria-label={`Add ${group.label} state`} title={`Add ${group.label} state`} disabled={pending || states.length >= 16} onClick={() => addState(group.value)}><Plus /></Button>
            </div>
            {group.states.length === 0
              ? <p className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">No {group.label.toLowerCase()} states.</p>
              : <ol aria-label={`${group.label} states`} className="divide-y divide-border border-t border-border">
                {group.states.map((state, index) => {
                  const isRemoved = removed.includes(state.key);
                  const rowPending = pending || isRemoved;
                  const count = usage.get(state.key) ?? 0;
                  const sameGroup = !!dragKey && group.states.some(item => item.key === dragKey);
                  return <li key={state.key} data-workflow-state={state.key} data-removed={isRemoved || undefined}
                    data-drop={dropHint?.key === state.key && sameGroup && dragKey !== state.key ? (dropHint.after ? 'after' : 'before') : undefined}
                    data-dragging={dragKey === state.key || undefined}
                    onDragOver={event => { if (!sameGroup) return; event.preventDefault(); const box = event.currentTarget.getBoundingClientRect(); setDropHint({ key: state.key, after: event.clientY > box.top + box.height / 2 }); }}
                    onDrop={event => { event.preventDefault(); if (dropHint) dropState(state.key, dropHint.after); setDragKey(null); setDropHint(null); }}
                    className={`team-workflow-row group/row px-2 py-1.5 transition-colors hover:bg-muted/30 ${isRemoved ? 'bg-destructive/5 hover:bg-destructive/5' : ''}`}>
                    <span role="presentation" draggable={!rowPending && group.states.length > 1} title={group.states.length > 1 ? 'Drag to reorder (or use the arrows)' : undefined}
                      onDragStart={event => { setDragKey(state.key); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', state.key); const row = event.currentTarget.closest('li'); if (row) event.dataTransfer.setDragImage(row, 16, 18); }}
                      onDragEnd={() => { setDragKey(null); setDropHint(null); }}
                      className={`flex h-9 items-center justify-center text-muted-foreground ${!rowPending && group.states.length > 1 ? 'cursor-grab active:cursor-grabbing' : 'opacity-30'}`}><GripVertical aria-hidden="true" className="size-4" /></span>
                    <ColorPickerField label={`${state.key} color`} value={state.color} disabled={rowPending} onValueChange={color => changeState(state.key, { color })} />
                    <div className="team-workflow-name min-w-0">
                      <InputGroup className="h-9 rounded-[6px]">
                        <InputGroupInput id={`workflow-${state.key}-name`} aria-label={`${state.key} state name`} required maxLength={64} value={state.name} disabled={rowPending} className={`font-medium ${isRemoved ? 'text-muted-foreground line-through' : state.isActive ? '' : 'text-muted-foreground'}`} onChange={event => changeState(state.key, { name: event.target.value })} />
                        {isRemoved
                          ? <InputGroupAddon align="inline-end"><InputGroupText className="text-xs text-destructive">Deleted on save</InputGroupText></InputGroupAddon>
                          : <InputGroupAddon align="inline-end">
                            {state.key !== slug(state.name) && <InputGroupText className="font-mono text-xs" title={`Key: ${state.key}`}>{state.key}</InputGroupText>}
                            <InputGroupText className="text-xs tabular-nums" title={`${count} issue${count === 1 ? '' : 's'} in this state (archived included)`}>{count} {count === 1 ? 'issue' : 'issues'}</InputGroupText>
                          </InputGroupAddon>}
                      </InputGroup>
                    </div>
                    <SelectField id={`workflow-${state.key}-category`} aria-label={`${state.key} category`} disabled={rowPending} size="default" className="team-workflow-category w-full min-w-0 rounded-[6px] px-2 text-sm data-[size=default]:h-9" value={state.category} onValueChange={value => changeCategory(state.key, value as WorkflowStateCategory)} options={CATEGORIES} />
                    <div className="flex h-9 items-center"><Switch id={`workflow-${state.key}-active`} aria-label={`${state.key} active`} title={state.isActive && count ? `Used by ${count} issue${count === 1 ? '' : 's'}. Move them to another state first` : state.isActive ? 'Active: available in status pickers' : 'Inactive: hidden from status pickers'} checked={state.isActive} disabled={rowPending || (state.isActive && count > 0)} onCheckedChange={checked => changeState(state.key, { isActive: checked })} /></div>
                    <div className="flex items-center justify-end gap-0.5">{isRemoved
                      ? <Button type="button" variant="outline" size="sm" className="h-8 gap-1" aria-label={`Undo delete ${state.key} state`} disabled={pending} onClick={() => restoreState(state.key)}><Undo2 />Undo</Button>
                      : <>
                        {group.states.length > 1 && <div className="flex items-center gap-0.5 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/row:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100">
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Move ${state.key} up`} title="Move up" disabled={pending || index === 0} onClick={() => moveState(state.key, -1)}><ArrowUp /></Button>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`Move ${state.key} down`} title="Move down" disabled={pending || index === group.states.length - 1} onClick={() => moveState(state.key, 1)}><ArrowDown /></Button>
                        </div>}
                        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" aria-label={`Delete ${state.key} state`} title={canRemove(state.key) ? `Delete ${state.name}` : count ? `Used by ${count} issue${count === 1 ? '' : 's'}. Move them to another state first` : 'Keep at least one active work state and one active completed state'} disabled={pending || !canRemove(state.key)} onClick={() => removeState(state.key)}><Trash2 /></Button>
                      </>}</div>
                  </li>;
                })}
              </ol>}
          </section>;
        })}
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
