import * as React from 'react';
import { Alert, AlertDescription, Avatar, AvatarFallback, AvatarImage, Badge, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@reka/ui';
import { LogOut, Trash2 } from 'lucide-react';
import { useRemoveTeamMember, useUpdateTeamMember } from '../hooks/use-teams';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { Team, TeamMember } from '../api/teams.api';

export function TeamMembersPanel({ team }: { team: Team }) {
  const remove = useRemoveTeamMember(team.id);
  const update = useUpdateTeamMember(team.id);
  const [target, setTarget] = React.useState<TeamMember | null>(null);
  const pending = remove.isPending || update.isPending;
  return <section aria-label="Team members" className="flex min-w-0 flex-col gap-4">
    {(remove.isError || update.isError) && <Alert variant="destructive"><AlertDescription>{remove.error?.message || update.error?.message}</AlertDescription></Alert>}
    <ul className="divide-y divide-border">{(team.members || []).map(member => {
      const name = member.user?.name || 'Unknown member';
      const self = member.userId === team.currentMemberUserId;
      return <li key={member.userId} className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3"><Avatar className="size-8 shrink-0"><AvatarImage src={member.user?.avatarUrl || undefined} alt={name} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground" title={member.user?.email}>{member.user?.email || 'Email unavailable'}</p></div></div>
        <div className="flex shrink-0 items-center gap-3">{team.canManage ? <Select value={member.role} disabled={pending} onValueChange={role => update.mutate({ userId: member.userId, role: role as TeamMember['role'] })}>
          <SelectTrigger aria-label={`Team role for ${name}`} size="sm" className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="lead">Lead</SelectItem><SelectItem value="member">Member</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectGroup></SelectContent>
        </Select> : <Badge variant="secondary" className="capitalize">{member.role}</Badge>}
        {(team.canManage || (self && team.canLeave)) && <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={self ? 'Leave team' : `Remove ${name}`} onClick={() => setTarget(member)}>{self ? <LogOut /> : <Trash2 />}</Button>}</div>
      </li>;
    })}</ul>
    {!team.members?.length && <p className="py-6 text-sm text-muted-foreground">No members found in this team.</p>}
    <ConfirmDeleteDialog open={!!target} onOpenChange={open => { if (!open) setTarget(null); }} title={target?.userId === team.currentMemberUserId ? 'Leave this team?' : `Remove ${target?.user?.name || 'member'}?`} description="This removes team membership, not the workspace account. Private-team access is revoked. The last writable lead cannot be removed." confirmLabel={target?.userId === team.currentMemberUserId ? 'Leave team' : 'Remove member'} onConfirm={() => { if (target) remove.mutate(target.userId); }} />
  </section>;
}
