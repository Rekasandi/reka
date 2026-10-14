import * as React from 'react';
import {
  Badge,
  Button,
  Skeleton,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@reka/ui';
import { UserPlus, Shield, CheckSquare, Users, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { useUsers, useUpdateUser, useDeleteUser } from '../hooks/use-users';
import { CreateUserDialog } from './create-user-dialog';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { User } from '../api/users.api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { InviteUserDialog } from './invite-user-dialog';
import { getWorkspace, updateWorkspaceMember, WORKSPACE_QUERY_KEY } from '../../settings/api/workspace.api';
import { USERS_QUERY_KEY } from '../hooks/use-users';
import { useAuthStore } from '../../../stores/auth.store';

function RoleBadge({ role }: { role: User['role'] }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    owner: { label: 'Owner', variant: 'default' },
    admin: { label: 'Admin', variant: 'default' },
    member: { label: 'Member', variant: 'secondary' },
    guest: { label: 'Guest · read-only', variant: 'outline' },
    client: { label: 'Client · read-only', variant: 'outline' },
  };

  const item = map[role] || { label: role, variant: 'secondary' };
  return (
    <Badge variant={item.variant} className="capitalize text-xs font-mono h-5 px-2 font-normal">
      {(role === 'owner' || role === 'admin') && <Shield className="size-2.5 mr-1" />}
      <span>{item.label}</span>
    </Badge>
  );
}

export function UsersPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = React.useState<User | null>(null);
  const [filterRole, setFilterRole] = React.useState('all');

  const queryClient = useQueryClient();
  const workspace = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  const actorIsOwner = workspace.data?.role === 'owner';
  const canManage = actorIsOwner || workspace.data?.role === 'admin';
  const { data: users = [], isLoading, isError, refetch } = useUsers(canManage);
  const activate = useMutation({ mutationFn: (id: string) => updateWorkspaceMember(id, { isActive: true }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY }); toast.success('User reactivated'); }, onError: error => toast.error(error.message) });
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'admin', label: 'Admins' },
    { id: 'member', label: 'Members' },
    { id: 'client', label: 'Read-only' },
  ];

  const filteredUsers = React.useMemo(() => {
    if (filterRole === 'all') return users;
    if (filterRole === 'admin') return users.filter((u) => u.role === 'admin' || u.role === 'owner');
    if (filterRole === 'client') return users.filter((u) => u.role === 'client' || u.role === 'guest');
    return users.filter((u) => u.role === filterRole);
  }, [users, filterRole]);

  const handleDelete = (u: User, e: React.MouseEvent) => {
    e.stopPropagation();
    if (u.role === 'owner') {
      return;
    }
    setDeleteTargetUser(u);
  };

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Workspace Users</h1>
            <Badge variant="outline" className="font-mono text-xs font-medium">
              {users.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage members and workspace access.
          </p>
        </div>

        {canManage && <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => setIsCreateOpen(true)}>Add record</Button><Button onClick={() => setIsInviteOpen(true)}><UserPlus data-icon="inline-start" /><span>Invite User</span></Button></div>}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-2">
        {filterOptions.map((opt) => {
          const isSelected = filterRole === opt.id;
          return (
            <Button
              key={opt.id}
              type="button"
              variant="category"
              size="sm"
              aria-pressed={isSelected}
              onClick={() => setFilterRole(opt.id)}
            >
              <span>{opt.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load users from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Users Table / List View */}
      {!isLoading && !isError && (
        <div className="divide-y divide-border">
          {filteredUsers.map((u) => {
            const initial = (u.name || 'User')[0].toUpperCase();

            return (
              <div
                key={u.id}
                className="group flex flex-col items-stretch justify-between gap-3 rounded-md px-3 py-4 text-xs transition-colors hover:bg-muted/50 sm:flex-row sm:items-center"
              >
                {/* User info */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <Avatar className="size-8 rounded-full border border-border/70 shrink-0">
                    {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                    <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                      {initial}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate text-sm">
                        {u.name}
                      </span>
                      {u.role === 'owner' && <RoleBadge role={u.role} />}
                      {u.isActive === false && <Badge variant="outline">{u.admission === 'pending' ? 'Not joined' : 'Inactive'}</Badge>}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-xs">
                      <span className="truncate text-muted-foreground">{u.email}</span>
                      {u.githubUsername && (
                        <a
                          href={`https://github.com/${encodeURIComponent(u.githubUsername)}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`GitHub profile for ${u.name}`}
                          className="inline-flex shrink-0 items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          <ExternalLink className="size-3" />
                          <span>{u.githubUsername}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats & Actions */}
                <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-6">
                  <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <div className="flex items-center gap-1.5" title="Assigned issues">
                      <CheckSquare className="size-3.5 text-muted-foreground/60" />
                      <span>{u.assignedIssuesCount || 0} issues</span>
                    </div>

                    <div className="flex items-center gap-1.5" title="Teams">
                      <Users className="size-3.5 text-muted-foreground/60" />
                      <span>{u.teamsCount || 0} teams</span>
                    </div>
                  </div>

                  {/* Change Role Select */}
                  {canManage && (u.role !== 'owner' || actorIsOwner) ? (
                    <Select
                      disabled={updateMutation.isPending}
                      value={u.role}
                      onValueChange={(val) => updateMutation.mutate({ id: u.id, data: { role: val } })}
                    >
                      <SelectTrigger aria-label={`Role for ${u.name}`} size="sm" className="w-28 bg-background/80 border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {actorIsOwner && <SelectItem value="owner" disabled={u.admission === 'pending'}>Owner</SelectItem>}
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="guest">Guest · read-only</SelectItem>
                          <SelectItem value="client">Client · read-only</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  ) : u.role !== 'owner' ? <RoleBadge role={u.role} /> : null}

                  {canManage && u.isActive === false && (u.role !== 'owner' || actorIsOwner) && <Button variant="outline" size="sm" disabled={activate.isPending || u.admission === 'pending'} title={u.admission === 'pending' ? 'Send an invitation before granting access' : undefined} onClick={() => activate.mutate(u.id)}>Reactivate</Button>}
                  {/* Deactivation preserves authored work. */}
                  {canManage && u.isActive !== false && u.role !== 'owner' ? (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(u, e)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title="Deactivate user"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : (
                    <div className="w-5" />
                  )}
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No users found matching this filter.
            </div>
          )}
        </div>
      )}

      <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      {/* Existing manual profile creation stays available, without granting access. */}
      <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Delete User Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTargetUser}
        onOpenChange={(open) => !open && setDeleteTargetUser(null)}
        title={`Deactivate "${deleteTargetUser?.name}"?`}
        description="This revokes workspace access. Authored work and issue assignments are preserved."
        onConfirm={() => {
          if (deleteTargetUser) {
            deleteMutation.mutate(deleteTargetUser.id, { onSuccess: async () => { if (useAuthStore.getState().user?.id === deleteTargetUser.id) await useAuthStore.getState().logout(); } });
            setDeleteTargetUser(null);
          }
        }}
      />
    </div>
  );
}
