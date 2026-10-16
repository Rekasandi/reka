import * as React from 'react';
import { Badge, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, Input } from '@reka/ui';
import { Tag, Plus } from 'lucide-react';
import { useCreateLabel, useIssueLabels } from '../hooks/use-issues';

export function IssueLabelsPicker({ teamId, projectId, value, onChange, compact = false, appearance = 'button' }: {
  teamId: string;
  projectId?: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
  appearance?: 'button' | 'badge';
}) {
  const { data: labels = [], isLoading, isError, refetch } = useIssueLabels();
  const createLabel = useCreateLabel();
  const [name, setName] = React.useState('');
  const available = labels.filter((label) => (!label.teamId || label.teamId === teamId) && (!label.projectId || label.projectId === projectId));

  const selected = available.filter(label => value.includes(label.id));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {appearance === 'badge' ? <Badge asChild variant="outline" className="h-6 max-w-52 gap-1.5 px-2 hover:bg-secondary/70">
          <button type="button" aria-label="Issue labels" title={selected.map(label => label.name).join(', ') || 'Add label'}>
            {selected[0] ? <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: selected[0].color }} /> : <Tag aria-hidden="true" />}
            <span className="truncate">{selected[0]?.name ?? 'Labels'}{value.length > 1 ? ` +${value.length - 1}` : ''}</span>
          </button>
        </Badge> : <Button type="button" variant="outline" size={compact ? 'icon-xs' : 'sm'} aria-label="Issue labels" className={compact ? 'size-7' : 'justify-start'}>
          <Tag />{!compact && <span>Labels{value.length ? ` (${value.length})` : ''}</span>}
        </Button>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2" onClick={(event) => event.stopPropagation()}>
        <div className="max-h-56 overflow-y-auto">
          {isLoading ? <p className="p-2 text-xs text-muted-foreground">Loading labels…</p> : null}
          {isError ? <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>Retry loading labels</Button> : null}
          {!isLoading && !isError && available.length === 0 ? <p className="p-2 text-xs text-muted-foreground">No labels yet.</p> : null}
          {available.map((label) => (
            <DropdownMenuCheckboxItem key={label.id} checked={value.includes(label.id)} onCheckedChange={(checked) => onChange(checked ? [...value, label.id] : value.filter((id) => id !== label.id))}>
              <span className="mr-2 size-2 rounded-full" style={{ backgroundColor: label.color }} />{label.name}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
        <div className="mt-2 flex gap-1 border-t border-border pt-2">
          <Input aria-label="New label name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Create label…" maxLength={50} className="h-8" />
          <Button type="button" size="icon-sm" aria-label="Create label" disabled={!name.trim() || createLabel.isPending} onClick={() => createLabel.mutate({ teamId, projectId, name: name.trim() }, { onSuccess: (label) => { setName(''); onChange([...value, label.id]); } })}>
            <Plus />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
