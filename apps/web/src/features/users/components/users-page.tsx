import * as React from 'react';
import { Alert, Button, Skeleton, Avatar, AvatarImage, AvatarFallback, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, cn } from '@reka/ui';
import { UserPlus, Trash2, RefreshCw, Contact } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { useUsers, useUpdateUser, useDeleteUser } from '../hooks/use-users';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { User } from '../api/users.api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { RolePicker } from './role-picker';
import { InviteUserDialog } from './invite-user-dialog';
import { getWorkspace, updateWorkspaceMember, WORKSPACE_QUERY_KEY } from '../../settings/api/workspace.api';
import { USERS_QUERY_KEY } from '../hooks/use-users';
import { useAuth, useLogout } from '../../auth/hooks/use-auth';
import { EmptyState, PageContainer, PageHeader } from '../../../components/common/page';

const AVATAR_BG_COLORS = [
  'bg-pink-600 text-white',
  'bg-info text-white',
  'bg-success text-white',
  'bg-highlight text-white',
  'bg-warning text-white',
  'bg-info text-white',
];

function getAvatarBg(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

function formatLastSeen(val?: string | null): { label: string; title?: string } {
  if (!val) return { label: 'Never' };
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return { label: 'Never' };
  return { label: formatDistanceToNowStrict(d, { addSuffix: true }), title: format(d, 'MMM d, yyyy · HH:mm') };
}

function formatDateLabel(val?: string | null): string {
  if (!val) return 'No date';
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return 'No date';
    return format(d, 'MMM dd');
  } catch {
    return 'No date';
  }
}

export function UsersPage({ title = 'Users' }: { title?: string }) {
  const { user: currentUser } = useAuth();
  const logout = useLogout();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = React.useState<User | null>(null);
  const [filterRole, setFilterRole] = React.useState('all');

  const queryClient = useQueryClient();
  const workspace = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  const actorIsOwner = workspace.data?.role === 'owner';
  const canManage = actorIsOwner || workspace.data?.role === 'admin';
  const { data: users = [], isLoading, isError, refetch } = useUsers(canManage);
  const activeOwnerCount = users.filter(person => person.role === 'owner' && person.isActive !== false).length;
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
    <PageContainer>
      <PageHeader title={title} count={users.length} description="Manage members and workspace access."
        actions={canManage && <Button onClick={() => setIsInviteOpen(true)}><UserPlus data-icon="inline-start" />Invite member</Button>} />

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
        <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
          <span>Could not load users.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
        </Alert>
      )}

      {/* Users Table */}
      {!isLoading && !isError && (filteredUsers.length === 0 ? (
        <EmptyState icon={Contact} title="No users match this filter" description="Choose another role filter to see more members." />
      ) : (
          <Table aria-label="Workspace users" className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Role</TableHead>
                <TableHead className="w-32">Joined</TableHead>
                <TableHead className="w-40">Teams</TableHead>
                <TableHead className="w-32">Last seen</TableHead>
                {canManage && <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const name = u.name?.trim() || u.email?.split('@')[0] || 'Member';
                const names = name.split(/\s+/);
                const initial = names.length >= 2 ? (names[0][0] + names[1][0]).toUpperCase() : (name[0] || 'U').toUpperCase();
                const avatarBg = getAvatarBg(name);
                const joined = formatDateLabel(u.createdAt);
                const isCurrent = currentUser?.id === u.id;
                const lastSeen = formatLastSeen(u.lastSeenAt);
                const lastActiveOwner = u.role === 'owner' && activeOwnerCount <= 1;

                return (
                  <TableRow key={u.id}>
                    {/* Name column */}
                    <TableCell>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8 rounded-full shrink-0 border border-border/60">
                          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={name} />}
                          <AvatarFallback className={cn('text-xs font-semibold', avatarBg)}>
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 leading-tight gap-0.5">
                          <span className="truncate font-medium text-foreground">{name}</span>
                          {u.githubUsername ? (
                            <a
                              href={`https://github.com/${encodeURIComponent(u.githubUsername)}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`GitHub profile for ${u.name}`}
                              className="text-xs text-muted-foreground hover:text-foreground hover:underline font-mono truncate block"
                            >
                              {u.githubUsername}
                            </a>
                          ) : (
                            <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Role column */}
                    <TableCell>
                      <RolePicker role={u.role} name={u.name || name} allowOwner={actorIsOwner} disabled={updateMutation.isPending}
                        onRoleChange={canManage && (u.role !== 'owner' || actorIsOwner) ? role => updateMutation.mutate({ id: u.id, data: { role } }) : undefined} />
                    </TableCell>

                    {/* Joined column */}
                    <TableCell className="text-muted-foreground tabular-nums">
                      {joined}
                    </TableCell>

                    {/* Teams column */}
                    <TableCell>
                      {u.teams && u.teams.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {u.teams.map((t) => (
                            <span key={t.id} className="inline-flex items-center gap-1.5 font-mono text-foreground" title={t.name}>
                              <Contact className="size-3.5 text-muted-foreground" />
                              <span>{t.key}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No teams</span>
                      )}
                    </TableCell>

                    {/* Last seen column */}
                    <TableCell>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-success">
                            <span className="size-1.5 rounded-full bg-success" />
                            Online
                          </span>
                        ) : (
                          <span className="text-muted-foreground" title={lastSeen.title}>
                            {lastSeen.label}
                          </span>
                        )}
                    </TableCell>

                    {/* Actions column */}
                    {canManage && <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canManage && u.isActive === false && (u.role !== 'owner' || actorIsOwner) && (
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={activate.isPending}
                              onClick={() => activate.mutate(u.id)}
                            >
                              Reactivate
                            </Button>
                          )}
                          {canManage && u.isActive !== false && (u.role !== 'owner' || actorIsOwner) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              type="button"
                              disabled={lastActiveOwner}
                              onClick={(e) => handleDelete(u, e)}
                              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Deactivate ${name}`}
                              title={lastActiveOwner ? 'The last active owner cannot be deactivated' : 'Deactivate user'}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                    </TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      ))}

      <InviteUserDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />

      {/* Delete User Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteTargetUser}
        onOpenChange={(open) => !open && setDeleteTargetUser(null)}
        title={`Deactivate "${deleteTargetUser?.name}"?`}
        description="This revokes workspace access. Authored work and issue assignments are preserved."
        onConfirm={() => {
          if (deleteTargetUser) {
            deleteMutation.mutate(deleteTargetUser.id, { onSuccess: async () => { if (currentUser?.id === deleteTargetUser.id) await logout.mutateAsync(); } });
            setDeleteTargetUser(null);
          }
        }}
      />
    </PageContainer>
  );
}
