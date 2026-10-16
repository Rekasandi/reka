import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, Avatar, AvatarFallback, AvatarImage, Badge, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, Popover, PopoverTrigger, PopoverContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@reka/ui';
import { Info, MoreHorizontal, Plus } from 'lucide-react';
import { useRemoveTeamMember, useUpdateTeamMember } from '../hooks/use-teams';
import { AddMemberDialog } from './add-member-dialog';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { Team, TeamMember } from '../api/teams.api';

export function TeamMembersPanel({ team }: { team: Team }) {
  const remove = useRemoveTeamMember(team.id);
  const update = useUpdateTeamMember(team.id);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [target, setTarget] = React.useState<TeamMember | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const pending = remove.isPending || update.isPending;
  const members = team.members || [];
  const writable = (member: TeamMember) => !member.user?.role || ['owner', 'admin', 'member'].includes(member.user.role);
  const leadCount = members.filter(member => member.role === 'lead' && writable(member)).length;
  const filtered = members.filter(member => `${member.user?.name || ''} ${member.user?.email || ''}`.toLowerCase().includes(search.toLowerCase().trim()));
  const hasActions = !!team.canManage || !!team.canLeave;
  const hasLastLead = team.canManage && members.some(member => member.role === 'lead' && writable(member) && leadCount <= 1);
  const noticeId = `last-lead-${team.id}`;

  return <section aria-label="Team members" className="@container/team-members flex w-full min-w-0 flex-col gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold tracking-[-0.02em]">Members</h2><Badge variant="outline" className="tabular-nums">{members.length}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Team roles do not change workspace roles.</p></div>
      {team.canManage && <Button onClick={() => setAddOpen(true)}><Plus data-icon="inline-start" />Add member</Button>}
    </header>
    <div className="flex flex-wrap items-center gap-2">
      <Input type="search" aria-label="Search team members" placeholder="Search by name or email…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 sm:max-w-xs" />
      <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" aria-label="About team roles"><Info data-icon="inline-start" />Team roles</Button></PopoverTrigger><PopoverContent aria-label="About team roles" className="w-72 max-w-[calc(100vw-2rem)] p-4"><dl className="flex flex-col gap-3 text-sm"><div><dt className="font-medium">Lead</dt><dd className="text-xs text-muted-foreground">Manages the team and its members.</dd></div><div><dt className="font-medium">Member</dt><dd className="text-xs text-muted-foreground">Creates and updates issues.</dd></div><div><dt className="font-medium">Viewer</dt><dd className="text-xs text-muted-foreground">Has read-only access.</dd></div></dl><p className="mt-4 text-xs text-muted-foreground">Workspace permissions still apply.</p></PopoverContent></Popover>
    </div>
    {(remove.isError || update.isError) && <Alert variant="destructive"><AlertDescription>{remove.error?.message || update.error?.message}</AlertDescription></Alert>}
    <Table aria-label="Team members" className="table-fixed">
      <TableHeader><TableRow><TableHead>Member</TableHead><TableHead className="hidden w-36 @min-[40rem]/team-members:table-cell">Workspace role</TableHead><TableHead className="w-24 @min-[40rem]/team-members:w-36">Team role</TableHead>{hasActions && <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>}</TableRow></TableHeader>
      <TableBody>{filtered.map(member => {
        const name = member.user?.name || 'Unknown member';
        const self = member.userId === team.currentMemberUserId;
        const lastLead = member.role === 'lead' && writable(member) && leadCount <= 1;
        return <TableRow key={member.userId} data-team-member={member.userId}>
          <TableCell className="py-3"><div className="flex min-w-0 items-center gap-3"><Avatar className="size-8 shrink-0"><AvatarImage src={member.user?.avatarUrl || undefined} alt={name} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-medium" title={name}>{name}{self && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}</p><p className="truncate text-xs text-muted-foreground" title={member.user?.email}>{member.user?.email || 'Email unavailable'}</p><p className="text-xs text-muted-foreground @min-[40rem]/team-members:hidden">{member.user?.role ? <><span className="capitalize">{member.user.role}</span> in workspace</> : 'Workspace role unavailable'}</p></div></div></TableCell>
          <TableCell className="hidden capitalize text-muted-foreground @min-[40rem]/team-members:table-cell">{member.user?.role || 'Not available'}</TableCell>
          <TableCell>{team.canManage ? <Select value={member.role} disabled={pending || lastLead} onValueChange={role => update.mutate({ userId: member.userId, role: role as TeamMember['role'] })}>
            <SelectTrigger aria-label={`Team role for ${name}`} aria-describedby={lastLead ? noticeId : undefined} size="sm" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="lead" disabled={!writable(member)}>Lead</SelectItem><SelectItem value="member">Member</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectGroup></SelectContent>
          </Select> : <Badge variant="secondary" className="capitalize">{member.role}</Badge>}</TableCell>
          {hasActions && <TableCell className="px-1">{(team.canManage || (self && team.canLeave)) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Member actions for ${name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem variant="destructive" disabled={pending || lastLead} onSelect={() => setTarget(member)}>{self ? 'Leave team' : 'Remove member'}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}</TableCell>}
        </TableRow>;
      })}{!filtered.length && <TableRow><TableCell colSpan={hasActions ? 3 : 2} className="py-10 text-center text-muted-foreground @min-[40rem]/team-members:hidden">{members.length ? 'No members match your search.' : 'No members yet. Add a workspace member to start working together.'}</TableCell><TableCell colSpan={hasActions ? 4 : 3} className="hidden py-10 text-center text-muted-foreground @min-[40rem]/team-members:table-cell">{members.length ? 'No members match your search.' : 'No members yet. Add a workspace member to start working together.'}</TableCell></TableRow>}</TableBody>
    </Table>
    {hasLastLead && <p id={noticeId} className="flex items-start gap-2 text-xs text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />Add another lead before changing or removing this lead.</p>}
    {search && <p role="status" className="text-xs text-muted-foreground">Showing {filtered.length} of {members.length} members.</p>}
    {team.canManage && <AddMemberDialog teamId={team.id} open={addOpen} onOpenChange={setAddOpen} existingMemberUserIds={members.map(member => member.userId)} />}
    <ConfirmDeleteDialog open={!!target} onOpenChange={open => { if (!open) setTarget(null); }} title={target?.userId === team.currentMemberUserId ? 'Leave this team?' : `Remove ${target?.user?.name || 'member'}?`} description="This removes team membership, not the workspace account. Private-team access is revoked. The last writable lead cannot be removed." confirmLabel={target?.userId === team.currentMemberUserId ? 'Leave team' : 'Remove member'} onConfirm={() => { if (target) remove.mutate(target.userId, { onSuccess: () => { if (target.userId === team.currentMemberUserId) navigate(pathname.startsWith('/settings/') ? '/settings/teams' : '/teams'); } }); }} />
  </section>;
}
