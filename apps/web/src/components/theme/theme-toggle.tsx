import * as React from 'react';
import { Moon, Sun, Laptop } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@reka/ui';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
          title="Toggle theme"
        >
          {resolvedTheme === 'dark' ? (
            <Moon className="size-3.5" />
          ) : (
            <Sun className="size-3.5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 p-1 rounded-[8px]">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 text-xs rounded-[5px] cursor-pointer ${
            theme === 'light' ? 'bg-secondary font-medium text-foreground' : ''
          }`}
        >
          <Sun className="size-3.5" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 text-xs rounded-[5px] cursor-pointer ${
            theme === 'dark' ? 'bg-secondary font-medium text-foreground' : ''
          }`}
        >
          <Moon className="size-3.5" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 text-xs rounded-[5px] cursor-pointer ${
            theme === 'system' ? 'bg-secondary font-medium text-foreground' : ''
          }`}
        >
          <Laptop className="size-3.5" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
