import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, Badge, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSortHead } from '@reka/ui';
import { ArrowLeft, Plus, Settings2, Users } from 'lucide-react';
import { useTeam, useTeams } from '../../teams/hooks/use-teams';
import { CreateTeamDialog } from '../../teams/components/create-team-dialog';
import { TeamSettingsDialog } from '../../teams/components/team-settings-dialog';
import { TeamMembersPanel } from '../../teams/components/team-members-panel';
import { EmptyState, PAGE_TITLE_CLASS, PageContainer, PageHeader } from '../../../components/common/page';
import { resolveEntityIcon } from '../../../components/entity-icon-picker';

function TeamsDirectory() {
  const query = useTeams();
  const [search, setSearch] = React.useState('');
  const [visibility, setVisibility] = React.useState('all');
  const [descending, setDescending] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const rows = (query.data || []).filter(team => team.name.toLowerCase().includes(search.toLowerCase().trim()) && (visibility === 'all' || team.isPrivate === (visibility === 'private'))).sort((a, b) => (descending ? -1 : 1) * a.name.localeCompare(b.name));
  return <PageContainer width="narrow" className="gap-8">
    <PageHeader title="Teams" count={query.data?.length} description="Manage teams and their members." />
    <div className="flex flex-wrap items-center gap-2"><Input type="search" aria-label="Filter teams by name" placeholder="Filter by name…" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-72" />
      <Select value={visibility} onValueChange={setVisibility}><SelectTrigger aria-label="Team visibility"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All visibility</SelectItem><SelectItem value="workspace">Workspace</SelectItem><SelectItem value="private">Private</SelectItem></SelectGroup></SelectContent></Select>
      <Button className="sm:ml-auto" onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />New team</Button>
    </div>
    {query.isPending ? <Skeleton className="h-48 w-full" /> : query.isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Could not load teams.</span><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : !rows.length ? <EmptyState icon={Users} title={query.data?.length ? 'No matching teams' : 'No teams yet'} description={query.data?.length ? 'Try another name or visibility.' : 'Create a team to manage its members.'} /> : <Table aria-label="Workspace teams" className="min-w-[760px] table-fixed">
      <TableHeader><TableRow><TableSortHead className="w-64" direction={descending ? 'desc' : 'asc'} onSort={() => setDescending(value => !value)} sortLabel="Sort teams by name">Name</TableSortHead><TableHead>Description</TableHead><TableHead className="w-28">Visibility</TableHead><TableHead className="w-24 text-right">Members</TableHead><TableHead className="w-20 text-right">Issues</TableHead><TableHead className="w-32">Created</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(team => {
        const Icon = resolveEntityIcon(team.icon);
        const created = new Date(team.createdAt);
        return <TableRow key={team.id}><TableCell><Link to={`/settings/teams/${team.id}`} className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Manage team ${team.name}`}><Icon className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 truncate font-medium">{team.name}</span><span className="font-mono text-xs text-muted-foreground">{team.key}</span></Link></TableCell><TableCell><span className="block truncate text-muted-foreground" title={team.description || undefined}>{team.description || 'No description'}</span></TableCell><TableCell>{team.isPrivate ? 'Private' : 'Workspace'}</TableCell><TableCell className="text-right tabular-nums">{team.memberCount ?? team.members?.length ?? 0}</TableCell><TableCell className="text-right tabular-nums">{team.issueCount ?? 0}</TableCell><TableCell className="text-muted-foreground">{Number.isNaN(created.getTime()) ? 'Not available' : created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell></TableRow>;
      })}</TableBody>
    </Table>}
    <p className="text-xs text-muted-foreground">Private teams are listed only when you are an explicit member. Open a team to manage its membership.</p>
    <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
  </PageContainer>;
}

function TeamAdministration({ id }: { id: string }) {
  const query = useTeam(id);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const team = query.data;
  return <PageContainer width="narrow">
    <Button variant="ghost" size="sm" asChild className="w-fit"><Link to="/settings/teams"><ArrowLeft data-icon="inline-start" />Back to teams</Link></Button>
    {query.isPending ? <Skeleton className="h-48 w-full" /> : query.isError || !team ? <Alert variant="destructive"><AlertDescription>Team unavailable. It may have been removed, or you may not have access. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : <>
      <header className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0"><h1 className={PAGE_TITLE_CLASS}>{team.name}</h1><div className="mt-2 flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{team.key}</span><Badge variant="outline">{team.isPrivate ? 'Private' : 'Workspace'}</Badge></div></div>{team.canManage && <div className="flex gap-2"><Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 data-icon="inline-start" />Team settings</Button><Button variant="outline" asChild><Link to={`/teams/${team.id}?tab=members`}>Open team</Link></Button></div>}</header>
      <TeamMembersPanel team={team} />
      <TeamSettingsDialog team={team} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>}
  </PageContainer>;
}

export function TeamsSettings() {
  const { teamId } = useParams();
  return teamId ? <TeamAdministration key={teamId} id={teamId} /> : <TeamsDirectory />;
}
