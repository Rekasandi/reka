import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, AlertDescription, Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton, Textarea } from '@reka/ui';
import { ArrowLeft, CalendarDays, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useInitiative, useInitiativeProject, useDeleteInitiative, useUpdateInitiative } from '../hooks/use-initiatives';
import { useProjects } from '../../projects/hooks/use-projects';
import { useAuthStore } from '../../../stores/auth.store';
import type { InitiativeHealth, InitiativeStatus } from '../api/initiatives.api';

const dateInputValue = (value?: string | null) => value ? value.slice(0, 10) : '';
const label = (value: string) => value.replaceAll('_', ' ');

export function InitiativeDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const { data: initiative, isLoading, isError, refetch } = useInitiative(id);
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const update = useUpdateInitiative(id);
  const linkProject = useInitiativeProject(id);
  const removeInitiative = useDeleteInitiative();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<InitiativeStatus>('planned');
  const [health, setHealth] = React.useState<InitiativeHealth>('on_track');
  const [startDate, setStartDate] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const canEditMetadata = !!user && (user.role === 'owner' || user.role === 'admin' || initiative?.ownerId === user.id);
  const canWrite = !!user && !['guest', 'client'].includes(user.role);

  React.useEffect(() => {
    if (!initiative) return;
    setName(initiative.name); setDescription(initiative.description); setStatus(initiative.status); setHealth(initiative.health);
    setStartDate(dateInputValue(initiative.startDate)); setTargetDate(dateInputValue(initiative.targetDate));
  }, [initiative?.id, initiative?.updatedAt]);

  const linkedIds = new Set(initiative?.projects.map(project => project.id) ?? []);
  const candidateProjects = projects.filter(project => !linkedIds.has(project.id));
  async function save(event: React.FormEvent) {
    event.preventDefault(); setFormError('');
    try { await update.mutateAsync({ name: name.trim(), description: description.trim(), status, health, startDate: startDate || null, targetDate: targetDate || null }); }
    catch (error) { setFormError((error as Error).message); }
  }
  async function attachProject(event: React.FormEvent) {
    event.preventDefault(); if (!projectId) return;
    try { await linkProject.mutateAsync({ projectId, add: true }); setProjectId(''); }
    catch { /* mutation reports the permission error */ }
  }
  async function deleteItem() {
    try { await removeInitiative.mutateAsync(id); setDeleteOpen(false); navigate('/initiatives'); }
    catch { /* mutation reports the permission error */ }
  }

  return <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-2"><Button asChild variant="ghost" size="sm"><Link to="/initiatives"><ArrowLeft data-icon="inline-start" />All initiatives</Link></Button><Button asChild variant="outline" size="sm"><Link to="/roadmap">Open roadmap</Link></Button></div>
    {isLoading && <div role="status" aria-label="Loading initiative" className="space-y-3"><Skeleton className="h-9 w-72" /><Skeleton className="h-24 w-full" /><Skeleton className="h-48 w-full" /></div>}
    {isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 p-4 text-sm"><span>Could not load this initiative.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>}
    {!isLoading && !isError && initiative && <>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight">{initiative.name}</h1><p className="mt-1 text-sm text-muted-foreground">{initiative.description || 'Company objective'}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="capitalize">{label(initiative.status)}</Badge>{canEditMetadata && <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}><Trash2 data-icon="inline-start" />Delete</Button>}</div></header>
      <section aria-label="Initiative progress" className="grid gap-3 border-b border-border pb-5 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Visible projects</p><p className="mt-1 text-lg font-medium tabular-nums">{initiative.projectCount}</p></div><div><p className="text-xs text-muted-foreground">Issue progress</p><p className="mt-1 text-lg font-medium tabular-nums">{initiative.progress === null ? 'No issue data' : `${initiative.progress}%`}</p>{initiative.progress !== null && <p className="text-xs text-muted-foreground">{initiative.completedIssues} of {initiative.totalIssues} active issues completed</p>}</div><div><p className="text-xs text-muted-foreground">Target date</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm"><CalendarDays className="size-3.5" />{initiative.targetDate ? new Date(initiative.targetDate).toLocaleDateString([], { timeZone: 'UTC', dateStyle: 'medium' }) : 'Unscheduled'}</p></div></section>

      <form onSubmit={save} className="flex flex-col gap-4 border-b border-border pb-6"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Objective details</h2><p className="text-xs text-muted-foreground">Health and dates are stored on the initiative.</p></div>{canEditMetadata && <Button type="submit" disabled={!name.trim() || update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>}</div>
        <fieldset disabled={!canEditMetadata} className="grid min-w-0 gap-3 disabled:opacity-70 sm:grid-cols-2"><label className="flex flex-col gap-1 text-xs text-muted-foreground">Name<Input aria-label="Edit initiative name" maxLength={180} value={name} onChange={event => setName(event.target.value)} /></label><label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">Description<Textarea aria-label="Edit initiative description" maxLength={20000} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Status<select aria-label="Edit initiative status" value={status} onChange={event => setStatus(event.target.value as InitiativeStatus)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Health<select aria-label="Edit initiative health" value={health} onChange={event => setHealth(event.target.value as InitiativeHealth)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option></select></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Start date<input aria-label="Edit initiative start date" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Target date<input aria-label="Edit initiative target date" type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label></fieldset>
        {!canEditMetadata && <p className="text-xs text-muted-foreground">Only the initiative owner or a workspace administrator can edit objective details.</p>}{formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}
      </form>

      <section className="flex flex-col gap-3"><header><h2 className="text-lg font-semibold">Projects</h2><p className="text-xs text-muted-foreground">Only projects you can access appear here. Each team's progress uses its current issue status categories.</p></header>
        {canWrite && <form onSubmit={attachProject} className="flex flex-col gap-2 sm:flex-row"><select aria-label="Project to add" value={projectId} onChange={event => setProjectId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Select a project you manage…</option>{candidateProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select><Button type="submit" variant="outline" disabled={!projectId || linkProject.isPending}><Plus data-icon="inline-start" />Add project</Button></form>}
        {linkProject.isError && <Alert variant="destructive"><AlertDescription>{linkProject.error.message}</AlertDescription></Alert>}
        {loadingProjects && <Skeleton className="h-10 w-full" />}
        {!loadingProjects && initiative.projects.length === 0 && <p className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No accessible projects linked. Project leads, team leads and workspace administrators can add projects they manage.</p>}
        {!loadingProjects && initiative.projects.length > 0 && <div className="overflow-x-auto border-y border-border"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-3 py-2">Project</th><th className="px-3 py-2 text-right">Issues</th><th className="px-3 py-2 text-right">Progress</th><th className="px-3 py-2 text-right">Target</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y divide-border/70">{initiative.projects.map(project => <tr key={project.id}><td className="px-3 py-2.5"><Link to={`/projects/${project.id}`} className="font-medium hover:underline">{project.name}</Link><span className="ml-2 text-xs capitalize text-muted-foreground">{label(project.status)}</span></td><td className="px-3 py-2.5 text-right tabular-nums">{project.totalIssues}</td><td className="px-3 py-2.5 text-right tabular-nums">{project.progress === null ? '—' : `${project.progress}%`}</td><td className="px-3 py-2.5 text-right text-xs text-muted-foreground">{project.targetDate ? new Date(project.targetDate).toLocaleDateString([], { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unscheduled'}</td><td className="px-3 py-2.5 text-right"><Button variant="ghost" size="icon-sm" aria-label={`Remove ${project.name} from initiative`} disabled={linkProject.isPending || !canWrite} onClick={() => linkProject.mutate({ projectId: project.id, add: false })}><Trash2 className="size-3.5" /></Button></td></tr>)}</tbody></table></div>}
      </section>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete initiative?</DialogTitle><DialogDescription>This removes the initiative and its project grouping. Projects, issues, dependencies and their history remain.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" disabled={removeInitiative.isPending} onClick={() => void deleteItem()}>{removeInitiative.isPending ? 'Deleting…' : 'Delete initiative'}</Button></DialogFooter></DialogContent></Dialog>
    </>}
  </main>;
}
