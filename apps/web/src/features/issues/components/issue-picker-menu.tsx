import * as React from 'react';
import { DropdownMenuContent, DropdownMenuLabel, Input } from '@reka/ui';
import { Search } from 'lucide-react';

// Shared surface only; each domain picker owns its options and mutations.
export function IssuePickerMenu({ label, children, onKeyDown }: {
  label: string;
  children: (search: string) => React.ReactNode;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}) {
  const [search, setSearch] = React.useState('');

  return (
    <DropdownMenuContent className="w-64" onClick={event => {
        event.stopPropagation();
        if ((event.target as HTMLElement).closest('[role="menuitemradio"]')) setSearch('');
      }}
      onCloseAutoFocus={() => setSearch('')}
      onEscapeKeyDown={() => setSearch('')}
      onInteractOutside={() => setSearch('')}
      onKeyDown={event => {
        if (!(event.target instanceof HTMLInputElement)) onKeyDown?.(event);
        event.stopPropagation();
      }}>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <div className="relative mb-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}...`}
          value={search} onChange={event => setSearch(event.target.value)} className="h-8 pl-7"
          onKeyDown={event => {
            if (event.key === 'Escape') return;
            event.stopPropagation();
            if (event.key === 'Enter') event.preventDefault();
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const items = event.currentTarget.closest('[role="menu"]')?.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not([data-disabled]), [role="menuitem"]:not([data-disabled])');
              const item = event.key === 'ArrowDown' ? items?.[0] : items?.[(items?.length ?? 0) - 1];
              item?.focus();
            }
          }} />
      </div>
      <div className="max-h-60 overflow-y-auto">{children(search.trim().toLowerCase())}</div>
    </DropdownMenuContent>
  );
}
