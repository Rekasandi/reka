import * as React from 'react';
import { TeamPicker } from './team-picker';
import { useSearchParams } from 'react-router-dom';
import { useForm, useStore } from '@tanstack/react-form';
import { SelectField } from '../../../components/common/select-field';
import { Alert, AlertDescription, Avatar, AvatarFallback, AvatarImage, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, FieldGroup, FieldLabel, Input, Skeleton, Textarea, cn, FieldError, Spinner } from '@reka/ui';
import { Archive, Check, ClipboardList, Copy, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { IssueDetailContent } from './issue-detail-sheet';
import { useFavorites, useToggleFavorite } from '../../favorites/hooks/use-favorites';
import { useTeams } from '../../teams/hooks/use-teams';
import { useTeamWorkflowStates } from '../../teams/hooks/use-teams';
import { useIssue, useIssues } from '../hooks/use-issues';
import { useUsers } from '../../users/hooks/use-users';
import { useAuth } from '../../auth/hooks/use-auth';
import { useCreateIssueTemplate, useDeleteIssueTemplate, useIssueTemplates, useSubmitIssueTemplate, useTriage, useTriageAction } from '../hooks/use-triage';
import type { IntakeField, IssueTemplate } from '../api/triage.api';
import { EmptyState, PAGE_TITLE_CLASS } from '../../../components/common/page';
import { getIssueStatusCategory, type Issue } from '@reka/types';

type Decision = 'accept' | 'decline' | 'duplicate';

const formFields: IntakeField[] = [{ key: 'details', label: 'What should we know?', type: 'textarea', required: true }];
const templateDefaults = { titlePrefix: '', description: '', defaultStatus: 'triage', defaultType: 'task', defaultPriority: 'no_priority', defaultEstimate: null, fields: formFields };

export function TriagePage() {
  const [params, setParams] = useSearchParams();
  const teamId = params.get('teamId');
  const { user } = useAuth();
  const { data: teams = [] } = useTeams();
  const { data: allTriage = [], isLoading, isError, refetch } = useTriage();
  const queue = teamId ? allTriage.filter(issue => issue.teamId === teamId) : allTriage;
  const { data: templates = [], isError: templatesError, isLoading: templatesLoading, refetch: refetchTemplates } = useIssueTemplates();
  const { data: users = [] } = useUsers();
  const createTemplate = useCreateIssueTemplate();
  const deleteTemplate = useDeleteIssueTemplate();
  const submitTemplate = useSubmitIssueTemplate();
  const action = useTriageAction();
  const [templateManagerOpen, setTemplateManagerOpen] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [decision, setDecision] = React.useState<{ issue: Issue; mode: Decision } | null>(null);
  const [search, setSearch] = React.useState('');
  const [returnFocusId, setReturnFocusId] = React.useState<string | null>(null);
  const selectedId = params.get('issueId');
  const visibleQueue = queue.filter(issue => `${issue.identifier} ${issue.title}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedIssue = selectedId ? queue.find(issue => issue.id === selectedId) : visibleQueue[0];
  const selectIssue = (id?: string, replace = false) => {
    const next = new URLSearchParams(params);
    if (id) next.set('issueId', id); else next.delete('issueId');
    setParams(next, { replace, preventScrollReset: true });
  };
  const closeReview = () => {
    setReturnFocusId(selectedIssue?.id ?? null);
    selectIssue();
  };
  React.useEffect(() => {
    if (selectedId || !returnFocusId) return;
    const button = document.querySelector<HTMLButtonElement>(`[data-triage-item="${CSS.escape(returnFocusId)}"]`);
    if (button?.checkVisibility()) {
      button.focus({ preventScroll: true });
      setReturnFocusId(null);
    }
  }, [selectedId, returnFocusId]);
  const resolved = (id: string) => {
    const index = visibleQueue.findIndex(issue => issue.id === id);
    const next = visibleQueue[index + 1] ?? visibleQueue[index - 1];
    selectIssue(next?.id, true);
    setDecision(null);
  };
  const canManage = user?.role === 'owner' || user?.role === 'admin' || teams.some(team => team.canManage);
  const writableTeams = teams.filter(team => team.canWrite);
  const intakeTemplates = templates.filter(template => !template.teamId || writableTeams.some(team => team.id === template.teamId));

  const canSubmit = !templatesLoading && intakeTemplates.length > 0 && writableTeams.length > 0 && !!user && !['guest', 'client'].includes(user.role);

  return <div className="triage-page @container/triage -m-4 flex min-w-0 flex-col bg-background sm:-m-6">
    {(isError || templatesError) && <div className="flex shrink-0 flex-col gap-2 p-4">
      {isError && <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Triage queue could not be loaded.<Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button></AlertDescription></Alert>}
      {templatesError && <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Intake forms could not be loaded.<Button type="button" variant="outline" size="sm" onClick={() => void refetchTemplates()}>Retry</Button></AlertDescription></Alert>}
    </div>}
    <div className="grid min-h-0 flex-1 grid-cols-1 @min-[48rem]/triage:grid-cols-[18rem_minmax(0,1fr)] @min-[72rem]/triage:grid-cols-[20rem_minmax(0,1fr)]">
      <section aria-label="Triage queue" className={cn('min-h-0 min-w-0 flex-col border-border @min-[48rem]/triage:flex @min-[48rem]/triage:border-r', selectedId ? 'hidden' : 'flex')}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><h1 className={PAGE_TITLE_CLASS}>Triage</h1><Badge variant="outline" className="tabular-nums">{queue.length}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{teamId ? teams.find(team => team.id === teamId)?.name ?? 'Team triage' : 'Team triage'}</p></div>
          <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="Templates" title="Templates" onClick={() => setTemplateManagerOpen(true)} disabled={!canManage}><ClipboardList /></Button><Button type="button" size="icon-sm" aria-label="New intake" title="New intake" onClick={() => setSubmitOpen(true)} disabled={!canSubmit}><Plus /></Button></div>
        </header>
        <div className="shrink-0 px-3 py-3"><Input type="search" aria-label="Search triage" placeholder="Search triage…" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
          {isLoading ? <div className="flex flex-col gap-2"><Spinner aria-label="Loading triage queue" className="sr-only" />{[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-16 w-full rounded-sm" />)}</div> : isError ? null : !queue.length ? <EmptyState className="border-0" icon={ClipboardList} title="Nothing waiting for review" description="New internal submissions will appear here." action={<Button type="button" variant="outline" onClick={() => setSubmitOpen(true)} disabled={!canSubmit}><Plus data-icon="inline-start" />New intake</Button>} /> : !visibleQueue.length ? <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm"><p>No matching intake.</p><Button variant="outline" size="sm" onClick={() => setSearch('')}>Clear search</Button></div> : <ul aria-label="Incoming issues" className="flex flex-col gap-1">{visibleQueue.map(issue => {
            const reporter = users.find(person => person.id === issue.reporterId);
            const date = new Date(issue.createdAt);
            const hasDate = Number.isFinite(date.getTime());
            return <li key={issue.id}><Button variant="plain" size="auto" type="button" data-triage-item={issue.id} aria-label={`Review ${issue.identifier}: ${issue.title}`} aria-current={selectedIssue?.id === issue.id ? 'true' : undefined} onClick={() => selectIssue(issue.id)} className={cn('flex w-full min-w-0 flex-col gap-2 rounded-sm px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', selectedIssue?.id === issue.id && 'bg-secondary')}>
              <span className="flex w-full min-w-0 items-baseline gap-2"><span className="min-w-0 flex-1 truncate text-sm" title={issue.title}>{issue.title}</span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{issue.identifier}</span></span>
              <span className="flex w-full min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground"><span className="flex min-w-0 items-center gap-2"><Avatar className="size-4"><AvatarImage src={reporter?.avatarUrl ?? undefined} /><AvatarFallback>{reporter?.name.slice(0, 1) ?? '?'}</AvatarFallback></Avatar><span className="truncate">{reporter?.name ?? 'Unknown reporter'}</span></span><time className="shrink-0" dateTime={hasDate ? date.toISOString() : undefined} title={hasDate ? date.toLocaleString() : undefined}>{hasDate ? formatDistanceToNow(date, { addSuffix: true }) : 'Date unavailable'}</time></span>
            </Button></li>;
          })}</ul>}
        </div>
      </section>
      <section aria-label="Triage review" className={cn('min-h-0 min-w-0 overflow-y-auto overscroll-contain @min-[48rem]/triage:block', selectedId ? 'block' : 'hidden')}>
        {selectedIssue && !isError ? <TriageDetail key={selectedIssue.id} issueId={selectedIssue.id} onClose={closeReview} onDecision={(issue, mode) => setDecision({ issue, mode })} /> : <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center"><ClipboardList className="size-6 text-muted-foreground" /><h2 className="text-sm font-medium">{selectedId && !isLoading && !isError ? 'Intake unavailable' : isLoading ? 'Loading incoming work…' : isError ? 'Queue unavailable' : 'Select an intake to review'}</h2><p className="max-w-sm text-sm text-muted-foreground">{selectedId ? 'This issue may have left triage, or is not available in this team.' : 'Review the details, then accept, decline, or mark it as a duplicate.'}</p>{selectedId && <Button variant="outline" onClick={() => selectIssue()}>Back to queue</Button>}</div>}
      </section>
    </div>
    <TemplateManager open={templateManagerOpen} onOpenChange={setTemplateManagerOpen} teams={teams} templates={templates} createTemplate={createTemplate} deleteTemplate={deleteTemplate} canManage={canManage} canManageWorkspace={user?.role === 'owner' || user?.role === 'admin'} />
    <IntakeDialog open={submitOpen} onOpenChange={setSubmitOpen} templates={intakeTemplates} teams={writableTeams} submitTemplate={submitTemplate} />
    {decision && <ReviewDialog key={`${decision.issue.id}:${decision.mode}`} issue={decision.issue} mode={decision.mode} open onOpenChange={open => { if (!open) setDecision(null); }} onResolved={() => resolved(decision.issue.id)} teams={writableTeams} action={action} />}
  </div>;
}

function TriageDetail({ issueId, onClose, onDecision }: { issueId: string; onClose: () => void; onDecision: (issue: Issue, mode: Decision) => void }) {
  const query = useIssue(issueId);
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const user = useAuth().user;
  const { data: teams = [] } = useTeams();
  React.useEffect(() => {
    if (!query.isSuccess) return;
    const back = document.querySelector<HTMLButtonElement>('[data-issue-detail="triage"] .triage-back');
    if (back?.checkVisibility()) back.focus({ preventScroll: true });
  }, [query.isSuccess, issueId]);
  if (query.isPending) return <div className="flex flex-col gap-6 p-6"><Spinner aria-label="Loading intake details" className="sr-only" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-32 w-full" /><Skeleton className="h-20 w-full" /></div>;
  if (query.isError || !query.data) return <div className="flex flex-col gap-4 p-6"><Button variant="outline" className="w-fit" onClick={onClose}>Back to queue</Button><Alert variant="destructive"><AlertDescription>Could not load intake details. It may have been removed or you may not have access.</AlertDescription></Alert><Button variant="outline" className="w-fit" onClick={() => void query.refetch()}>Retry details</Button></div>;
  const issue = query.data;
  const isFavorite = favorites.data?.some(item => item.resourceType === 'issue' && item.resourceId === issue.id) ?? false;
  const canReview = !!user && !['guest', 'client'].includes(user.role) && teams.some(team => team.id === issue.teamId && team.canWrite) && !issue.archivedAt && getIssueStatusCategory(issue) === 'triage';
  return <IssueDetailContent key={issue.id} issue={issue} presentation="triage" onClose={onClose} isFavorite={isFavorite}
    canFavorite={!!user && !['guest', 'client'].includes(user.role) && favorites.isSuccess && !toggle.isPending}
    onToggleFavorite={() => toggle.mutate({ resourceType: 'issue', resourceId: issue.id, favorite: !isFavorite })}
    headerActions={<><Button size="sm" variant="outline" disabled={!canReview} onClick={() => onDecision(issue, 'accept')}><Check data-icon="inline-start" />Accept</Button><Button size="sm" variant="ghost" disabled={!canReview} onClick={() => onDecision(issue, 'decline')}><Archive data-icon="inline-start" />Decline</Button><Button size="sm" variant="ghost" disabled={!canReview} onClick={() => onDecision(issue, 'duplicate')}><Copy data-icon="inline-start" />Duplicate</Button></>} />;
}

function TemplateManager({ open, onOpenChange, teams, templates, createTemplate, deleteTemplate, canManage, canManageWorkspace }: {
  open: boolean; onOpenChange: (open: boolean) => void; teams: { id: string; name: string; key: string; canManage?: boolean }[];
  templates: IssueTemplate[]; createTemplate: ReturnType<typeof useCreateIssueTemplate>; deleteTemplate: ReturnType<typeof useDeleteIssueTemplate>; canManage: boolean; canManageWorkspace: boolean;
}) {
  const [name, setName] = React.useState('');
  const [teamId, setTeamId] = React.useState(teams.find(team => team.canManage)?.id ?? '');
  const [error, setError] = React.useState('');
  const managers = teams.filter(team => team.canManage);
  React.useEffect(() => { if (open) { setName(''); setError(''); setTeamId(managers[0]?.id ?? ''); } }, [open]);
  const save = async () => {
    if (!name.trim() || (!teamId && !canManageWorkspace)) { setError('Choose an authorized scope and enter a template name.'); return; }
    setError('');
    try {
      await createTemplate.mutateAsync({ ...templateDefaults, name: name.trim(), teamId: teamId || null });
      setName('');
    } catch (cause) { setError((cause as Error).message); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Issue intake templates</DialogTitle><DialogDescription>Team leads create team forms; workspace admins may create workspace-wide forms. Submissions stay internal and enter triage.</DialogDescription></DialogHeader>
    <div className="flex flex-col gap-3">{templates.length ? <ul className="divide-y divide-border rounded-md border border-border/70">{templates.map(template => <li key={template.id} className="flex items-center justify-between gap-3 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{template.name}</p><p className="text-xs text-muted-foreground">{template.teamId ? teams.find(team => team.id === template.teamId)?.name ?? 'Team form' : 'Workspace form'} · {template.fields.length} fields</p></div><Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete ${template.name}`} disabled={!canManage || deleteTemplate.isPending} onClick={() => deleteTemplate.mutate(template.id)}><Trash2 /></Button></li>)}</ul> : <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No internal templates yet.</p>}
      {canManage && <div className="flex flex-col gap-2 rounded-md border border-border/70 p-3"><h3 className="text-xs font-semibold text-muted-foreground">New template</h3><Input aria-label="Template name" placeholder="e.g. Bug report" maxLength={100} value={name} onChange={event => setName(event.target.value)} /><SelectField aria-label="Template team" value={teamId} onValueChange={setTeamId} className="w-full" options={[...(canManageWorkspace ? [{ value: '', label: 'Workspace-wide' }] : []), ...managers.map(team => ({ value: team.id, label: `${team.name} (${team.key})` }))]} /><p className="text-xs text-muted-foreground">Creates a triage form with one required details field. Change issue properties after acceptance.</p>{error && <FieldError role="alert" className="text-xs text-destructive">{error}</FieldError>}<div className="flex justify-end"><Button type="button" size="sm" onClick={() => void save()} disabled={createTemplate.isPending || (!teamId && !canManageWorkspace)}>{createTemplate.isPending ? 'Saving…' : 'Create template'}</Button></div></div>}
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function IntakeDialog({ open, onOpenChange, templates, teams, submitTemplate }: {
  open: boolean; onOpenChange: (open: boolean) => void; templates: IssueTemplate[]; teams: { id: string; name: string; key: string; canWrite?: boolean }[];
  submitTemplate: ReturnType<typeof useSubmitIssueTemplate>;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New internal intake</DialogTitle><DialogDescription>Submissions create a real issue in the selected team's triage queue.</DialogDescription></DialogHeader>
    {open && <IntakeForm onOpenChange={onOpenChange} templates={templates} teams={teams} submitTemplate={submitTemplate} />}
  </DialogContent></Dialog>;
}

/** Mounted fresh each time the dialog opens, so the form always starts from clean defaults. */
function IntakeForm({ onOpenChange, templates, teams, submitTemplate }: {
  onOpenChange: (open: boolean) => void; templates: IssueTemplate[]; teams: { id: string; name: string; key: string; canWrite?: boolean }[];
  submitTemplate: ReturnType<typeof useSubmitIssueTemplate>;
}) {
  const form = useForm({
    defaultValues: { templateId: templates[0]?.id ?? '', teamId: '', title: '', answers: {} as Record<string, string> },
    onSubmit: async ({ value }) => {
      const current = templates.find(item => item.id === value.templateId);
      if (!current) return;
      try {
        await submitTemplate.mutateAsync({ id: current.id, input: { title: value.title, teamId: current.teamId ? undefined : value.teamId, answers: value.answers } });
        onOpenChange(false);
      } catch { /* mutation toast presents the API validation error */ }
    },
  });
  const templateId = useStore(form.store, state => state.values.templateId);
  const answers = useStore(form.store, state => state.values.answers);
  const template = templates.find(item => item.id === templateId);
  const firstTemplateId = templates[0]?.id ?? '';
  React.useEffect(() => { if (!form.getFieldValue('templateId') && firstTemplateId) form.setFieldValue('templateId', firstTemplateId); }, [firstTemplateId]);
  React.useEffect(() => { if (template?.teamId) form.setFieldValue('teamId', template.teamId); }, [template?.id, template?.teamId]);
  const validTeams = teams.filter(team => team.canWrite);
  return <>
    <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      <form.Field name="templateId" validators={{ onChange: ({ value }) => (!value ? 'Choose a form' : undefined) }} children={field => (
        <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}><FieldLabel className="text-xs font-medium">Form</FieldLabel><SelectField aria-label="Intake form" required value={field.state.value} onValueChange={value => { field.handleChange(value); form.setFieldValue('answers', {}); }} className="w-full" options={templates.map(item => ({ value: item.id, label: item.name }))} />{field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>
      )} />
      {template && !template.teamId && <form.Field name="teamId" validators={{ onChange: ({ value }) => (!value ? 'Choose a team' : undefined) }} children={field => (
        <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}><FieldLabel className="text-xs font-medium">Team</FieldLabel><TeamPicker label="Intake team" teams={validTeams} teamId={field.state.value} onTeamChange={field.handleChange} className="h-9 w-full justify-start" />{field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>
      )} />}
      <form.Field name="title" validators={{ onChange: ({ value }) => (!value.trim() ? 'Issue title is required' : undefined) }} children={field => (
        <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}><FieldLabel htmlFor="intake-title" className="text-xs font-medium">Issue title</FieldLabel><Input id="intake-title" aria-label="Intake title" required maxLength={255} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} />{field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>
      )} />
      {template?.fields.map(item => {
        const setAnswer = (next: string) => form.setFieldValue('answers', current => ({ ...current, [item.key]: next }));
        const value = answers[item.key] ?? '';
        return <Field key={item.key}><FieldLabel className="text-xs font-medium">{item.label}{item.required ? ' *' : ''}</FieldLabel>{item.type === 'textarea' ? <Textarea aria-label={item.label} required={item.required} maxLength={4000} value={value} onChange={event => setAnswer(event.target.value)} /> : item.type === 'select' ? <SelectField aria-label={item.label} required={item.required} value={value} onValueChange={setAnswer} className="w-full" options={[{ value: '', label: 'Select…' }, ...(item.options ?? []).map(option => ({ value: option, label: option }))]} /> : <Input aria-label={item.label} required={item.required} maxLength={500} value={value} onChange={event => setAnswer(event.target.value)} />}</Field>;
      })}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!template || submitTemplate.isPending}>{submitTemplate.isPending ? 'Submitting…' : 'Submit to triage'}</Button></DialogFooter>
    </form>
  </>;
}

function ReviewDialog({ issue, mode, open, onOpenChange, onResolved, teams, action }: {
  issue: Issue; mode: Decision; open: boolean; onOpenChange: (open: boolean) => void; onResolved: () => void;
  teams: { id: string; name: string; key: string; canWrite?: boolean; isPrivate?: boolean; members?: { userId: string }[] }[]; action: ReturnType<typeof useTriageAction>;
}) {
  const { data: users = [], isError: usersError, refetch: refetchUsers } = useUsers();
  const { data: issues = [], isPending: issuesLoading, isError: issuesError, refetch: refetchIssues } = useIssues();
  const form = useForm({
    defaultValues: { teamId: issue.teamId, assigneeId: issue.assigneeId ?? '', status: '', reason: '', targetId: '' },
    onSubmit: async ({ value }) => {
      try {
        if (mode === 'accept') await action.mutateAsync({ action: mode, id: issue.id, teamId: value.teamId, status: value.status, assigneeId: value.assigneeId || null });
        else if (mode === 'decline') await action.mutateAsync({ action: mode, id: issue.id, reason: value.reason });
        else await action.mutateAsync({ action: mode, id: issue.id, targetId: value.targetId });
        form.reset();
        onResolved();
      } catch { /* Keep the form and its values open; the inline error and mutation toast explain the failure. */ }
    },
  });
  const { teamId, assigneeId, status, targetId } = useStore(form.store, state => state.values);
  const workflow = useTeamWorkflowStates(teamId);
  React.useEffect(() => {
    if (!open) return;
    form.reset({ teamId: issue.teamId, assigneeId: issue.assigneeId ?? '', status: '', reason: '', targetId: '' }); action.reset();
  }, [open, issue.id, mode]);
  React.useEffect(() => {
    const state = ['unstarted', 'started', 'backlog'].map(category => workflow.data?.find(item => item.isActive && item.category === category)).find(Boolean);
    if (state) form.setFieldValue('status', current => workflow.data?.some(item => item.key === current && item.isActive) ? current : state.key);
  }, [workflow.data]);
  const selectedTeam = teams.find(team => team.id === teamId);
  const availableUsers = users.filter(user => user.isActive !== false && (!selectedTeam?.isPrivate || selectedTeam.members?.some(member => member.userId === user.id)));
  React.useEffect(() => {
    if (assigneeId && users.length && !availableUsers.some(user => user.id === assigneeId)) form.setFieldValue('assigneeId', '');
  }, [teamId, users, assigneeId]);
  const targetTeamIssues = issues.filter(item => item.id !== issue.id && item.teamId === issue.teamId && !item.archivedAt);
  const workStates = (workflow.data ?? []).filter(state => state.isActive && ['backlog', 'unstarted', 'started'].includes(state.category));
  const disabled = action.isPending || (mode === 'accept' ? !teamId || workflow.isPending || workflow.isError || !workStates.some(state => state.key === status) || (!!assigneeId && (usersError || !availableUsers.some(user => user.id === assigneeId))) : mode === 'duplicate' ? issuesLoading || issuesError || !targetTeamIssues.some(target => target.id === targetId) : false);
  const heading = mode === 'accept' ? 'Accept' : mode === 'decline' ? 'Decline' : 'Mark duplicate';
  return <Dialog open={open} onOpenChange={next => { if (!action.isPending) onOpenChange(next); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{heading} {issue.identifier}</DialogTitle><DialogDescription>{mode === 'accept' ? 'Choose a destination team, work status, and assignee. The issue will leave triage.' : mode === 'decline' ? 'This intake will be archived, not deleted. Add an optional reason to the activity record.' : 'Link this intake to an existing issue in the same team, then archive the duplicate.'}</DialogDescription></DialogHeader>
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="flex flex-col gap-4">
      <p className="break-words text-sm font-medium">{issue.title}</p>
      {mode === 'accept' && <FieldGroup>
        <form.Field name="teamId" children={field => <Field><FieldLabel htmlFor="triage-route-team">Route to team</FieldLabel><TeamPicker id="triage-route-team" label="Route to team" teams={teams} teamId={field.state.value} disabled={action.isPending} onTeamChange={value => { field.handleChange(value); form.setFieldValue('status', ''); }} className="h-9 w-full justify-start" /></Field>} />
        <form.Field name="status" children={field => <Field><FieldLabel htmlFor="triage-route-status">Accepted status</FieldLabel><SelectField id="triage-route-status" aria-label="Accepted status" value={field.state.value} disabled={action.isPending || workflow.isPending || workflow.isError} onValueChange={field.handleChange} className="w-full" options={workStates.map(state => ({ value: state.key, label: state.name }))} /></Field>} />
        {workflow.isError && <Alert variant="destructive"><AlertDescription>Could not load destination workflow.<Button type="button" variant="outline" size="sm" onClick={() => void workflow.refetch()}>Retry workflow</Button></AlertDescription></Alert>}
        {!workflow.isPending && !workflow.isError && !workStates.length && <p className="text-xs text-muted-foreground">Configure an active work state for this team before accepting intake.</p>}
        <form.Field name="assigneeId" children={field => <Field><FieldLabel htmlFor="triage-route-assignee">Assignee</FieldLabel><SelectField id="triage-route-assignee" aria-label="Route assignee" value={field.state.value || 'none'} disabled={action.isPending} onValueChange={value => field.handleChange(value === 'none' ? '' : value)} className="w-full" options={[{ value: 'none', label: 'Unassigned' }, ...availableUsers.map(user => ({ value: user.id, label: `${user.name} (${user.role})` }))]} /></Field>} />
        {usersError && <Alert variant="destructive"><AlertDescription>Could not load assignees.<Button type="button" variant="outline" size="sm" onClick={() => void refetchUsers()}>Retry assignees</Button></AlertDescription></Alert>}
      </FieldGroup>}
      {mode === 'decline' && <form.Field name="reason" children={field => <Field><FieldLabel htmlFor="triage-decline-reason">Decline reason (optional)</FieldLabel><Textarea id="triage-decline-reason" aria-label="Decline reason" disabled={action.isPending} maxLength={500} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} placeholder="Why is this not actionable?" /></Field>} />}
      {mode === 'duplicate' && <Field><FieldLabel htmlFor="triage-duplicate-target">Duplicate of</FieldLabel><SelectField id="triage-duplicate-target" aria-label="Duplicate target" value={targetId} disabled={action.isPending || issuesLoading || issuesError} onValueChange={value => form.setFieldValue('targetId', value)} className="w-full min-w-0" options={[{ value: '', label: 'Choose existing issue' }, ...targetTeamIssues.map(target => ({ value: target.id, label: `${target.identifier} · ${target.title}` }))]} />{issuesError ? <Alert variant="destructive"><AlertDescription>Could not load duplicate targets.<Button type="button" variant="outline" size="sm" onClick={() => void refetchIssues()}>Retry issues</Button></AlertDescription></Alert> : !issuesLoading && !targetTeamIssues.length && <p className="text-xs text-muted-foreground">No other active issue in this team is available to link.</p>}</Field>}
      {action.isError && <Alert variant="destructive"><AlertDescription>{action.error.message}</AlertDescription></Alert>}
      <DialogFooter><Button type="button" variant="outline" disabled={action.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant={mode === 'decline' ? 'destructive' : 'default'} disabled={disabled}>{action.isPending ? 'Saving…' : mode === 'accept' ? 'Accept & route' : heading}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
