import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@reka/ui';
import { useUiStore } from '../../stores/ui.store';
import {
  CheckSquare,
  FolderKanban,
  RotateCcw,
  Users,
  Building2,
  Settings,
  PlusCircle,
  Inbox,
} from 'lucide-react';

export function CommandPalette() {
  const isOpen = useUiStore((state) => state.isCommandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const navigate = useNavigate();

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/issues');
              })
            }
          >
            <PlusCircle className="size-3.5" />
            <span>Create New Issue</span>
            <CommandShortcut>C</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/inbox');
              })
            }
          >
            <Inbox className="size-3.5" />
            <span>Go to Inbox</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/my-issues');
              })
            }
          >
            <CheckSquare className="size-3.5" />
            <span>Go to My Issues</span>
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/projects');
              })
            }
          >
            <FolderKanban className="size-3.5" />
            <span>Go to Projects</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/cycles');
              })
            }
          >
            <RotateCcw className="size-3.5" />
            <span>Go to Cycles</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/teams');
              })
            }
          >
            <Users className="size-3.5" />
            <span>Go to Teams</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/clients');
              })
            }
          >
            <Building2 className="size-3.5" />
            <span>Go to Clients</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                navigate('/settings');
              })
            }
          >
            <Settings className="size-3.5" />
            <span>Go to Settings</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
