import * as React from 'react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FieldDescription,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  cn,
} from '@reka/ui';
import { Check, Plus, Tag } from 'lucide-react';
import { IssuePickerMenu } from './issue-picker-menu';
import { useCreateLabel, useIssueLabels } from '../hooks/use-issues';

export function IssueLabelsPicker({
  teamId,
  projectId,
  value,
  onChange,
  compact = false,
  appearance = 'button',
  className,
  id,
}: {
  teamId: string;
  projectId?: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
  appearance?: 'button' | 'badge';
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [hoverOpen, setHoverOpen] = React.useState(false);
  const [newLabelName, setNewLabelName] = React.useState('');
  const { data: labels = [], isLoading, isError, refetch } = useIssueLabels();
  const createLabel = useCreateLabel();

  const available = labels.filter(
    (label) => (!label.teamId || label.teamId === teamId) && (!label.projectId || label.projectId === projectId),
  );

  const selected = available.filter((label) => value.includes(label.id));
  const groupIds = new Set(available.map((label) => label.parentId).filter((pid): pid is string => Boolean(pid)));
  // Group labels act as headings for their children; other top-level labels stay selectable on their own.
  const ordered = available
    .filter((label) => !label.parentId)
    .flatMap((label) => [label, ...available.filter((child) => child.parentId === label.id)]);

  const toggle = (label: (typeof available)[number], checked: boolean) => {
    if (!checked) {
      onChange(value.filter((valId) => valId !== label.id));
      return;
    }
    // One label per group: choosing a sibling replaces the previous choice.
    const siblings = label.parentId
      ? available.filter((other) => other.parentId === label.parentId).map((other) => other.id)
      : [];
    onChange([...value.filter((valId) => !siblings.includes(valId)), label.id]);
  };

  const labelText = React.useMemo(() => {
    if (selected.length === 0) return 'Labels';
    if (selected.length === 1) return selected[0].name;
    return `${selected.length} labels`;
  }, [selected]);

  const triggerButton = appearance === 'badge' ? (
    <Badge
      asChild
      variant="outline"
      className={cn(
        'h-6 w-fit gap-1.5 px-2 hover:bg-secondary/70 transition-colors',
        compact && selected.length === 0 && 'px-1.5',
        className,
      )}
    >
      <Button
        variant="plain"
        size="auto"
        type="button"
        id={id}
        aria-label={`Issue labels: ${selected.map((l) => l.name).join(', ') || 'None'}`}
        title={selected.length < 2 ? (selected.map((l) => l.name).join(', ') || 'Add labels') : undefined}
        className="inline-flex items-center gap-1.5 text-left truncate"
      >
        {selected[0] ? (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: selected[0].color }}
          />
        ) : (
          <Tag aria-hidden="true" className="size-3 text-muted-foreground" />
        )}
        <span
          className={cn(
            'truncate',
            !selected[0] && 'text-muted-foreground',
            compact && !selected[0] && 'hidden md:inline',
            compact && selected.length === 1 && 'max-w-[100px]',
          )}
        >
          {labelText}
        </span>
      </Button>
    </Badge>
  ) : (
    <Button
      variant="outline"
      size={compact ? 'icon-xs' : 'sm'}
      type="button"
      id={id}
      aria-label="Issue labels"
      title={selected.length < 2 ? (selected.map((l) => l.name).join(', ') || 'Add labels') : undefined}
      className={cn(compact ? 'size-7' : 'justify-start gap-1.5', className)}
    >
      {selected[0] ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: selected[0].color }}
        />
      ) : (
        <Tag className="size-3.5" />
      )}
      {!compact && <span>{labelText}</span>}
    </Button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <HoverCard
        open={open ? false : hoverOpen}
        onOpenChange={setHoverOpen}
        openDelay={200}
        closeDelay={150}
      >
        <HoverCardTrigger asChild>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            {triggerButton}
          </DropdownMenuTrigger>
        </HoverCardTrigger>

        {selected.length >= 2 && (
          <HoverCardContent
            side="top"
            align="center"
            sideOffset={6}
            className="w-auto max-w-xs p-2.5 bg-popover border border-border shadow-xl rounded-lg pointer-events-none select-none z-50"
          >
            <div className="flex flex-col gap-2 min-w-32">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                <span>Labels</span>
                <span className="font-mono font-normal">({selected.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-border bg-secondary/60 text-foreground"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="truncate">{label.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </HoverCardContent>
        )}
      </HoverCard>

      <IssuePickerMenu
        label="Labels"
        footer={
          teamId ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!newLabelName.trim() || createLabel.isPending) return;
                createLabel.mutate(
                  { teamId, projectId, name: newLabelName.trim() },
                  {
                    onSuccess: (newLabel) => {
                      setNewLabelName('');
                      onChange([...value, newLabel.id]);
                    },
                  },
                );
              }}
              className="mt-2 flex items-center gap-1.5 border-t border-border pt-2"
            >
              <Input
                aria-label="Create new label"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Create label…"
                maxLength={50}
                className="h-8 text-xs flex-1"
              />
              <Button
                type="submit"
                size="icon-sm"
                aria-label="Create label"
                disabled={!newLabelName.trim() || createLabel.isPending}
                className="size-8 shrink-0"
              >
                <Plus className="size-3.5" />
              </Button>
            </form>
          ) : null
        }
      >
        {(search) => {
          if (isLoading) {
            return (
              <FieldDescription role="status" className="p-3 text-center text-xs text-muted-foreground">
                Loading labels…
              </FieldDescription>
            );
          }
          if (isError) {
            return (
              <div className="p-2 text-center">
                <Button type="button" variant="ghost" size="xs" onClick={() => void refetch()}>
                  Retry loading labels
                </Button>
              </div>
            );
          }

          const filtered = ordered.filter((label) => label.name.toLowerCase().includes(search));
          if (!filtered.length && !search) {
            return (
              <FieldDescription role="status" className="p-3 text-center text-xs text-muted-foreground">
                No labels in this team yet.
              </FieldDescription>
            );
          }

          const hasExactMatch = available.some(
            (label) => label.name.toLowerCase() === search.trim(),
          );

          return (
            <div className="flex flex-col gap-0.5">
              {filtered.map((label) => {
                if (groupIds.has(label.id)) {
                  return (
                    <p
                      key={label.id}
                      className="px-2 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {label.name}
                    </p>
                  );
                }
                const isChecked = value.includes(label.id);
                return (
                  <DropdownMenuItem
                    key={label.id}
                    className={cn(
                      'flex items-center justify-between py-1.5 px-2 cursor-pointer text-xs',
                      label.parentId && 'pl-5',
                    )}
                    onSelect={(event) => {
                      event.preventDefault();
                      toggle(label, !isChecked);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="truncate">{label.name}</span>
                    </div>
                    {isChecked && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                  </DropdownMenuItem>
                );
              })}

              {!filtered.length && search && (
                <FieldDescription role="status" className="p-2 text-center text-xs text-muted-foreground">
                  No labels found.
                </FieldDescription>
              )}

              {search.trim() && !hasExactMatch && teamId && (
                <DropdownMenuItem
                  className="flex items-center gap-2 py-1.5 px-2 text-primary cursor-pointer border-t border-border mt-1 pt-1.5 text-xs font-medium"
                  disabled={createLabel.isPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    createLabel.mutate(
                      { teamId, projectId, name: search.trim() },
                      {
                        onSuccess: (newLabel) => {
                          onChange([...value, newLabel.id]);
                        },
                      },
                    );
                  }}
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">Create "{search.trim()}"</span>
                </DropdownMenuItem>
              )}
            </div>
          );
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
