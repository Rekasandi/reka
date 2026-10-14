import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Textarea, toast } from '@reka/ui';
import { Archive, CalendarDays, Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { Project, ProjectMilestone } from '../api/projects.api';
import type { Issue } from '@reka/types';
import { useProjects } from '../hooks/use-projects';
import { useCreateProjectMilestone, useProjectDependencies, useProjectMilestones, useProjectUpdates, useProjectUpdateSubscription, useSetProjectUpdateSubscription, useAssignIssueMilestone, useAddProjectDependency, useRemoveProjectDependency, useCreateProjectUpdate, useUpdateProjectUpdate, useUpdateProjectMilestone, useDeleteProjectMilestone } from '../hooks/use-project-workflows';
import { useAuthStore } from '../../../stores/auth.store';

export function ProjectMilestonesPanel({ projectId, issues }: { projectId: string; issues: Issue[] }) {
  const { data: milestones = [], isLoading, isError, refetch } = useProjectMilestones(projectId);
  const assign = useAssignIssueMilestone(projectId);
  const create = useCreateProjectMilestone(projectId);
  const update = useUpdateProjectMilestone(projectId);
  const remove = useDeleteProjectMilestone(projectId);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try { await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined, targetDate: targetDate || undefined }); setOpen(false); setName(''); setDescription(''); setTargetDate(''); }
    catch { /* mutation surfaces the error */ }
  }
  return <section className="flex flex-col gap-4 py-3">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Milestones</h2><p className="mt-1 text-sm text-muted-foreground">Dated delivery stages with issue progress calculated from current workflow states.</p></div><Button size="sm" onClick={() => setOpen(true)}><Plus data-icon="inline-start" />New milestone</Button></header>
    {isLoading && <div role="status" aria-label="Loading milestones" className="flex flex-col gap-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}
    {isError && <div role="alert" className="flex items-center justify-between gap-3 text-sm"><span>Could not load milestones.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>}
    {!isLoading && !isError && !milestones.length && <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No milestones yet. Create a dated stage and assign project issues.</div>}
    {!isLoading && !isError && milestones.map((milestone: ProjectMilestone) => {
      const assigned = issues.filter(issue => issue.milestoneId === milestone.id);
      return <article key={milestone.id} className="flex flex-col gap-3 border-b border-border py-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{milestone.name}</h3>{milestone.isComplete && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="size-3" />Complete</span>}</div>{milestone.description && <p className="mt-1 text-sm text-muted-foreground">{milestone.description}</p>}<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{milestone.targetDate ? new Date(milestone.targetDate).toLocaleDateString() : 'No target date'}</span><span>{milestone.completedIssues}/{milestone.totalIssues} issues complete</span><span>{milestone.progress}%</span></div><div role="progressbar" aria-label={`${milestone.name} progress`} aria-valuenow={milestone.progress} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${milestone.progress}%` }} /></div></div>
          <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Move ${milestone.name} earlier`} disabled={update.isPending || milestone.position === 0} onClick={() => update.mutate({ milestoneId: milestone.id, input: { position: milestone.position - 1 } })}>↑</Button><Button variant="ghost" size="icon-sm" aria-label={`Move ${milestone.name} later`} disabled={update.isPending || milestone.position >= milestones.length - 1} onClick={() => update.mutate({ milestoneId: milestone.id, input: { position: milestone.position + 1 } })}>↓</Button><Button variant="ghost" size="icon-sm" aria-label={`Delete ${milestone.name}`} disabled={remove.isPending} onClick={() => remove.mutate(milestone.id)}><Trash2 /></Button></div>
        </div>
        {assigned.length > 0 && <ul className="flex flex-wrap gap-2">{assigned.map(issue => <li key={issue.id} className="inline-flex max-w-full items-center gap-1 rounded border border-border px-2 py-1 text-xs"><span className="font-mono text-muted-foreground">{issue.identifier}</span><span className="max-w-48 truncate">{issue.title}</span><Button variant="ghost" size="icon-xs" aria-label={`Remove ${issue.identifier} from ${milestone.name}`} disabled={assign.isPending} onClick={() => assign.mutate({ milestoneId: milestone.id, issueId: issue.id, assigned: false })}><Trash2 /></Button></li>)}</ul>}
        <Select value="" onValueChange={issueId => assign.mutate({ milestoneId: milestone.id, issueId, assigned: true })}><SelectTrigger aria-label={`Assign issue to ${milestone.name}`} className="w-full sm:w-72"><SelectValue placeholder="Add or move an issue…" /></SelectTrigger><SelectContent>{issues.map(issue => <SelectItem key={issue.id} value={issue.id}>{issue.identifier} · {issue.title}</SelectItem>)}</SelectContent></Select>
      </article>;
    })}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><form onSubmit={submit} className="flex flex-col gap-4"><DialogHeader><DialogTitle>New milestone</DialogTitle><DialogDescription>Create a dated project stage. Completion is calculated from its assigned, non-canceled issues.</DialogDescription></DialogHeader><Input aria-label="Milestone name" placeholder="Milestone name" maxLength={255} value={name} onChange={event => setName(event.target.value)} required /><Textarea aria-label="Milestone description" placeholder="Description (optional)" maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} /><label className="flex flex-col gap-1 text-xs text-muted-foreground">Target date<input type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>{create.isError && <Alert variant="destructive"><AlertDescription>{create.error.message}</AlertDescription></Alert>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={!name.trim() || create.isPending}>{create.isPending ? 'Creating…' : 'Create milestone'}</Button></DialogFooter></form></DialogContent></Dialog>
  </section>;
}

export function ProjectDependenciesPanel({ project }: { project: Project }) {
  const { data: projects = [] } = useProjects();
  const { data, isLoading, isError, refetch } = useProjectDependencies(project.id);
  const add = useAddProjectDependency(project.id);
  const remove = useRemoveProjectDependency(project.id);
  const [target, setTarget] = React.useState('');
  const options = projects.filter(item => item.id !== project.id && !data?.dependsOn.some(link => link.id === item.id));
  return <section className="flex flex-col gap-4 py-3"><header><h2 className="text-lg font-semibold">Project dependencies</h2><p className="mt-1 text-sm text-muted-foreground">A project is ready when the projects it depends on are complete.</p></header>
    <div className="flex flex-col gap-2 sm:flex-row"><Select value={target} onValueChange={setTarget}><SelectTrigger aria-label="Choose prerequisite project"><SelectValue placeholder="Select a project this work depends on" /></SelectTrigger><SelectContent>{options.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!target || add.isPending} onClick={() => add.mutate(target, { onSuccess: () => setTarget('') })}><Plus data-icon="inline-start" />Add dependency</Button></div>
    {isLoading && <Skeleton className="h-20 w-full" />}{isError && <div role="alert" className="flex items-center gap-3 text-sm"><span>Could not load dependencies.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw />Retry</Button></div>}
    {!isLoading && !isError && <div className="grid gap-6 sm:grid-cols-2"><DependencyList title="Depends on" items={data?.dependsOn ?? []} onRemove={id => remove.mutate(id)} /><DependencyList title="Blocks" items={data?.blockedBy ?? []} /></div>}
  </section>;
}
function DependencyList({ title, items, onRemove }: { title: string; items: { id: string; name: string; status: string; targetDate: string | null }[]; onRemove?: (id: string) => void }) {
  return <section><h3 className="text-xs font-medium text-muted-foreground">{title}</h3>{items.length ? <ul className="mt-2 divide-y divide-border border-y border-border">{items.map(item => <li key={item.id} className="flex items-center gap-2 py-2 text-sm"><Link className="min-w-0 flex-1 truncate hover:underline" to={`/projects/${item.id}`}>{item.name}</Link><span className="text-xs text-muted-foreground">{item.status.replaceAll('_', ' ')}</span>{onRemove && <Button variant="ghost" size="icon-sm" aria-label={`Remove dependency on ${item.name}`} onClick={() => onRemove(item.id)}><Trash2 /></Button>}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No {title.toLowerCase()} projects.</p>}</section>;
}

export function ProjectUpdatesPanel({ projectId }: { projectId: string }) {
  const { data: updates = [], isLoading, isError, refetch } = useProjectUpdates(projectId);
  const create = useCreateProjectUpdate(projectId);
  const edit = useUpdateProjectUpdate(projectId);
  const { data: subscription, isLoading: isSubscriptionLoading, isError: isSubscriptionError, refetch: refetchSubscription } = useProjectUpdateSubscription(projectId);
  const setSubscription = useSetProjectUpdateSubscription(projectId);
  const actor = useAuthStore(state => state.user);
  const [body, setBody] = React.useState('');
  const [health, setHealth] = React.useState<Project['health']>('on_track');
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  async function post(event: React.FormEvent) { event.preventDefault(); try { await create.mutateAsync({ body, health }); setBody(''); } catch { /* mutation surfaces the error */ } }
  async function saveEdit(id: string, itemHealth: Project['health']) { try { await edit.mutateAsync({ updateId: id, input: { body: draft, health: itemHealth } }); setEditing(null); } catch { /* mutation surfaces the error */ } }
  return <section className="flex flex-col gap-4 py-3"><header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Project updates</h2><p className="mt-1 text-sm text-muted-foreground">Timestamped health notes visible to people who can access this project.</p></div>{isSubscriptionError ? <Button variant="outline" size="sm" onClick={() => void refetchSubscription()}><RefreshCw data-icon="inline-start" />Retry subscription</Button> : <Button variant="outline" size="sm" disabled={isSubscriptionLoading || setSubscription.isPending} onClick={() => setSubscription.mutate(!subscription?.subscribed)}>{subscription?.subscribed ? 'Unsubscribe from updates' : 'Subscribe to updates'}</Button>}</header>
    <form onSubmit={post} className="flex flex-col gap-3 border-b border-border pb-4"><label className="flex flex-col gap-1 text-xs text-muted-foreground">Health update<select value={health} onChange={event => setHealth(event.target.value as Project['health'])} className="h-9 max-w-xs rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option></select></label><Textarea aria-label="Project update" placeholder="What changed? Share progress, risks, and next steps…" maxLength={10000} value={body} onChange={event => setBody(event.target.value)} required /><div className="flex justify-end"><Button size="sm" type="submit" disabled={!body.trim() || create.isPending}>{create.isPending ? 'Posting…' : 'Post update'}</Button></div>{create.isError && <Alert variant="destructive"><AlertDescription>{create.error.message}</AlertDescription></Alert>}</form>
    {isLoading && <div role="status" aria-label="Loading project updates"><Skeleton className="h-20 w-full" /></div>}{isError && <div role="alert" className="flex items-center gap-3 text-sm"><span>Could not load updates.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw />Retry</Button></div>}
    {!isLoading && !isError && (updates.length ? <ol className="divide-y divide-border">{updates.map(item => <li key={item.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs"><span className="font-medium">{item.authorName ?? 'Workspace member'}</span><span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span><span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{item.health.replaceAll('_', ' ')}</span></div>{item.authorId === actor?.id && editing !== item.id && <Button variant="ghost" size="sm" onClick={() => { setEditing(item.id); setDraft(item.body); }}>Edit</Button>}</div>{editing === item.id ? <div className="mt-3 flex flex-col gap-2"><Textarea aria-label="Edit project update" maxLength={10000} value={draft} onChange={event => setDraft(event.target.value)} /><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" disabled={!draft.trim() || edit.isPending} onClick={() => void saveEdit(item.id, item.health)}>{edit.isPending ? 'Saving…' : 'Save update'}</Button></div></div> : <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p>}</li>)}</ol> : <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No project updates yet.</p>)}
  </section>;
}
