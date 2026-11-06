import * as React from 'react';
import { Badge, Button, Skeleton, Avatar, AvatarImage, AvatarFallback, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, cn } from '@reka/ui';
import { UserPlus, Trash2, RefreshCw, ArrowDown, Contact } from 'lucide-react';
import { format } from 'date-fns';
import { useUsers, useUpdateUser, useDeleteUser } from '../hooks/use-users';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { User } from '../api/users.api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { InviteUserDialog } from './invite-user-dialog';
import { getWorkspace, updateWorkspaceMember, WORKSPACE_QUERY_KEY } from '../../settings/api/workspace.api';
import { USERS_QUERY_KEY } from '../hooks/use-users';
import { useAuth, useLogout } from '../../auth/hooks/use-auth';

const AVATAR_BG_COLORS = [
  'bg-pink-600 text-white',
  'bg-sky-600 text-white',
  'bg-emerald-600 text-white',
  'bg-purple-600 text-white',
  'bg-amber-600 text-white',
  'bg-indigo-600 text-white',
];

function getAvatarBg(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
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

export function UsersPage() {
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
    <div className="flex flex-col gap-5 w-full selection:bg-foreground selection:text-background pb-10">
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

        {canManage && <div className="flex flex-wrap justify-end gap-2"><Button onClick={() => setIsInviteOpen(true)}><UserPlus data-icon="inline-start" /><span>Invite User</span></Button></div>}
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

      {/* Users Table */}
      {!isLoading && !isError && (
        <div className="overflow-x-auto">
          <Table aria-label="Workspace users" className="w-full text-xs">
            <TableHeader className="text-muted-foreground border-0 [&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className="w-[36%] py-3 font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    Name <ArrowDown className="size-3 text-muted-foreground" />
                  </span>
                </TableHead>
                <TableHead className="w-[16%] py-3 font-medium text-muted-foreground">Role</TableHead>
                <TableHead className="w-[14%] py-3 font-medium text-muted-foreground">Joined</TableHead>
                <TableHead className="w-[14%] py-3 font-medium text-muted-foreground">Teams</TableHead>
                <TableHead className="w-[20%] py-3 font-medium text-muted-foreground">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border-0 [&_tr]:border-0">
              {filteredUsers.map((u) => {
                const name = u.name?.trim() || u.email?.split('@')[0] || 'Member';
                const names = name.split(/\s+/);
                const initial = names.length >= 2 ? (names[0][0] + names[1][0]).toUpperCase() : (name[0] || 'U').toUpperCase();
                const avatarBg = getAvatarBg(name);
                const joined = formatDateLabel(u.createdAt);
                const isCurrent = currentUser?.id === u.id;
                const lastSeen = isCurrent ? 'Online' : formatDateLabel(u.updatedAt || u.createdAt);

                return (
                  <TableRow key={u.id} className="h-14 border-0 hover:bg-muted/30 transition-colors">
                    {/* Name column */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="size-8 rounded-full shrink-0 border border-border/60">
                          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={name} />}
                          <AvatarFallback className={cn('text-xs font-semibold', avatarBg)}>
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 leading-tight gap-0.5">
                          <span className="font-medium text-sm text-foreground truncate">{name}</span>
                          {u.githubUsername ? (
                            <a
                              href={`https://github.com/${encodeURIComponent(u.githubUsername)}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`GitHub profile for ${u.name}`}
                              className="text-xs text-muted-foreground/70 hover:text-foreground hover:underline font-mono truncate block"
                            >
                              {u.githubUsername}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 truncate font-mono">{u.email}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Role column */}
                    <TableCell className="py-2.5">
                      {canManage && (u.role !== 'owner' || actorIsOwner) ? (
                        <Select
                          disabled={updateMutation.isPending}
                          value={u.role}
                          onValueChange={(val) => updateMutation.mutate({ id: u.id, data: { role: val } })}
                        >
                          <SelectTrigger
                            aria-label={`Role for ${u.name}`}
                            size="compact"
                            className={cn(
                              'h-6 w-auto px-2 py-0 rounded-md border text-xs font-medium cursor-pointer transition-colors',
                              u.role === 'admin'
                                ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25'
                                : u.role === 'owner'
                                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25'
                                  : 'bg-secondary text-secondary-foreground border-border/80 hover:bg-muted'
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {actorIsOwner && <SelectItem value="owner">Owner</SelectItem>}
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="guest">Guest · read-only</SelectItem>
                              <SelectItem value="client">Client · read-only</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={cn(
                          'inline-flex h-6 items-center px-2 py-0 rounded-md border text-xs font-medium',
                          u.role === 'admin'
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                            : u.role === 'owner'
                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                              : 'bg-secondary text-secondary-foreground border-border/80'
                        )}>
                          {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      )}
                    </TableCell>

                    {/* Joined column */}
                    <TableCell className="py-2.5 text-muted-foreground text-xs font-mono">
                      {joined}
                    </TableCell>

                    {/* Teams column */}
                    <TableCell className="py-2.5">
                      {u.teams && u.teams.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {u.teams.map((t) => (
                            <span key={t.id} className="inline-flex items-center gap-1.5 text-xs text-foreground font-mono" title={t.name}>
                              <Contact className="size-3.5 text-muted-foreground" />
                              <span>{t.key}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No teams</span>
                      )}
                    </TableCell>

                    {/* Last seen & Actions column */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium font-mono">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">
                            {lastSeen}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {canManage && u.isActive === false && (u.role !== 'owner' || actorIsOwner) && (
                            <Button
                              variant="outline"
                              size="xs"
                              disabled={activate.isPending}
                              onClick={() => activate.mutate(u.id)}
                              className="h-6 text-[10px]"
                            >
                              Reactivate
                            </Button>
                          )}
                          {canManage && u.isActive !== false && u.role !== 'owner' && (
                            <Button
                              variant="plain"
                              size="auto"
                              type="button"
                              onClick={(e) => handleDelete(u, e)}
                              className="rounded-md p-1 text-muted-foreground/30 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Deactivate user"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No users found matching this filter.
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
