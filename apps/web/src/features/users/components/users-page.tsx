import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Skeleton,
  Avatar,
  AvatarFallback,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@reka/ui';
import { UserPlus, Shield, CheckSquare, Users, Trash2, RefreshCw, Mail } from 'lucide-react';
import { useUsers, useUpdateUser, useDeleteUser } from '../hooks/use-users';
import { CreateUserDialog } from './create-user-dialog';
import type { User } from '../api/users.api';

function RoleBadge({ role }: { role: User['role'] }) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    owner: { label: 'Owner', variant: 'default' },
    admin: { label: 'Admin', variant: 'default' },
    member: { label: 'Member', variant: 'secondary' },
    guest: { label: 'Guest', variant: 'outline' },
    client: { label: 'Client', variant: 'outline' },
  };

  const item = map[role] || { label: role, variant: 'secondary' };
  return (
    <Badge variant={item.variant} className="capitalize text-[10px] font-mono h-5 px-2 font-normal">
      {(role === 'owner' || role === 'admin') && <Shield className="size-2.5 mr-1" />}
      <span>{item.label}</span>
    </Badge>
  );
}

export function UsersPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [filterRole, setFilterRole] = React.useState('all');

  const { data: users = [], isLoading, isError, refetch } = useUsers();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const filterOptions = React.useMemo(() => [
    { id: 'all', label: 'All', count: users.length },
    { id: 'admin', label: 'Admins', count: users.filter((u) => u.role === 'admin' || u.role === 'owner').length },
    { id: 'member', label: 'Members', count: users.filter((u) => u.role === 'member').length },
    { id: 'client', label: 'Clients', count: users.filter((u) => u.role === 'client' || u.role === 'guest').length },
  ], [users]);

  const filteredUsers = React.useMemo(() => {
    if (filterRole === 'all') return users;
    if (filterRole === 'admin') return users.filter((u) => u.role === 'admin' || u.role === 'owner');
    if (filterRole === 'client') return users.filter((u) => u.role === 'client' || u.role === 'guest');
    return users.filter((u) => u.role === filterRole);
  }, [users, filterRole]);

  const handleDelete = (u: User, e: React.MouseEvent) => {
    e.stopPropagation();
    if (u.role === 'owner') {
      alert('The workspace owner cannot be deleted.');
      return;
    }
    if (confirm(`Remove "${u.name}" from workspace?`)) {
      deleteMutation.mutate(u.id);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Workspace Users</h1>
            <span className="font-mono text-[11px] font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {users.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage organization members, assign roles, and control access permissions.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="rounded-[6px] h-8 px-3 text-xs font-medium">
          <UserPlus data-icon="inline-start" className="size-3.5" />
          <span>Invite User</span>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-2">
        {filterOptions.map((opt) => {
          const isSelected = filterRole === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilterRole(opt.id)}
              className={`h-7 px-2.5 text-xs rounded-[6px] font-medium transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-secondary text-foreground shadow-2xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <span>{opt.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[10px]" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load users from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Users Table / List View */}
      {!isLoading && !isError && (
        <div className="rounded-[12px] border border-border/80 divide-y divide-border/60 bg-card/30 overflow-hidden select-none shadow-2xs">
          {filteredUsers.map((u) => {
            const initial = (u.name || 'User')[0].toUpperCase();

            return (
              <div
                key={u.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors text-xs gap-4 group"
              >
                {/* User info */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <Avatar className="size-8 rounded-full border border-border/70 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                      {initial}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate text-sm">
                        {u.name}
                      </span>
                      <RoleBadge role={u.role} />
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground truncate">
                      {u.email}
                    </span>
                  </div>
                </div>

                {/* Stats & Actions */}
                <div className="flex items-center gap-6 shrink-0">
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
                  {u.role !== 'owner' && (
                    <Select
                      value={u.role}
                      onValueChange={(val) => updateMutation.mutate({ id: u.id, data: { role: val } })}
                    >
                      <SelectTrigger className="h-7 text-xs w-28 bg-background/80 rounded-[6px] border-border/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="guest">Guest</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}

                  {/* Delete button */}
                  {u.role !== 'owner' ? (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(u, e)}
                      className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[4px] hover:bg-destructive/10"
                      title="Remove user"
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

      {/* Invite User Dialog */}
      <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
