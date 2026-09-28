import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
} from '@reka/ui';
import { Search, UserCheck, X, Check, Shield } from 'lucide-react';
import { useAddTeamMember } from '../hooks/use-teams';
import { useUsers } from '../../users/hooks/use-users';
import type { User } from '../../users/api/users.api';

interface AddMemberDialogProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMemberUserIds?: string[];
}

export function AddMemberDialog({
  teamId,
  open,
  onOpenChange,
  existingMemberUserIds = [],
}: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [role, setRole] = React.useState('member');
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { data: users = [], isLoading: isUsersLoading } = useUsers();
  const addMemberMutation = useAddTeamMember(teamId);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available users based on search
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

  const handleSelectUser = (u: User) => {
    const isAlreadyMember = existingMemberUserIds.includes(u.id);
    if (isAlreadyMember) return;

    setSelectedUser(u);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleClearSelected = () => {
    setSelectedUser(null);
    setSearchQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    addMemberMutation.mutate(
      {
        userId: selectedUser.id,
        role,
      },
      {
        onSuccess: () => {
          setSelectedUser(null);
          setSearchQuery('');
          setRole('member');
          onOpenChange(false);
        },
      },
    );
  };

  // Reset state on modal open/close
  React.useEffect(() => {
    if (!open) {
      setSelectedUser(null);
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Assign a developer or contributor to this team workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* User Autocomplete Selector */}
            <Field>
              <FieldLabel>Select Member *</FieldLabel>

              <div ref={containerRef} className="relative w-full">
                {selectedUser ? (
                  /* Selected User Pill */
                  <div className="flex items-center justify-between p-2 rounded-[6px] border border-border bg-muted/30 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-6 border border-border">
                        {selectedUser.avatarUrl && (
                          <AvatarImage src={selectedUser.avatarUrl} alt={selectedUser.name} />
                        )}
                        <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                          {(selectedUser.name[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          {selectedUser.name}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          {selectedUser.email}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearSelected}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Clear selection"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  /* Search Input */
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={inputRef}
                      placeholder="Type name or email to search..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      className="h-8 pl-8 text-xs font-sans bg-background"
                      autoFocus
                    />
                  </div>
                )}

                {/* Autocomplete Dropdown Menu */}
                {!selectedUser && isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl z-50 divide-y divide-border/50">
                    {isUsersLoading ? (
                      <div className="p-3 text-center text-xs text-muted-foreground font-mono">
                        Loading workspace users...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No users found matching &ldquo;{searchQuery}&rdquo;
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const isAlreadyMember = existingMemberUserIds.includes(u.id);
                        const initial = (u.name[0] || 'U').toUpperCase();

                        return (
                          <div
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`flex items-center justify-between p-2.5 text-xs transition-colors select-none ${
                              isAlreadyMember
                                ? 'opacity-50 cursor-not-allowed bg-muted/20'
                                : 'cursor-pointer hover:bg-muted/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <Avatar className="size-6 border border-border shrink-0">
                                {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.name} />}
                                <AvatarFallback className="text-xs font-semibold bg-secondary text-foreground">
                                  {initial}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex flex-col min-w-0">
                                <span className="font-medium text-foreground truncate">
                                  {u.name}
                                </span>
                                <span className="text-xs font-mono text-muted-foreground truncate">
                                  {u.email}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isAlreadyMember ? (
                                <Badge variant="outline" className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0 h-4">
                                  Already in team
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="capitalize text-xs font-mono px-1.5 py-0 h-4">
                                  {u.role}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </Field>

            {/* Team Role Selector */}
            <Field>
              <FieldLabel>Team Role</FieldLabel>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="lead">Team Lead</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedUser || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
