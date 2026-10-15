import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, AlertDescription, Badge, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@reka/ui';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Settings2 } from 'lucide-react';
import { useTeam, useTeams } from '../../teams/hooks/use-teams';
import { CreateTeamDialog } from '../../teams/components/create-team-dialog';
import { AddMemberDialog } from '../../teams/components/add-member-dialog';
import { TeamSettingsDialog } from '../../teams/components/team-settings-dialog';
import { TeamMembersPanel } from '../../teams/components/team-members-panel';
import { resolveEntityIcon } from '../../../components/entity-icon-picker';

function TeamsDirectory() {
  const query = useTeams();
  const [search, setSearch] = React.useState('');
  const [visibility, setVisibility] = React.useState('all');
  const [descending, setDescending] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const rows = (query.data || []).filter(team => team.name.toLowerCase().includes(search.toLowerCase().trim()) && (visibility === 'all' || team.isPrivate === (visibility === 'private'))).sort((a, b) => (descending ? -1 : 1) * a.name.localeCompare(b.name));
  return <div className="flex min-w-0 flex-col gap-5 pb-10">
    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Teams</h1>
    <div className="flex flex-wrap items-center gap-2"><Input type="search" aria-label="Filter teams by name" placeholder="Filter by name…" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-72" />
      <Select value={visibility} onValueChange={setVisibility}><SelectTrigger aria-label="Team visibility"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All visibility</SelectItem><SelectItem value="workspace">Workspace</SelectItem><SelectItem value="private">Private</SelectItem></SelectGroup></SelectContent></Select>
      <Button className="sm:ml-auto" onClick={() => setCreateOpen(true)}><Plus data-icon="inline-start" />Create team</Button>
    </div>
    {query.isPending ? <Skeleton className="h-48 w-full" /> : query.isError ? <Alert variant="destructive"><AlertDescription>Could not load teams. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : <Table aria-label="Workspace teams" className="min-w-[760px]">
      <TableHeader><TableRow><TableHead aria-sort={descending ? 'descending' : 'ascending'}><Button variant="ghost" size="sm" className="-ml-2" aria-label="Sort teams by name" onClick={() => setDescending(value => !value)}>Name{descending ? <ArrowDown data-icon="inline-end" /> : <ArrowUp data-icon="inline-end" />}</Button></TableHead><TableHead>Description</TableHead><TableHead>Visibility</TableHead><TableHead>Members</TableHead><TableHead>Issues</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(team => {
        const Icon = resolveEntityIcon(team.icon);
        const created = new Date(team.createdAt);
        return <TableRow key={team.id}><TableCell className="py-4"><Link to={`/settings/teams/${team.id}`} className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Manage team ${team.name}`}><Icon className="size-4 shrink-0 text-muted-foreground" /><span className="max-w-64 truncate font-medium">{team.name}</span><span className="font-mono text-xs text-muted-foreground">{team.key}</span></Link></TableCell><TableCell><span className="block max-w-72 truncate text-muted-foreground" title={team.description || undefined}>{team.description || 'No description'}</span></TableCell><TableCell>{team.isPrivate ? 'Private' : 'Workspace'}</TableCell><TableCell className="tabular-nums">{team.memberCount ?? team.members?.length ?? 0}</TableCell><TableCell className="tabular-nums">{team.issueCount ?? 0}</TableCell><TableCell className="text-muted-foreground">{Number.isNaN(created.getTime()) ? 'Not available' : created.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell></TableRow>;
      })}{!rows.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">{query.data?.length ? 'No matching teams. Try another name or visibility.' : 'No teams yet. Create a team to manage its members.'}</TableCell></TableRow>}</TableBody>
    </Table>}
    <p className="text-xs text-muted-foreground">Private teams are listed only when you are an explicit member. Open a team to manage its membership.</p>
    <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
  </div>;
}

function TeamAdministration({ id }: { id: string }) {
  const query = useTeam(id);
  const [addOpen, setAddOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const team = query.data;
  return <div className="flex min-w-0 max-w-4xl flex-col gap-6 pb-10">
    <Button variant="ghost" size="sm" asChild className="w-fit"><Link to="/settings/teams"><ArrowLeft data-icon="inline-start" />Back to teams</Link></Button>
    {query.isPending ? <Skeleton className="h-48 w-full" /> : query.isError || !team ? <Alert variant="destructive"><AlertDescription>Team unavailable. It may have been removed, or you may not have access. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div className="min-w-0"><h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{team.name}</h1><div className="mt-2 flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{team.key}</span><Badge variant="outline">{team.isPrivate ? 'Private' : 'Workspace'}</Badge></div></div>{team.canManage && <div className="flex gap-2"><Button variant="outline" onClick={() => setSettingsOpen(true)}><Settings2 data-icon="inline-start" />Team settings</Button><Button onClick={() => setAddOpen(true)}><Plus data-icon="inline-start" />Add member</Button></div>}</header>
      <div><h2 className="text-sm font-medium">Members ({team.members?.length ?? 0})</h2><p className="mt-1 text-sm text-muted-foreground">Team roles control access within this team. They do not change workspace roles.</p></div>
      <TeamMembersPanel team={team} />
      <AddMemberDialog teamId={team.id} open={addOpen} onOpenChange={setAddOpen} existingMemberUserIds={team.members?.map(member => member.userId)} />
      <TeamSettingsDialog team={team} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>}
  </div>;
}

export function TeamsSettings() {
  const { teamId } = useParams();
  return teamId ? <TeamAdministration key={teamId} id={teamId} /> : <TeamsDirectory />;
}
