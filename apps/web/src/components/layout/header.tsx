import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, User, Settings, LogOut } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
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

export function Header() {
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const navigate = useNavigate();

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

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full ring-offset-background transition-opacity hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <Avatar className="size-6 border border-border">
                <AvatarFallback className="bg-primary/15 text-foreground text-[10px] font-medium">
                  G
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold leading-none text-foreground">Gustam</p>
                <p className="text-[11px] leading-none text-muted-foreground font-mono truncate">
                  owner@rekasandi.com
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <User className="size-3.5" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="size-3.5" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-destructive focus:text-destructive">
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
