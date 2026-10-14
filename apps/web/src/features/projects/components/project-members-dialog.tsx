import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@reka/ui';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useUsers } from '../../users/hooks/use-users';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function ProjectMembersDialog({ projectId, projectName, open, onOpenChange }: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: isUsersLoading } = useUsers();
  const { data: members = [], isLoading: isMembersLoading, isError: isMembersError, refetch: refetchMembers } = useQuery<ProjectMember[]>({
    queryKey: ['projects', projectId, 'members'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error('Failed to load project members');
      return res.json();
    },
    enabled: open,
  });
  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.message || 'Failed to invite member');
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] });
      setSelectedUserId('');
      toast.success(result.added ? 'Member added to project' : 'User is already a project member');
    },
    onError: (error: Error) => toast.error('Could not add project member', { description: error.message }),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
      if (!res.ok) { const error = await res.json().catch(() => null); throw new Error(error?.message || 'Failed to remove member'); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'members'] }); toast.success('Project member removed'); },
    onError: (error: Error) => toast.error('Could not remove project member', { description: error.message }),
  });

  const memberIds = new Set(members.map((member) => member.id));
  const availableUsers = users.filter((user) => !memberIds.has(user.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project members</DialogTitle>
          <DialogDescription>Manage who can work on {projectName}.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger aria-label="Select user to invite">
                <SelectValue placeholder={isUsersLoading ? 'Loading users...' : 'Select a workspace user'} />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>{user.name} · {user.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!selectedUserId || addMember.isPending} onClick={() => addMember.mutate(selectedUserId)}>
              {addMember.isPending ? 'Adding...' : 'Add'}
            </Button>
          </div>
          <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {isMembersLoading ? (
              <p role="status" className="p-3 text-sm text-muted-foreground">Loading members...</p>
            ) : isMembersError ? (
              <div role="alert" className="flex items-center justify-between gap-2 p-3 text-sm"><span>Could not load project members.</span><Button variant="outline" size="sm" onClick={() => void refetchMembers()}><RefreshCw data-icon="inline-start" />Retry</Button></div>
            ) : members.length ? members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-2"><Badge variant="outline">{member.role}</Badge>{member.role !== 'owner' && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name} from project`} disabled={removeMember.isPending} onClick={() => removeMember.mutate(member.id)}><Trash2 /></Button>}</div>
              </div>
            )) : <p className="p-3 text-sm text-muted-foreground">No members yet.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
