import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton, Textarea } from '@reka/ui';
import { Archive, Check, ClipboardList, Copy, Plus, Trash2 } from 'lucide-react';
import { useTeams } from '../../teams/hooks/use-teams';
import { useTeamWorkflowStates } from '../../teams/hooks/use-teams';
import { useIssues } from '../hooks/use-issues';
import { useUsers } from '../../users/hooks/use-users';
import { useAuthStore } from '../../../stores/auth.store';
import { useCreateIssueTemplate, useDeleteIssueTemplate, useIssueTemplates, useSubmitIssueTemplate, useTriage, useTriageAction } from '../hooks/use-triage';
import type { IntakeField, IssueTemplate } from '../api/triage.api';
import type { Issue } from '@reka/types';

const formFields: IntakeField[] = [{ key: 'details', label: 'What should we know?', type: 'textarea', required: true }];
const templateDefaults = { titlePrefix: '', description: '', defaultStatus: 'triage', defaultType: 'task', defaultPriority: 'no_priority', defaultEstimate: null, fields: formFields };

export function TriagePage() {
  const [params] = useSearchParams();
  const teamId = params.get('teamId');
  const { user } = useAuthStore();
  const { data: teams = [] } = useTeams();
  const { data: allTriage = [], isLoading, isError, refetch } = useTriage();
  const queue = teamId ? allTriage.filter(issue => issue.teamId === teamId) : allTriage;
  const { data: templates = [], isError: templatesError, isLoading: templatesLoading, refetch: refetchTemplates } = useIssueTemplates();
  const { data: issues = [] } = useIssues();
  const createTemplate = useCreateIssueTemplate();
  const deleteTemplate = useDeleteIssueTemplate();
  const submitTemplate = useSubmitIssueTemplate();
  const action = useTriageAction();
  const [templateManagerOpen, setTemplateManagerOpen] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [reviewIssue, setReviewIssue] = React.useState<Issue | null>(null);
  const canManage = user?.role === 'owner' || user?.role === 'admin' || teams.some(team => team.canManage);
  const writableTeams = teams.filter(team => team.canWrite);
  const intakeTemplates = templates.filter(template => !template.teamId || writableTeams.some(team => team.id === template.teamId));

  return <main className="flex w-full min-w-0 flex-col gap-5 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Triage</h1><p className="mt-1 max-w-xl text-xs text-muted-foreground">Review incoming work, route it to a team, or close the loop with a decline or duplicate.</p></div>
      <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setTemplateManagerOpen(true)} disabled={!canManage}><ClipboardList />Templates</Button><Button type="button" onClick={() => setSubmitOpen(true)} disabled={templatesLoading || !intakeTemplates.length || !writableTeams.length}><Plus />New intake</Button></div>
    </header>

    {isError && <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Triage queue could not be loaded.<Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button></AlertDescription></Alert>}
    {templatesError && <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">Intake forms could not be loaded.<Button type="button" variant="outline" size="sm" onClick={() => void refetchTemplates()}>Retry</Button></AlertDescription></Alert>}
    <section aria-label="Triage queue" className="overflow-hidden rounded-lg border border-border/70 bg-card/30">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><div><h2 className="text-sm font-medium">Needs review</h2><p className="text-xs text-muted-foreground">{queue.length} incoming {queue.length === 1 ? 'issue' : 'issues'}</p></div><span className="text-xs text-muted-foreground">Team triage</span></div>
      {isLoading ? <div role="status" aria-label="Loading triage queue" className="flex flex-col gap-3 p-4">{[0, 1, 2].map(item => <Skeleton key={item} className="h-14 w-full" />)}</div> : isError ? null : queue.length === 0 ? <div className="flex flex-col items-center gap-2 px-6 py-12 text-center"><ClipboardList className="size-6 text-muted-foreground/60" /><p className="text-sm font-medium">Nothing waiting for review</p><p className="text-xs text-muted-foreground">Use an internal intake form to submit the first issue.</p><Button type="button" size="sm" onClick={() => setSubmitOpen(true)} disabled={templatesLoading || !intakeTemplates.length || !writableTeams.length}>New intake</Button></div> : <ul className="divide-y divide-border/70">{queue.map((issue: Issue) => {
        const team = teams.find(item => item.id === issue.teamId);
        return <li key={issue.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[11px] text-muted-foreground">{team?.key}-{issue.number}</span><span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:text-orange-300">{issue.statusLabel ?? 'Triage'}</span></div><p className="mt-1 truncate text-sm font-medium">{issue.title}</p><p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{issue.description || 'No intake details provided.'}</p></div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setReviewIssue(issue)} disabled={!team?.canWrite}>Review</Button>
        </li>;
      })}</ul>}
    </section>

    <TemplateManager open={templateManagerOpen} onOpenChange={setTemplateManagerOpen} teams={teams} templates={templates} createTemplate={createTemplate} deleteTemplate={deleteTemplate} canManage={canManage} canManageWorkspace={user?.role === 'owner' || user?.role === 'admin'} />
    <IntakeDialog open={submitOpen} onOpenChange={setSubmitOpen} templates={intakeTemplates} teams={writableTeams} submitTemplate={submitTemplate} />
    {reviewIssue && <ReviewDialog issue={reviewIssue} open={!!reviewIssue} onOpenChange={open => { if (!open) setReviewIssue(null); }} teams={writableTeams} issues={issues} action={action} />}
  </main>;
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
      {canManage && <div className="flex flex-col gap-2 rounded-md border border-border/70 p-3"><h3 className="text-xs font-semibold text-muted-foreground">New template</h3><Input aria-label="Template name" placeholder="e.g. Bug report" maxLength={100} value={name} onChange={event => setName(event.target.value)} /><select aria-label="Template team" value={teamId} onChange={event => setTeamId(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{canManageWorkspace && <option value="">Workspace-wide</option>}{managers.map(team => <option key={team.id} value={team.id}>{team.name} ({team.key})</option>)}</select><p className="text-xs text-muted-foreground">Creates a triage form with one required details field. Change issue properties after acceptance.</p>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<div className="flex justify-end"><Button type="button" size="sm" onClick={() => void save()} disabled={createTemplate.isPending || (!teamId && !canManageWorkspace)}>{createTemplate.isPending ? 'Saving…' : 'Create template'}</Button></div></div>}
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function IntakeDialog({ open, onOpenChange, templates, teams, submitTemplate }: {
  open: boolean; onOpenChange: (open: boolean) => void; templates: IssueTemplate[]; teams: { id: string; name: string; key: string; canWrite?: boolean }[];
  submitTemplate: ReturnType<typeof useSubmitIssueTemplate>;
}) {
  const [templateId, setTemplateId] = React.useState('');
  const [teamId, setTeamId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const template = templates.find(item => item.id === templateId);
  React.useEffect(() => {
    if (!open) return;
    setTemplateId(templates[0]?.id ?? ''); setTeamId(''); setTitle(''); setAnswers({});
  }, [open, templates]);
  React.useEffect(() => { if (template?.teamId) setTeamId(template.teamId); }, [template?.id, template?.teamId]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!template) return;
    try {
      await submitTemplate.mutateAsync({ id: template.id, input: { title, teamId: template.teamId ? undefined : teamId, answers } });
      onOpenChange(false);
    } catch { /* mutation toast presents the API validation error */ }
  };
  const validTeams = teams.filter(team => team.canWrite);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New internal intake</DialogTitle><DialogDescription>Submissions create a real issue in the selected team's triage queue.</DialogDescription></DialogHeader>
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <label className="flex flex-col gap-1 text-xs font-medium">Form<select aria-label="Intake form" required value={templateId} onChange={event => { setTemplateId(event.target.value); setAnswers({}); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {template && !template.teamId && <label className="flex flex-col gap-1 text-xs font-medium">Team<select aria-label="Intake team" required value={teamId} onChange={event => setTeamId(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="">Choose team</option>{validTeams.map(team => <option key={team.id} value={team.id}>{team.name} ({team.key})</option>)}</select></label>}
      <label className="flex flex-col gap-1 text-xs font-medium">Issue title<Input aria-label="Intake title" required maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label>
      {template?.fields.map(field => <label key={field.key} className="flex flex-col gap-1 text-xs font-medium">{field.label}{field.required ? ' *' : ''}{field.type === 'textarea' ? <Textarea aria-label={field.label} required={field.required} maxLength={4000} value={answers[field.key] ?? ''} onChange={event => setAnswers(current => ({ ...current, [field.key]: event.target.value }))} /> : field.type === 'select' ? <select aria-label={field.label} required={field.required} value={answers[field.key] ?? ''} onChange={event => setAnswers(current => ({ ...current, [field.key]: event.target.value }))} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="">Select…</option>{field.options?.map(option => <option key={option}>{option}</option>)}</select> : <Input aria-label={field.label} required={field.required} maxLength={500} value={answers[field.key] ?? ''} onChange={event => setAnswers(current => ({ ...current, [field.key]: event.target.value }))} />}</label>)}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!template || submitTemplate.isPending}>{submitTemplate.isPending ? 'Submitting…' : 'Submit to triage'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

function ReviewDialog({ issue, open, onOpenChange, teams, issues, action }: {
  issue: Issue; open: boolean; onOpenChange: (open: boolean) => void;
  teams: { id: string; name: string; key: string; canWrite?: boolean; isPrivate?: boolean; members?: { userId: string }[] }[]; issues: Issue[]; action: ReturnType<typeof useTriageAction>;
}) {
  const { data: users = [] } = useUsers();
  const [teamId, setTeamId] = React.useState(issue.teamId);
  const [assigneeId, setAssigneeId] = React.useState(issue.assigneeId ?? '');
  const [status, setStatus] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [targetId, setTargetId] = React.useState('');
  const workflow = useTeamWorkflowStates(teamId);
  React.useEffect(() => {
    if (!open) return;
    setTeamId(issue.teamId); setAssigneeId(issue.assigneeId ?? ''); setStatus(''); setReason(''); setTargetId('');
  }, [open, issue.id]);
  React.useEffect(() => {
    const state = ['unstarted', 'started', 'backlog'].map(category => workflow.data?.find(item => item.isActive && item.category === category)).find(Boolean);
    if (state) setStatus(current => workflow.data?.some(item => item.key === current && item.isActive) ? current : state.key);
  }, [workflow.data]);
  const selectedTeam = teams.find(team => team.id === teamId);
  const availableUsers = users.filter(user => user.isActive !== false && (!selectedTeam?.isPrivate || selectedTeam.members?.some(member => member.userId === user.id)));
  React.useEffect(() => {
    if (assigneeId && users.length && !availableUsers.some(user => user.id === assigneeId)) setAssigneeId('');
  }, [teamId, users, assigneeId]);
  const targetTeamIssues = issues.filter(item => item.id !== issue.id && item.teamId === issue.teamId && !item.archivedAt);
  const accept = async () => { try { await action.mutateAsync({ action: 'accept', id: issue.id, teamId, status, assigneeId: assigneeId || null }); onOpenChange(false); } catch { /* mutation toast reports API errors */ } };
  const decline = async () => { try { await action.mutateAsync({ action: 'decline', id: issue.id, reason }); onOpenChange(false); } catch { /* mutation toast reports API errors */ } };
  const duplicate = async () => { if (!targetId) return; try { await action.mutateAsync({ action: 'duplicate', id: issue.id, targetId }); onOpenChange(false); } catch { /* mutation toast reports API errors */ } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Review {issue.identifier}</DialogTitle><DialogDescription>Inspect the incoming details and choose a team workflow outcome.</DialogDescription></DialogHeader>
    <div className="flex flex-col gap-3"><div className="rounded-md border border-border/70 bg-muted/20 p-3"><h3 className="text-sm font-medium">{issue.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{issue.description || 'No details supplied.'}</p></div>
      <label className="flex flex-col gap-1 text-xs font-medium">Route to team<select aria-label="Route to team" value={teamId} onChange={event => { setTeamId(event.target.value); setStatus(''); }} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{teams.map(team => <option key={team.id} value={team.id}>{team.name} ({team.key})</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-medium">Accepted status<select aria-label="Accepted status" value={status} onChange={event => setStatus(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{(workflow.data ?? []).filter(state => state.isActive && ['backlog', 'unstarted', 'started'].includes(state.category)).map(state => <option key={state.key} value={state.key}>{state.name}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-medium">Assignee<select aria-label="Route assignee" value={assigneeId || 'none'} onChange={event => setAssigneeId(event.target.value === 'none' ? '' : event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="none">Unassigned</option>{availableUsers.map(user => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label>
      {workflow.isError && <div role="alert" className="flex items-center justify-between rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive">Could not load destination workflow.<Button type="button" variant="ghost" size="xs" onClick={() => void workflow.refetch()}>Retry</Button></div>}
      <label className="flex flex-col gap-1 text-xs font-medium">Decline reason (optional)<Textarea aria-label="Decline reason" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <label className="flex flex-col gap-1 text-xs font-medium">Duplicate of<select aria-label="Duplicate target" value={targetId} onChange={event => setTargetId(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="">Choose existing issue</option>{targetTeamIssues.map(target => <option key={target.id} value={target.id}>{target.identifier} · {target.title}</option>)}</select></label>
    </div>
    <DialogFooter className="flex-wrap sm:justify-between"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => void decline()} disabled={action.isPending}><Archive />Decline</Button><Button type="button" variant="outline" onClick={() => void duplicate()} disabled={action.isPending || !targetId}><Copy />Mark duplicate</Button><Button type="button" onClick={() => void accept()} disabled={action.isPending || !teamId || !status}><Check />Accept & route</Button></div></DialogFooter>
  </DialogContent></Dialog>;
}
