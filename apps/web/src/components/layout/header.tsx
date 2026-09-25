import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, User, Settings, LogOut } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  SidebarTrigger,
  Separator,
} from '@reka/ui';
import { useUiStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { ThemeToggle } from '../theme/theme-toggle';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || 'size-3.5'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function Header() {
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const displayName = user?.name || 'Gustam';
  const displayEmail = user?.email || 'owner@rekasandi.com';
  const displayAvatar = user?.avatarUrl || undefined;
  const displayInitial = (displayName[0] || 'G').toUpperCase();

  // Extract GitHub username if available
  const githubUsername = displayEmail.includes('@users.noreply.github.com')
    ? displayEmail.replace('@users.noreply.github.com', '')
    : displayName.toLowerCase().replace(/\s+/g, '');

  return (
    <header className="h-11 border-b border-border px-4 flex items-center justify-between bg-card/20 backdrop-blur-xs select-none gap-2">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 border border-border rounded-[6px] px-2.5 py-1 hover:text-foreground hover:bg-secondary/70 transition-colors"
        >
          <Search className="size-3.5" />
          <span className="truncate">Search or jump to...</span>
          <kbd className="ml-4 flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Command className="size-2.5" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* User Profile Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-secondary/60 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <Avatar className="size-6 border border-border">
                {displayAvatar && <AvatarImage src={displayAvatar} alt={displayName} />}
                <AvatarFallback className="bg-primary/15 text-foreground text-[10px] font-medium">
                  {displayInitial}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-[10px]">
            <DropdownMenuLabel className="p-2 pb-2.5">
              <div className="flex items-center gap-3">
                <Avatar className="size-8 border border-border shrink-0">
                  {displayAvatar && <AvatarImage src={displayAvatar} alt={displayName} />}
                  <AvatarFallback className="bg-secondary text-foreground text-xs font-semibold">
                    {displayInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-tight text-foreground truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] leading-tight text-muted-foreground font-mono truncate">
                    {displayEmail}
                  </p>
                </div>
              </div>

              {/* GitHub Connected Profile Badge */}
              <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1 rounded-[5px] bg-secondary/60 border border-border/60 text-[10px] font-mono text-muted-foreground">
                <GithubIcon className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate text-foreground font-medium">github.com/{githubUsername}</span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="size-3.5" />
                <span>Profile Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="size-3.5" />
                <span>Preferences</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => logout()}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="size-3.5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
