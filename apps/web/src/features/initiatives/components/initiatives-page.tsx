import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Skeleton } from '@reka/ui';
import { CalendarDays, Plus, RefreshCw, Route } from 'lucide-react';
import { useInitiatives } from '../hooks/use-initiatives';
import { useProjects } from '../../projects/hooks/use-projects';
import { CreateInitiativeDialog } from './create-initiative-dialog';
import { useAuthStore } from '../../../stores/auth.store';

const statusLabel = (value: string) => value.replaceAll('_', ' ');
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unscheduled';

export function InitiativesPage() {
  const [search, setSearch] = useSearchParams();
  const initialCreate = search.get('create') === '1';
  const [createOpen, setCreateOpen] = React.useState(initialCreate);
  const teamId = search.get('teamId');
  const initiativesQuery = useInitiatives();
  const projectsQuery = useProjects();
  const teamProjects = new Set((projectsQuery.data ?? []).filter(project => project.teamId === teamId).map(project => project.id));
  const initiatives = (initiativesQuery.data ?? []).filter(item => !teamId || item.projects.some(project => teamProjects.has(project.id)));
  const isLoading = initiativesQuery.isLoading || (!!teamId && projectsQuery.isLoading);
  const isError = initiativesQuery.isError || (!!teamId && projectsQuery.isError);
  const refetch = () => Promise.all([initiativesQuery.refetch(), ...(teamId ? [projectsQuery.refetch()] : [])]);
  const user = useAuthStore(state => state.user);
  const canCreate = user && !['guest', 'client'].includes(user.role);
  React.useEffect(() => {
    if (search.get('create') === '1') { setCreateOpen(true); setSearch(params => { params.delete('create'); return params; }, { replace: true }); }
  }, [search, setSearch]);

  return <main className="flex min-w-0 flex-col gap-5 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Initiatives</h1><p className="mt-1 text-xs text-muted-foreground">Company objectives grouped around visible, real project work.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link to="/roadmap"><Route data-icon="inline-start" />Open roadmap</Link></Button><Button onClick={() => setCreateOpen(true)} disabled={!canCreate}><Plus data-icon="inline-start" />New initiative</Button></div></header>
    {isLoading && <div role="status" aria-label="Loading initiatives" className="space-y-2"><Skeleton className="h-10 w-full" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>}
    {isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 p-4 text-sm"><span>Could not load initiatives.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>}
    {!isLoading && !isError && !initiatives.length && <div className="border border-dashed border-border p-10 text-center"><p className="text-sm text-muted-foreground">{teamId ? 'No initiatives linked to this team’s projects yet.' : 'No initiatives yet. Create an objective and link projects you manage.'}</p>{canCreate && <Button className="mt-4" variant="outline" onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />Create initiative</Button>}</div>}
    {!isLoading && !isError && initiatives.length > 0 && <div className="divide-y divide-border border-y border-border md:hidden">{initiatives.map(item => <Link key={item.id} to={`/initiatives/${item.id}`} className="block rounded-sm px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><span className="min-w-0 truncate font-medium">{item.name}</span><Badge variant="outline" className="shrink-0 capitalize">{statusLabel(item.status)}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{item.projectCount} projects</span><span>{item.progress === null ? 'No issue data' : `${item.progress}% · ${item.completedIssues}/${item.totalIssues} issues`}</span><span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{dateLabel(item.targetDate)}</span></div></Link>)}</div>}
    {!isLoading && !isError && initiatives.length > 0 && <div className="hidden overflow-x-auto border-y border-border md:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr className="border-b border-border"><th scope="col" className="px-3 py-2.5 font-medium">Initiative</th><th scope="col" className="px-3 py-2.5 text-right font-medium">Projects</th><th scope="col" className="px-3 py-2.5 text-right font-medium">Progress</th><th scope="col" className="px-3 py-2.5 text-right font-medium">Target</th><th scope="col" className="px-3 py-2.5 text-right font-medium">Status</th></tr></thead><tbody className="divide-y divide-border/70">{initiatives.map(item => <tr key={item.id} className="hover:bg-muted/30"><td className="px-3 py-3"><Link to={`/initiatives/${item.id}`} className="block rounded-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.name}<span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{item.description || 'No description'}</span></Link></td><td className="px-3 py-3 text-right tabular-nums">{item.projectCount}</td><td className="px-3 py-3 text-right">{item.progress === null ? <span className="text-xs text-muted-foreground">No issue data</span> : <span className="tabular-nums">{item.progress}% <span className="text-xs text-muted-foreground">({item.completedIssues}/{item.totalIssues})</span></span>}</td><td className="px-3 py-3 text-right text-xs text-muted-foreground"><span className="inline-flex items-center justify-end gap-1.5"><CalendarDays className="size-3" />{dateLabel(item.targetDate)}</span></td><td className="px-3 py-3 text-right"><Badge variant="outline" className="capitalize">{statusLabel(item.status)}</Badge></td></tr>)}</tbody></table></div>}
    <CreateInitiativeDialog open={createOpen} onOpenChange={setCreateOpen} />
  </main>;
}
