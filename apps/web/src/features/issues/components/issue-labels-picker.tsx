import * as React from 'react';
import { Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, Input } from '@reka/ui';
import { Tag, Plus } from 'lucide-react';
import { useCreateLabel, useIssueLabels } from '../hooks/use-issues';

export function IssueLabelsPicker({ teamId, projectId, value, onChange, compact = false }: {
  teamId: string;
  projectId?: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
}) {
  const { data: labels = [], isLoading, isError, refetch } = useIssueLabels();
  const createLabel = useCreateLabel();
  const [name, setName] = React.useState('');
  const available = labels.filter((label) => (!label.teamId || label.teamId === teamId) && (!label.projectId || label.projectId === projectId));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={compact ? 'icon-xs' : 'sm'} aria-label="Issue labels" className={compact ? 'size-7' : 'justify-start'}>
          <Tag />{!compact && <span>Labels{value.length ? ` (${value.length})` : ''}</span>}
        </Button>
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
