import * as React from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { Alert, AlertDescription, Button, Card, Collapsible, CollapsibleContent, CollapsibleTrigger, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Field, FieldDescription, FieldError, FieldGroup, FieldLabel, Input, InputGroup, InputGroupAddon, InputGroupInput, InputGroupText, Skeleton, Spinner, Switch, Textarea } from '@reka/ui';
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, MoreHorizontal, Plus, Trash2, Undo2 } from 'lucide-react';
import { CATEGORY_DEFAULT_COLOR, StatusIconOnly } from '../../issues/components/status-picker';
import { useUpdateTeam, useTeamWorkflowStates, useUpdateTeamWorkflowStates } from '../hooks/use-teams';
import type { Team, TeamWorkflowState, WorkflowStateCategory } from '../api/teams.api';
import { PropertyPicker } from '../../../components/common/property-picker';
import { DiscardChangesDialog, UnsavedChangesGuard } from '../../../components/common/unsaved-changes-guard';
import { CycleScheduleDialog } from '../../cycles/components/cycle-schedule-dialog';
import { useTeamCycleSettings } from '../../cycles/hooks/use-cycles';
import { ColorPickerField } from '../../../components/common/color-picker-field';
import { ESTIMATE_SCALES, ESTIMATE_SCALE_LABELS, estimateScaleValues, type EstimateScale } from '@reka/types';

const CATEGORIES: { value: WorkflowStateCategory; label: string }[] = [
  { value: 'triage', label: 'Triage' }, { value: 'backlog', label: 'Backlog' }, { value: 'unstarted', label: 'Unstarted' },
  { value: 'started', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'canceled', label: 'Canceled' },
];
const CATEGORY_ORDER = CATEGORIES.map(category => category.value);
/** Reuses the issue status icons so each group reads the same as it does on boards and lists. */
const CATEGORY_ICON: Record<WorkflowStateCategory, string> = { triage: 'triage', backlog: 'backlog', unstarted: 'todo', started: 'in_progress', completed: 'done', canceled: 'canceled' };
const CATEGORY_COLOR: Record<WorkflowStateCategory, string> = CATEGORY_DEFAULT_COLOR;
type WorkflowDraft =Pick<TeamWorkflowState, 'key' | 'name' | 'category' | 'color' | 'position' | 'isActive'>;
const WORK_CATEGORIES: string[] = ['backlog', 'unstarted', 'started'];
/** The API only accepts these six fields (it rejects `createdAt`, `updatedAt`, `teamId`, ...), so drafts never carry extras. */
const toDraft = ({ key, name, category, color, position, isActive }: TeamWorkflowState | WorkflowDraft): WorkflowDraft => ({ key, name, category, color, position, isActive });
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const toMonths = (value?: number | null) => value == null ? 'off' : String(value);
const fromMonths = (value: string) => value === 'off' ? null : Number(value);
const STATUS_FIELDS = ['defaultStatus', 'duplicateStatus', 'githubDraftStatus', 'githubOpenStatus', 'githubMergedStatus'] as const;
/** Form values for the team PATCH; status references use 'auto' for null so they fit a select. */
const formValuesFor = (team: Team) => ({
  name: team.name, description: team.description ?? '', isPrivate: team.isPrivate, cyclesEnabled: team.cyclesEnabled, estimatesEnabled: team.estimatesEnabled,
  estimateScale: (team.estimateScale ?? 'fibonacci') as EstimateScale, autoCloseParent: team.autoCloseParent, autoArchiveMonths: toMonths(team.autoArchiveMonths),
  autoCloseChildren: team.autoCloseChildren ?? false, autoCloseStaleMonths: toMonths(team.autoCloseStaleMonths ?? null), triageEnabled: team.triageEnabled ?? true, slaEnabled: team.slaEnabled ?? false,
  ...Object.fromEntries(STATUS_FIELDS.map(field => [field, team[field] ?? 'auto'])) as Record<(typeof STATUS_FIELDS)[number], string>,
});
const MONTH_OPTIONS = [{ value: 'off', label: 'Never' }, ...[1, 3, 6, 12].map(months => ({ value: String(months), label: `After ${months} ${months === 1 ? 'month' : 'months'}` }))];

export type TeamSettingsSection = 'general' | 'features' | 'workflow';
const SECTIONS: { value: TeamSettingsSection; label: string }[] = [{ value: 'general', label: 'General' }, { value: 'features', label: 'Features' }, { value: 'workflow', label: 'Workflow' }];
const GENERAL_KEYS = ['name', 'description', 'isPrivate'] as const;
const WORKFLOW_KEYS = STATUS_FIELDS;

/** Team settings split into General, Features and Workflow. Hidden sections stay mounted so unsaved edits survive switching. */
export function TeamSettingsForm({ team, onClose, onPendingChange, onDirtyChange, section: controlledSection, initialSection, onSectionChange, dangerZone }: {
  team: Team; onClose?: () => void; onPendingChange?: (pending: boolean) => void; onDirtyChange?: (dirty: boolean) => void;
  section?: TeamSettingsSection; initialSection?: TeamSettingsSection; onSectionChange?: (section: TeamSettingsSection) => void;
  /** Rendered at the end of General (e.g. Delete team). */
  dangerZone?: React.ReactNode;
}) {
  const [localSection, setLocalSection] = React.useState<TeamSettingsSection>(controlledSection ?? initialSection ?? 'general');
  const section = controlledSection ?? localSection;
  const setSection = (next: TeamSettingsSection) => { setLocalSection(next); onSectionChange?.(next); };
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
  const saved = formValuesFor(team);
  const changed = (keys: readonly string[]) => keys.some(key => JSON.stringify(generalValues[key as keyof typeof generalValues]) !== JSON.stringify(saved[key as keyof typeof saved]));
  const generalSectionDirty = changed(GENERAL_KEYS);
  const workflowSectionDirty = workflowDirty || changed(WORKFLOW_KEYS);
  const featuresDirty = changed(Object.keys(saved).filter(key => !(GENERAL_KEYS as readonly string[]).includes(key) && !(WORKFLOW_KEYS as readonly string[]).includes(key)));
  const dirtyBySection: Record<TeamSettingsSection, boolean> = { general: generalSectionDirty, features: featuresDirty, workflow: workflowSectionDirty };
  const dirtySections = SECTIONS.filter(item => dirtyBySection[item.value]).map(item => item.label);
  const dirty = dirtySections.length > 0;
  React.useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
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

  const switchField = (name: 'cyclesEnabled' | 'estimatesEnabled' | 'autoCloseParent' | 'triageEnabled' | 'slaEnabled' | 'autoCloseChildren', id: string, label: string, description: string, extra?: React.ReactNode) =>
    <generalForm.Field name={name}>
      {field => <Field orientation="horizontal" className="items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1"><FieldLabel htmlFor={id}>{label}</FieldLabel><FieldDescription>{description}</FieldDescription>{field.state.value && extra}</div>
        <Switch id={id} aria-label={label} checked={field.state.value} disabled={pending} onCheckedChange={checked => field.handleChange(checked)} />
      </Field>}
    </generalForm.Field>;
  const pickerField = (name: 'autoArchiveMonths' | 'autoCloseStaleMonths' | 'estimateScale' | (typeof STATUS_FIELDS)[number], label: string, description: string, options: { value: string; label: string }[], disabled = false) =>
    <generalForm.Field name={name}>
      {field => <Field orientation="horizontal" className="items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1"><FieldLabel htmlFor={`team-${name}`}>{label}</FieldLabel><FieldDescription>{description}</FieldDescription></div>
        <PropertyPicker id={`team-${name}`} className="h-8 w-56 shrink-0 justify-start px-3" menuLabel={label} ariaLabel={label} shortcuts={options.length <= 9} value={field.state.value} disabled={pending || disabled}
          options={options.map(option => ({ key: option.value, label: option.label }))} onChange={value => field.handleChange(value as never)} />
      </Field>}
    </generalForm.Field>;
  const githubOptions = [{ value: 'auto', label: 'Automatic' }, { value: '-', label: 'No status change' }, ...stateOptions()];
  const githubCustomised = (['githubDraftStatus', 'githubOpenStatus', 'githubMergedStatus'] as const).some(field => generalValues[field] !== 'auto');
  const show = (name: TeamSettingsSection) => ({ hidden: section !== name });

  return <div className="team-settings-form flex w-full min-w-0 max-w-4xl flex-col gap-6 md:flex-row md:gap-10">
    <nav aria-label="Team settings sections" className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 md:mx-0 md:w-40 md:flex-col md:overflow-visible md:px-0">
      {SECTIONS.map(item => <Button key={item.value} type="button" variant="plain" size="auto" aria-current={section === item.value ? 'page' : undefined}
        className="flex h-8 shrink-0 items-center justify-start gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground" onClick={() => setSection(item.value)}>
        {item.label}{dirtyBySection[item.value] && <span aria-label="Unsaved changes" className="ml-auto size-1.5 rounded-full bg-warning" />}
      </Button>)}
    </nav>
    <div className="flex min-w-0 flex-1 flex-col gap-8">
    <UnsavedChangesGuard when={dirty} />
    <form {...show('general')} aria-labelledby="team-general-heading" className="flex flex-col gap-5" onSubmit={event => { event.preventDefault(); event.stopPropagation(); generalForm.handleSubmit(); }}>
      <h3 id="team-general-heading" className="text-sm font-semibold">General</h3>
      <FieldGroup className="gap-6">
        <generalForm.Field name="name" validators={{ onChange: ({ value }) => (!value.trim() ? 'Team name is required' : undefined) }}>
          {field => <Field className="gap-2"><FieldLabel htmlFor="team-settings-name">Team name</FieldLabel><Input id="team-settings-name" name={field.name} required maxLength={255} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={pending} />{field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors as string[]} />}</Field>}
        </generalForm.Field>
        <generalForm.Field name="description">
          {field => <Field className="gap-2"><FieldLabel htmlFor="team-settings-description">Description</FieldLabel><Textarea id="team-settings-description" name={field.name} maxLength={4000} rows={3} value={field.state.value} placeholder="What does this team work on?" onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={pending} /></Field>}
        </generalForm.Field>
        <generalForm.Field name="isPrivate">
          {field => <Field orientation="horizontal" className="items-start justify-between gap-6"><div className="flex min-w-0 flex-col gap-1"><FieldLabel htmlFor="team-settings-private">Private team</FieldLabel><FieldDescription>{field.state.value ? 'Only members added to the team can find or view it.' : 'Every workspace member can find this team; members with write access can join.'}</FieldDescription></div><Switch id="team-settings-private" aria-label="Private team" name={field.name} checked={field.state.value} onCheckedChange={value => field.handleChange(value)} disabled={pending} /></Field>}
        </generalForm.Field>
      </FieldGroup>
      {update.isError && <Alert variant="destructive"><AlertDescription>{update.error.message}</AlertDescription></Alert>}
    </form>
    {section === 'general' && dangerZone}

    <section {...show('features')} aria-labelledby="team-features-heading" className="flex flex-col gap-5">
      <h3 id="team-features-heading" className="text-sm font-semibold">Features</h3>
      <FieldGroup className="gap-6">
        {switchField('cyclesEnabled', 'team-cycles-enabled', 'Cycles', 'Plan work in time-boxed cycles.', team.cyclesEnabled && <CycleScheduleSummary teamId={team.id} />)}
        {switchField('estimatesEnabled', 'team-estimates-enabled', 'Estimates', 'Size issues with points; cycles show capacity.')}
        {generalValues.estimatesEnabled && <div className="flex flex-col gap-2">
          {pickerField('estimateScale', 'Estimate scale', 'Points available when sizing issues.', ESTIMATE_SCALES.map(scale => ({ value: scale, label: ESTIMATE_SCALE_LABELS[scale] })))}
          {offScaleCount > 0 && <p role="status" className="text-xs text-warning">{offScaleCount} issue{offScaleCount === 1 ? '' : 's'} {offScaleCount === 1 ? 'has an estimate' : 'have estimates'} outside this scale. {offScaleCount === 1 ? 'It is' : 'They are'} kept and flagged when edited.</p>}
        </div>}
        {switchField('triageEnabled', 'team-triageEnabled', 'Triage', 'Review issues from intake forms before they reach the team.')}
        {switchField('slaEnabled', 'team-slaEnabled', 'SLA', 'Track deadlines: urgent issues in 1 day, high priority in 7 days.')}
      </FieldGroup>
      <h3 className="border-t border-border pt-6 text-sm font-semibold">Automations</h3>
      <FieldGroup className="gap-6">
        {switchField('autoCloseParent', 'team-auto-close-parent', 'Auto-close parent issues', 'Close a parent once all of its sub-issues are closed.')}
        {switchField('autoCloseChildren', 'team-autoCloseChildren', 'Auto-close sub-issues', 'Close open sub-issues when their parent is closed.')}
        {pickerField('autoArchiveMonths', 'Auto-archive closed issues', 'Archive closed issues nobody has touched. They can be restored.', MONTH_OPTIONS)}
        {pickerField('autoCloseStaleMonths', 'Auto-close stale issues', 'Cancel untouched backlog and triage issues. Issues in an open cycle are skipped.', MONTH_OPTIONS)}
      </FieldGroup>
    </section>

    <div {...show('workflow')} className="flex min-w-0 flex-col gap-8">
    <form aria-labelledby="team-workflow-heading" className="flex min-w-0 flex-col gap-4" onSubmit={event => { event.preventDefault(); event.stopPropagation(); workflowForm.handleSubmit(); }}>
      <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 id="team-workflow-heading" className="text-sm font-semibold">Issue workflow</h3><span className="text-xs tabular-nums text-muted-foreground">{states.length} of 16 states</span></div><p className="mt-1 max-w-prose text-xs text-muted-foreground">The category decides how an issue behaves on boards, in cycles and in insights.</p></div><Button type="button" variant="outline" size="sm" onClick={() => addState()} disabled={pending || !workflowQuery.isSuccess || states.length >= 16}><Plus data-icon="inline-start" />Add state</Button></header>
      {workflowQuery.isLoading ? <div className="flex flex-col gap-3"><Spinner aria-label="Loading workflow" className="sr-only" />{[0, 1, 2].map(row => <Skeleton key={row} className="h-16 w-full rounded-sm" />)}</div> : workflowQuery.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Could not load workflow<Button type="button" variant="outline" size="sm" onClick={() => void workflowQuery.refetch()}>Retry</Button></AlertDescription></Alert> : <div className="flex min-w-0 flex-col gap-3">
        {workflowDirty && !workflowValid && <Alert variant="destructive"><AlertDescription>Keep at least one active state in Backlog, Unstarted or In progress, and one active state in Completed.</AlertDescription></Alert>}
        <div aria-hidden="true" className="team-workflow-head px-2 text-xs text-muted-foreground"><span /><span /><span>Name</span><span>Active</span><span /></div>
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
                      <InputGroup className="h-9 rounded-sm">
                        <InputGroupInput id={`workflow-${state.key}-name`} aria-label={`${state.key} state name`} required maxLength={64} value={state.name} disabled={rowPending} className={`font-medium ${isRemoved ? 'text-muted-foreground line-through' : state.isActive ? '' : 'text-muted-foreground'}`} onChange={event => changeState(state.key, { name: event.target.value })} />
                        {isRemoved
                          ? <InputGroupAddon align="inline-end"><InputGroupText className="text-xs text-destructive">Deleted on save</InputGroupText></InputGroupAddon>
                          : <InputGroupAddon align="inline-end">
                            {state.key !== slug(state.name) && <InputGroupText className="font-mono text-xs" title={`Key: ${state.key}`}>{state.key}</InputGroupText>}
                            <InputGroupText className="text-xs tabular-nums" title={`${count} issue${count === 1 ? '' : 's'} in this state (archived included)`}>{count} {count === 1 ? 'issue' : 'issues'}</InputGroupText>
                          </InputGroupAddon>}
                      </InputGroup>
                    </div>
                    <div className="flex h-9 items-center"><Switch id={`workflow-${state.key}-active`} aria-label={`${state.key} active`} title={state.isActive && count ? `Used by ${count} issue${count === 1 ? '' : 's'}. Move them to another state first` : state.isActive ? 'Active: available in status pickers' : 'Inactive: hidden from status pickers'} checked={state.isActive} disabled={rowPending || (state.isActive && count > 0)} onCheckedChange={checked => changeState(state.key, { isActive: checked })} /></div>
                    <div className="flex items-center justify-end">{isRemoved
                      ? <Button type="button" variant="outline" size="sm" className="h-8 gap-1" aria-label={`Undo delete ${state.key} state`} disabled={pending} onClick={() => restoreState(state.key)}><Undo2 />Undo</Button>
                      : <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`${state.key} actions`} disabled={pending}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Move to category</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuRadioGroup value={state.category} onValueChange={value => changeCategory(state.key, value as WorkflowStateCategory)}>
                                {CATEGORIES.map(category => <DropdownMenuRadioItem key={category.value} value={category.value}><StatusIconOnly status={CATEGORY_ICON[category.value]} />{category.label}</DropdownMenuRadioItem>)}
                              </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem disabled={index === 0} onSelect={() => moveState(state.key, -1)}><ArrowUp />Move up</DropdownMenuItem>
                          <DropdownMenuItem disabled={index === group.states.length - 1} onSelect={() => moveState(state.key, 1)}><ArrowDown />Move down</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" disabled={!canRemove(state.key)} onSelect={() => removeState(state.key)}><Trash2 />Delete state</DropdownMenuItem>
                          {!canRemove(state.key) && <p className="px-2 pb-1.5 text-xs text-muted-foreground">{canRemove(state.key) ? undefined : count ? `Used by ${count} issue${count === 1 ? '' : 's'}. Move them to another state first.` : 'Keep at least one active work state and one active completed state.'}</p>}
                        </DropdownMenuContent>
                      </DropdownMenu>}</div>
                  </li>;
                })}
              </ol>}
          </section>;
        })}
      </div>}
      {saveWorkflow.isError && <Alert variant="destructive"><AlertDescription>{saveWorkflow.error.message}</AlertDescription></Alert>}
    </form>

    <section aria-labelledby="team-status-defaults-heading" className="flex flex-col gap-5 border-t border-border pt-6">
      <div><h3 id="team-status-defaults-heading" className="text-sm font-semibold">Status automation</h3><p className="mt-1 max-w-prose text-xs text-muted-foreground">Only saved, active states can be chosen.</p></div>
      <FieldGroup className="gap-6">
        {pickerField('defaultStatus', 'Default status', 'Status for new issues when none is chosen.', [{ value: 'auto', label: 'Automatic' }, ...stateOptions(['backlog', 'unstarted'])], !workflowQuery.isSuccess)}
        {pickerField('duplicateStatus', 'Duplicate status', 'Where an issue goes when it is marked as a duplicate.', [{ value: 'auto', label: 'Automatic' }, ...stateOptions(['canceled'])], !workflowQuery.isSuccess)}
      </FieldGroup>
      <Collapsible defaultOpen={githubCustomised} className="rounded-lg border border-border">
        <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="group/github h-10 w-full justify-start gap-2 px-3"><ChevronRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-data-[state=open]/github:rotate-90" /><span className="font-medium">GitHub pull requests</span><span className="ml-auto text-xs font-normal text-muted-foreground">{githubCustomised ? 'Custom' : 'Automatic'}</span></Button></CollapsibleTrigger>
        <CollapsibleContent><FieldGroup className="gap-6 border-t border-border p-4">
          {pickerField('githubDraftStatus', 'Draft PR opened', 'When a draft pull request mentions the issue.', githubOptions, !workflowQuery.isSuccess)}
          {pickerField('githubOpenStatus', 'PR opened or ready', 'When a pull request is opened, reopened or ready for review.', githubOptions, !workflowQuery.isSuccess)}
          {pickerField('githubMergedStatus', 'PR merged', 'When the pull request is merged.', githubOptions, !workflowQuery.isSuccess)}
        </FieldGroup></CollapsibleContent>
      </Collapsible>
    </section>
    </div>

    {(dirtySections.length > 0 || pending) && <Card role="region" aria-label="Unsaved changes" className="sticky bottom-2 z-10 flex-row flex-wrap items-center justify-between gap-3 bg-popover/95 px-4 py-3 [--card-spacing:--spacing(3)] shadow-lg backdrop-blur">
      <p role="status" className="min-w-0 text-sm"><span className="font-medium">{dirtySections.length === 1 ? '1 section' : `${dirtySections.length} sections`} with unsaved changes</span><span className="text-muted-foreground"> · {dirtySections.join(', ')}</span>{workflowDirty && !workflowValid && <span className="mt-0.5 block text-xs text-destructive">Keep at least one active work state and one active completed state.</span>}</p>
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={pending} onClick={discardAll}>Discard</Button><Button type="button" disabled={!canSave} onClick={() => void saveAll()}>{pending ? 'Saving…' : 'Save changes'}</Button></div>
    </Card>}
    </div>
  </div>;
}

/** Saved cycle schedule for the team, with a shortcut to edit it where the Cycles feature is switched on. */
function CycleScheduleSummary({ teamId }: { teamId: string }) {
  const [open, setOpen] = React.useState(false);
  const { data } = useTeamCycleSettings(teamId);
  const weeks = data && data.durationDays % 7 === 0 ? `${data.durationDays / 7} week${data.durationDays === 7 ? '' : 's'}` : data ? `${data.durationDays} days` : null;
  return <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
    <span>{data ? `${weeks} · ${data.timezone}${data.autoCreate ? ' · Created automatically' : ''}` : 'No schedule yet'}</span>
    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>Edit schedule</Button>
    <CycleScheduleDialog open={open} onOpenChange={setOpen} defaultTeamId={teamId} />
  </div>;
}

export function TeamSettingsDialog({ team, open, onOpenChange, initialSection }: { team: Team; open: boolean; onOpenChange: (open: boolean) => void; initialSection?: TeamSettingsSection }) {
  const [pending, setPending] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  React.useEffect(() => { if (!open) { setPending(false); setDirty(false); } }, [open]);
  const requestClose = (next: boolean) => {
    if (next || pending) return;
    if (dirty) setConfirmClose(true); else onOpenChange(false);
  };
  return <>
    <Dialog open={open} onOpenChange={requestClose}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Team settings</DialogTitle><DialogDescription>Manage team access and the workflow states used by its issues.</DialogDescription></DialogHeader>{open && <TeamSettingsForm team={team} onClose={() => onOpenChange(false)} onPendingChange={setPending} onDirtyChange={setDirty} initialSection={initialSection} />}</DialogContent></Dialog>
    <DiscardChangesDialog open={confirmClose} onOpenChange={setConfirmClose} onDiscard={() => onOpenChange(false)} />
  </>;
}
