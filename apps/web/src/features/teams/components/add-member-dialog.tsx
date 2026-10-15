import * as React from 'react';
import { Alert, AlertDescription, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Field, FieldGroup, FieldLabel, FieldDescription, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, Avatar, AvatarFallback, AvatarImage, Badge, Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, Skeleton } from '@reka/ui';
import { X } from 'lucide-react';
import { useAddTeamMember } from '../hooks/use-teams';
import { useUsers } from '../../users/hooks/use-users';
import { InviteUserDialog } from '../../users/components/invite-user-dialog';
import { useAuthStore } from '../../../stores/auth.store';
import type { User } from '../../users/api/users.api';

export function AddMemberDialog({ teamId, open, onOpenChange, existingMemberUserIds = [] }: {
  teamId: string; open: boolean; onOpenChange: (open: boolean) => void; existingMemberUserIds?: string[];
}) {
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [role, setRole] = React.useState('member');
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const workspaceRole = useAuthStore(state => state.user?.role);
  const canInvite = workspaceRole === 'owner' || workspaceRole === 'admin';
  const query = useUsers(false, open);
  const add = useAddTeamMember(teamId);
  React.useEffect(() => { if (open) { setSelectedUser(null); setRole('member'); add.reset(); } }, [open]);
  return <>
    <Dialog open={open} onOpenChange={next => { if (!add.isPending) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add team member</DialogTitle><DialogDescription>Choose someone already in this workspace. This does not change their workspace role.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel>Workspace member</FieldLabel>
            {selectedUser ? <div className="flex min-w-0 items-center gap-3 rounded-md border border-border p-3"><Avatar className="size-8 shrink-0"><AvatarImage src={selectedUser.avatarUrl || undefined} alt={selectedUser.name} /><AvatarFallback>{selectedUser.name[0]}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{selectedUser.name}</p><p className="truncate text-xs text-muted-foreground">{selectedUser.email}</p></div><Button variant="ghost" size="icon-sm" aria-label="Change selected member" disabled={add.isPending} onClick={() => setSelectedUser(null)}><X /></Button></div> : query.isPending ? <Skeleton className="h-40 w-full" /> : query.isError ? <Alert variant="destructive"><AlertDescription>Could not load workspace members. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : <Command label="Workspace member" className="rounded-md border border-border">
              <CommandInput autoFocus placeholder="Search name or email…" />
              <CommandList className="max-h-48"><CommandEmpty>No matching workspace members.</CommandEmpty><CommandGroup heading="Workspace members">{(query.data || []).map(user => {
                const existing = existingMemberUserIds.includes(user.id);
                return <CommandItem key={user.id} value={`${user.name} ${user.email}`} disabled={existing} onSelect={() => { setSelectedUser(user); setRole('member'); }}><Avatar className="size-7 shrink-0"><AvatarImage src={user.avatarUrl || undefined} alt={user.name} /><AvatarFallback>{user.name[0]}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate font-medium">{user.name}</p><p className="truncate text-muted-foreground">{user.email}</p></div>{existing && <Badge variant="outline">Already in team</Badge>}</CommandItem>;
              })}</CommandGroup></CommandList>
            </Command>}
          </Field>
          <Field><FieldLabel htmlFor="add-team-role">Team role</FieldLabel><Select value={role} onValueChange={setRole} disabled={add.isPending}><SelectTrigger id="add-team-role" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="lead" disabled={!['owner', 'admin', 'member'].includes(selectedUser?.role || '')}>Lead</SelectItem><SelectItem value="member">Member</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectGroup></SelectContent></Select><FieldDescription>{role === 'lead' ? 'Manages team settings and membership.' : role === 'member' ? 'Creates and updates issues in this team.' : 'Can view this team without changing its work.'} Workspace permissions still apply.</FieldDescription></Field>
        </FieldGroup>
        {add.isError && <Alert variant="destructive"><AlertDescription>{add.error.message}</AlertDescription></Alert>}
        <div className="flex flex-col items-start gap-1 border-t border-border pt-4"><p className="text-xs text-muted-foreground">Not in this workspace yet?</p>{canInvite ? <><Button variant="link" className="px-0" disabled={add.isPending} onClick={() => { onOpenChange(false); setInviteOpen(true); }}>Invite to workspace</Button><p className="text-xs text-muted-foreground">After they accept, add them to this team. The invitation does not grant team membership.</p></> : <p className="text-xs text-muted-foreground">Ask a workspace owner or admin to invite them first.</p>}</div>
        <DialogFooter><Button variant="outline" disabled={add.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!selectedUser || add.isPending || existingMemberUserIds.includes(selectedUser.id)} onClick={() => { if (selectedUser) add.mutate({ userId: selectedUser.id, role }, { onSuccess: () => onOpenChange(false) }); }}>{add.isPending ? 'Adding…' : 'Add member'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {canInvite && <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />}
  </>;
}
