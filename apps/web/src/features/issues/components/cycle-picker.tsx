import { Repeat } from 'lucide-react';
import {
  Badge, cn, DropdownMenu, DropdownMenuTrigger,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@reka/ui';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { IssuePickerMenu } from './issue-picker-menu';

export function CyclePicker({ cycleId, teamId, onCycleChange, identifier, compact = false, className, id }: {
  cycleId: string | null;
  teamId: string;
  onCycleChange: (cycleId: string | null) => void;
  identifier?: string;
  compact?: boolean;
  className?: string;
  id?: string;
}) {
  const { data: cycles = [], isPending, isError, refetch } = useCycles();
  const items = [{ id: 'none', label: 'No cycle', status: '' }, ...cycles.filter(cycle => cycle.teamId === teamId).map(cycle => ({ id: cycle.id, label: cycle.name || `Cycle ${cycle.number}`, status: cycle.status }))];
  const label = items.find(item => item.id === (cycleId ?? 'none'))?.label ?? 'Cycle unavailable';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
        <Badge asChild variant="outline" className={cn('h-6 gap-1.5 px-1.5 sm:px-2 border-emerald-600/30 bg-emerald-600/10 text-emerald-800 hover:bg-emerald-600/15 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-400/15', className)}>
          <button type="button" id={id} disabled={isPending}
            aria-label={`Change cycle${identifier ? ` for ${identifier}` : ''}: ${label}`} title={`Change cycle: ${label}`}>
            <Repeat className="size-3.5 shrink-0" />
            <span className={cn('max-w-[120px] truncate', compact && 'hidden md:inline')}>{label}</span>
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <IssuePickerMenu label="Cycles">
        {search => {
          if (isError) return <DropdownMenuGroup><DropdownMenuItem onSelect={event => { event.preventDefault(); void refetch(); }}>Failed to load cycles. Retry</DropdownMenuItem></DropdownMenuGroup>;
          const filtered = items.filter(item => item.label.toLowerCase().includes(search));
          return filtered.length ? <DropdownMenuRadioGroup value={cycleId ?? 'none'} onValueChange={value => {
            const nextId = value === 'none' ? null : value;
            if (nextId !== cycleId) onCycleChange(nextId);
          }}>
            {filtered.map(item => <DropdownMenuRadioItem key={item.id} value={item.id} indicatorPosition="right" className="py-1.5">
              <Repeat className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.status && <span className="shrink-0 text-xs text-muted-foreground capitalize">{item.status}</span>}
            </DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup> : <p role="status" className="p-3 text-center text-xs text-muted-foreground">No cycles found.</p>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
