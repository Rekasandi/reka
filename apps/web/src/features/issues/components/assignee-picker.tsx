import * as React from 'react';
import {
  Badge,
  cn,
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
  Button,
} from '@reka/ui';
import { User, Check, Search, X } from 'lucide-react';
import { useUsers } from '../../users/hooks/use-users';
import { useAuth } from '../../auth/hooks/use-auth';

interface AssigneePickerProps {
  assigneeId?: string | null;
  id?: string;
  onAssigneeChange: (assigneeId: string | null) => void;
  className?: string;
  size?: 'sm' | 'default' | 'icon';
  appearance?: 'icon' | 'badge' | 'compact' | 'default';
}

const getUserDisplayName = (u?: { name?: string | null; email?: string | null } | null) =>
  u?.name?.trim() || u?.email?.split('@')[0] || 'Member';

export function AssigneePicker({
  assigneeId,
  id,
  onAssigneeChange,
  className,
  size = 'default',
  appearance,
}: AssigneePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: users = [] } = useUsers();
  const { user: currentUser } = useAuth();

  const assignedUser = React.useMemo(() => {
    if (!assigneeId) return null;
    const found = users.find((u) => u.id === assigneeId);
    if (found) return found;
    if (currentUser?.id === assigneeId) return currentUser;
    return null;
  }, [users, assigneeId, currentUser]);

  // The session user lacks avatar/email details; the workspace member record has them.
  const me = currentUser ? { ...currentUser, ...users.find((u) => u.id === currentUser.id) } : null;
  const filteredUsers = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    // "Assign to me" already lists the current user, so leave them out of the members below.
    const others = users.filter((u) => u.id !== currentUser?.id);
    if (!q) return others;
    return others.filter((u) => {
      const displayName = getUserDisplayName(u);
      return (
        displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, currentUser?.id]);

  const handleSelect = (userId: string | null) => {
    onAssigneeChange(userId);
    setOpen(false);
    setSearchQuery('');
  };

  const assignedName = assignedUser ? getUserDisplayName(assignedUser) : '';
  const initial = (assignedName[0] || 'M').toUpperCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {appearance === 'badge' ? (
          <Badge
            asChild
            variant={assignedUser ? 'secondary' : 'outline'}
            className={cn(
              'h-8 w-full justify-start gap-1.5 px-2 hover:bg-secondary/70 transition-all cursor-pointer font-normal text-xs rounded-4xl border select-none',
              assignedUser
                ? 'border-info/30 bg-info/10 text-info hover:bg-info/20'
                : 'border-border/80 text-muted-foreground',
              className
            )}
          >
            <Button
              variant="plain"
              size="auto"
              type="button"
              id={id}
              aria-label={assignedUser ? `Assigned to ${assignedName}` : 'Assign member'}
              title={assignedUser ? `Assigned to ${assignedName}` : 'Assign member'}
            >
              {assignedUser ? (
                <>
                  <Avatar className="size-4.5 rounded-full border border-info/30">
                    {assignedUser.avatarUrl && (
                      <AvatarImage src={assignedUser.avatarUrl} alt={assignedName} />
                    )}
                    <AvatarFallback className="text-2xs font-bold bg-info/20 text-info">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs font-medium text-foreground">
                    {assignedName}
                  </span>
                </>
              ) : (
                <>
                  <div className="size-4 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <User className="size-2.5" />
                  </div>
                  <span className="text-xs text-muted-foreground">Unassigned</span>
                </>
              )}
            </Button>
          </Badge>
        ) : size === 'icon' ? (
          <Button variant="ghost" size="icon-xs" id={id}
            type="button"
            className={`flex size-6 items-center justify-center rounded-full hover:ring-1 hover:ring-border transition-colors outline-hidden ${className || ''}`}
            title={assignedUser ? `Assigned to ${assignedName}` : 'Assign member'}
          >
            {assignedUser ? (
              <Avatar className="size-5 rounded-full border border-border">
                {assignedUser.avatarUrl && (
                  <AvatarImage src={assignedUser.avatarUrl} alt={assignedName} />
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
          </Button>
        ) : size === 'sm' ? (
          <Button variant="outline" size="xs" id={id}
            type="button"
            className={`inline-flex items-center gap-1.5 h-6 px-1.5 rounded-sm border border-border/60 hover:bg-muted/50 text-xs transition-colors outline-hidden ${className || ''}`}
          >
            {assignedUser ? (
              <>
                <Avatar className="size-4 rounded-full">
                  {assignedUser.avatarUrl && (
                    <AvatarImage src={assignedUser.avatarUrl} alt={assignedName} />
                  )}
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate max-w-[90px] text-xs font-medium text-foreground">
                  {assignedName}
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="size-3" />
                <span>Assign</span>
              </span>
            )}
          </Button>
        ) : (
          <Button variant="ghost" id={id}
            aria-label={assignedUser ? `Assigned to ${assignedName}` : 'Assign member'}
            type="button"
            className={`flex h-8 w-full items-center justify-between rounded-sm border border-border/60 bg-background/80 px-2.5 text-xs font-medium hover:border-border transition-colors outline-hidden ${className || ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {assignedUser ? (
                <>
                  <Avatar className="size-4.5 rounded-full border border-border">
                    {assignedUser.avatarUrl && (
                      <AvatarImage src={assignedUser.avatarUrl} alt={assignedName} />
                    )}
                    <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xs text-foreground font-medium">
                    {assignedName}
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
          </Button>
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
            placeholder="Assign to…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs bg-background"
            autoFocus
          />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuGroup className="max-h-52 overflow-y-auto">
          {/* Quick Assign to Current User */}
          {me && (() => {
            const meName = getUserDisplayName(me);
            const meInitial = (meName[0] || 'Y').toUpperCase();
            return (
              <DropdownMenuItem
                onClick={() => handleSelect(me.id)}
                className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-5 rounded-full border border-border shrink-0">
                    {me.avatarUrl && <AvatarImage src={me.avatarUrl} alt={meName} />}
                    <AvatarFallback className="text-xs font-semibold bg-info/15 text-info">
                      {meInitial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate text-xs">
                      Assign to me
                    </span>
                    <span className="text-xs text-muted-foreground truncate font-mono">
                      {me.email || meName}
                    </span>
                  </div>
                </div>
                {assigneeId === me.id && <Check className="size-3 text-primary" />}
              </DropdownMenuItem>
            );
          })()}

          {/* Unassigned Option */}
          <DropdownMenuItem
            onClick={() => handleSelect(null)}
            className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm cursor-pointer text-muted-foreground hover:text-foreground"
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
              const uName = getUserDisplayName(u);
              const uInitial = (uName[0] || 'M').toUpperCase();

              return (
                <DropdownMenuItem
                  key={u.id}
                  onClick={() => handleSelect(u.id)}
                  className="flex items-center justify-between px-2 py-1.5 text-xs rounded-sm cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="size-5 rounded-full border border-border shrink-0">
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={uName} />}
                      <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                        {uInitial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate text-xs">
                        {uName}
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
