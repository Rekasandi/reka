import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, Avatar, AvatarFallback, AvatarImage, Badge, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@reka/ui';
import { MoreHorizontal, Plus } from 'lucide-react';
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
  return <section aria-label="Team members" className="flex min-w-0 max-w-4xl flex-col gap-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-medium">Members ({members.length})</h2><p className="mt-1 text-sm text-muted-foreground">Team roles do not change workspace roles.</p></div>{team.canManage && <Button onClick={() => setAddOpen(true)}><Plus data-icon="inline-start" />Add member</Button>}</header>
    <Input type="search" aria-label="Search team members" placeholder="Search members…" value={search} onChange={event => setSearch(event.target.value)} className="sm:max-w-sm" />
    <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">Lead manages the team and its members. Member creates and updates issues. Viewer has read-only access. Workspace permissions still apply.</p>
    {(remove.isError || update.isError) && <Alert variant="destructive"><AlertDescription>{remove.error?.message || update.error?.message}</AlertDescription></Alert>}
    <ul className="divide-y divide-border">{filtered.map(member => {
      const name = member.user?.name || 'Unknown member';
      const self = member.userId === team.currentMemberUserId;
      const lastLead = member.role === 'lead' && writable(member) && leadCount <= 1;
      const noticeId = `last-lead-${member.userId}`;
      return <li key={member.userId} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3"><Avatar className="size-8 shrink-0"><AvatarImage src={member.user?.avatarUrl || undefined} alt={name} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-medium">{name}{self && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}</p><p className="truncate text-xs text-muted-foreground" title={member.user?.email}>{member.user?.email || 'Email unavailable'}</p>{lastLead && team.canManage && <p id={noticeId} className="mt-2 max-w-prose text-xs text-muted-foreground">Add another lead before changing or removing this lead.</p>}</div></div>
        <div className="flex shrink-0 items-center gap-3">{team.canManage ? <Select value={member.role} disabled={pending || lastLead} onValueChange={role => update.mutate({ userId: member.userId, role: role as TeamMember['role'] })}>
          <SelectTrigger aria-label={`Team role for ${name}`} aria-describedby={lastLead ? noticeId : undefined} size="sm" className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="lead" disabled={!writable(member)}>Lead</SelectItem><SelectItem value="member">Member</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectGroup></SelectContent>
        </Select> : <Badge variant="secondary" className="capitalize">{member.role}</Badge>}
        {(team.canManage || (self && team.canLeave)) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Member actions for ${name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup><DropdownMenuItem variant="destructive" disabled={pending || lastLead} onSelect={() => setTarget(member)}>{self ? 'Leave team' : 'Remove member'}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>}</div>
      </li>;
    })}</ul>
    {!filtered.length && <p className="py-6 text-sm text-muted-foreground">{members.length ? 'No members match your search.' : 'No members yet. Add a workspace member to start working together.'}</p>}
    {search && <p role="status" className="text-xs text-muted-foreground">Showing {filtered.length} of {members.length} members.</p>}
    {team.canManage && <AddMemberDialog teamId={team.id} open={addOpen} onOpenChange={setAddOpen} existingMemberUserIds={members.map(member => member.userId)} />}
    <ConfirmDeleteDialog open={!!target} onOpenChange={open => { if (!open) setTarget(null); }} title={target?.userId === team.currentMemberUserId ? 'Leave this team?' : `Remove ${target?.user?.name || 'member'}?`} description="This removes team membership, not the workspace account. Private-team access is revoked. The last writable lead cannot be removed." confirmLabel={target?.userId === team.currentMemberUserId ? 'Leave team' : 'Remove member'} onConfirm={() => { if (target) remove.mutate(target.userId, { onSuccess: () => { if (target.userId === team.currentMemberUserId) navigate(pathname.startsWith('/settings/') ? '/settings/teams' : '/teams'); } }); }} />
  </section>;
}
