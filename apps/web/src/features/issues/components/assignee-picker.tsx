import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
} from '@reka/ui';
import { User, Check, Search, UserCheck, X } from 'lucide-react';
import { useUsers } from '../../users/hooks/use-users';
import { useAuthStore } from '../../../stores/auth.store';

interface AssigneePickerProps {
  assigneeId?: string | null;
  onAssigneeChange: (assigneeId: string | null) => void;
  className?: string;
  size?: 'sm' | 'default' | 'icon';
}

export function AssigneePicker({
  assigneeId,
  onAssigneeChange,
  className,
  size = 'default',
}: AssigneePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: users = [] } = useUsers();
  const { user: currentUser } = useAuthStore();

  const assignedUser = React.useMemo(() => {
    if (!assigneeId) return null;
    return users.find((u) => u.id === assigneeId) || null;
  }, [users, assigneeId]);

  const filteredUsers = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  const handleSelect = (userId: string | null) => {
    onAssigneeChange(userId);
    setOpen(false);
    setSearchQuery('');
  };

  const initial = assignedUser?.name ? assignedUser.name[0].toUpperCase() : 'U';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {size === 'icon' ? (
          <button
            type="button"
            className={`flex size-6 items-center justify-center rounded-full hover:ring-1 hover:ring-border transition-colors outline-hidden ${className || ''}`}
            title={assignedUser ? `Assigned to ${assignedUser.name}` : 'Assign member'}
          >
            {assignedUser ? (
              <Avatar className="size-5 rounded-full border border-border">
                {assignedUser.avatarUrl && (
                  <AvatarImage src={assignedUser.avatarUrl} alt={assignedUser.name} />
                )}
                <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="size-5 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground/60 hover:text-foreground">
                <User className="size-3" />
              </div>
            )}
          </button>
        ) : size === 'sm' ? (
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 h-6 px-1.5 rounded-[4px] border border-border/60 hover:bg-muted/50 text-xs transition-colors outline-hidden ${className || ''}`}
          >
            {assignedUser ? (
              <>
                <Avatar className="size-4 rounded-full">
                  {assignedUser.avatarUrl && (
                    <AvatarImage src={assignedUser.avatarUrl} alt={assignedUser.name} />
                  )}
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[90px] text-xs font-medium text-foreground">
                  {assignedUser.name}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="size-3" />
                <span>Assign</span>
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            className={`flex h-8 w-full items-center justify-between rounded-[6px] border border-border/60 bg-background/80 px-2.5 text-xs font-medium hover:border-border transition-colors outline-hidden ${className || ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {assignedUser ? (
                <>
                  <Avatar className="size-4.5 rounded-full border border-border">
                    {assignedUser.avatarUrl && (
                      <AvatarImage src={assignedUser.avatarUrl} alt={assignedUser.name} />
                    )}
                    <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs text-foreground font-medium">
                    {assignedUser.name}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="size-4 rounded-full border border-dashed border-border flex items-center justify-center">
                    <User className="size-2.5" />
                  </div>
                  <span className="text-xs">Unassigned</span>
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground/60">Assign</span>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-56 p-1 bg-popover border border-border text-foreground shadow-2xl rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input inside dropdown */}
        <div className="relative p-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Assign to..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-background"
            autoFocus
          />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup className="max-h-52 overflow-y-auto">
          {/* Quick Assign to Current User */}
          {currentUser && (
            <DropdownMenuItem
              onClick={() => handleSelect(currentUser.id)}
              className="flex items-center justify-between px-2 py-1.5 text-xs rounded-[4px] cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-5 rounded-full border border-border">
                  <AvatarFallback className="text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    {(currentUser.name[0] || 'Y').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate text-xs">
                    Assign to me
                  </span>
                  <span className="text-xs text-muted-foreground truncate font-mono">
                    {currentUser.name}
                  </span>
                </div>
              </div>
              {assigneeId === currentUser.id && <Check className="size-3 text-primary" />}
            </DropdownMenuItem>
          )}

          {/* Unassigned Option */}
          <DropdownMenuItem
            onClick={() => handleSelect(null)}
            className="flex items-center justify-between px-2 py-1.5 text-xs rounded-[4px] cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <div className="flex items-center gap-2">
              <div className="size-5 rounded-full border border-dashed border-border flex items-center justify-center">
                <X className="size-3 text-muted-foreground" />
              </div>
              <span>Unassigned</span>
            </div>
            {!assigneeId && <Check className="size-3 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* All Workspace Users */}
          {filteredUsers.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching members
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = assigneeId === u.id;
              const uInitial = (u.name[0] || 'U').toUpperCase();

              return (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  className="flex items-center justify-between px-2 py-1.5 text-xs rounded-[4px] cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="size-5 rounded-full border border-border shrink-0">
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                      <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                        {uInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate text-xs">
                        {u.name}
                      </span>
                      <span className="text-xs text-muted-foreground truncate font-mono">
                        {u.email}
                      </span>
                    </div>
                  </div>

                  {isSelected && <Check className="size-3 text-primary shrink-0 ml-2" />}
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
