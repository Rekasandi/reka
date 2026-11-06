import * as React from 'react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@reka/ui';
import { MoreHorizontal, Pencil, Plus, RefreshCw, Search, Tag, Trash2 } from 'lucide-react';
import type { Label as IssueLabel } from '@reka/types';
import { ColorPickerField } from '../../../components/common/color-picker-field';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { ManageLabelsDialog } from '../../issues/components/manage-labels-dialog';
import { useTeams } from '../../teams/hooks/use-teams';
import { useCreateLabel, useDeleteLabel, useIssueLabels, useUpdateLabel } from '../../issues/hooks/use-issues';
import type { Team } from '../../teams/api/teams.api';

const NO_GROUP = '__none__';
const ALL_TEAMS = '__all__';

interface LabelModalState {
  open: boolean;
  mode: 'create' | 'edit';
  label?: IssueLabel;
  defaultTeamId?: string;
}

function CreateEditLabelDialog({
  state,
  teams,
  labels,
  onOpenChange,
}: {
  state: LabelModalState;
  teams: Team[];
  labels: IssueLabel[];
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState('#6b7280');
  const [teamId, setTeamId] = React.useState('');
  const [parentId, setParentId] = React.useState(NO_GROUP);

  React.useEffect(() => {
    if (!state.open) return;
    if (state.mode === 'edit' && state.label) {
      setName(state.label.name);
      setColor(state.label.color);
      setTeamId(state.label.teamId || '');
      setParentId(state.label.parentId || NO_GROUP);
    } else {
      setName('');
      setColor('#6b7280');
      const fallbackTeamId = state.defaultTeamId || teams.find(t => t.canManage)?.id || teams[0]?.id || '';
      setTeamId(fallbackTeamId);
      setParentId(NO_GROUP);
    }
  }, [state.open, state.mode, state.label, state.defaultTeamId, teams]);

  const candidateGroups = labels.filter(
    (l) => l.teamId === teamId && !l.parentId && (!state.label || l.id !== state.label.id),
  );

  const isPending = create.isPending || update.isPending;
  const canSave = Boolean(name.trim() && teamId && !isPending);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    const resolvedParent = parentId === NO_GROUP ? null : parentId;
    if (state.mode === 'edit' && state.label) {
      update.mutate(
        { id: state.label.id, name: name.trim(), color, parentId: resolvedParent },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(
        { teamId, name: name.trim(), color, parentId: resolvedParent },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  return (
    <Dialog open={state.open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{state.mode === 'edit' ? 'Edit label' : 'Create label'}</DialogTitle>
          <DialogDescription>
            Labels help categorize, filter, and track issues across teams.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="label-name">Name</FieldLabel>
              <Input
                id="label-name"
                placeholder="e.g. Bug, Frontend, Priority: High"
                maxLength={50}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field>
                <FieldLabel htmlFor="label-color">Color</FieldLabel>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: color }}
                  />
                  <Input
                    id="label-color"
                    value={color}
                    maxLength={7}
                    onChange={(e) => setColor(e.target.value)}
                    className="font-mono text-xs uppercase"
                  />
                </div>
              </Field>
              <ColorPickerField label="Pick label color" value={color} onValueChange={setColor} />
            </div>

            <Field>
              <FieldLabel htmlFor="label-team">Team</FieldLabel>
              <Select
                value={teamId}
                onValueChange={(val) => {
                  setTeamId(val);
                  setParentId(NO_GROUP);
                }}
                disabled={state.mode === 'edit'}
              >
                <SelectTrigger id="label-team" className="w-full">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id} disabled={!t.canManage}>
                        {t.name} ({t.key}){t.canManage ? '' : ' · read-only'}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="label-group">Label group</FieldLabel>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="label-group" className="w-full">
                  <SelectValue placeholder="No group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={NO_GROUP}>No group (Top-level)</SelectItem>
                    {candidateGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {(() => {
                if (isPending) return 'Saving…';
                if (state.mode === 'edit') return 'Save changes';
                return 'Create label';
              })()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LabelsSettings() {
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, refetch: retryTeams } = useTeams();
  const { data: labels = [], isLoading: labelsLoading, isError: labelsError, refetch: retryLabels } = useIssueLabels();
  const remove = useDeleteLabel();

  const [selectedTeamFilter, setSelectedTeamFilter] = React.useState<string>(ALL_TEAMS);
  const [search, setSearch] = React.useState('');
  const [modalState, setModalState] = React.useState<LabelModalState>({ open: false, mode: 'create' });
  const [deleteTarget, setDeleteTarget] = React.useState<IssueLabel | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = React.useState(false);

  if (teamsLoading || labelsLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-md" />
      </div>
    );
  }

  if (teamsError || labelsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between">
          <span>Could not load labels configuration.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void retryTeams();
              void retryLabels();
            }}
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const labelMap = new Map(labels.map((l) => [l.id, l]));

  const filteredLabels = labels.filter((label) => {
    if (selectedTeamFilter !== ALL_TEAMS && label.teamId !== selectedTeamFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const parentName = label.parentId ? labelMap.get(label.parentId)?.name || '' : '';
      const matchesName = label.name.toLowerCase().includes(q);
      const matchesGroup = parentName.toLowerCase().includes(q);
      const team = label.teamId ? teamMap.get(label.teamId) : null;
      const matchesTeam = Boolean(team && (team.name.toLowerCase().includes(q) || team.key.toLowerCase().includes(q)));
      return matchesName || matchesGroup || matchesTeam;
    }
    return true;
  });

  const canManageCurrentFilter =
    selectedTeamFilter === ALL_TEAMS
      ? teams.some((t) => t.canManage)
      : Boolean(teamMap.get(selectedTeamFilter)?.canManage);

  return (
    <section className="flex flex-col gap-5">
      {/* Action / Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter labels…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_TEAMS}>All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.key})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {canManageCurrentFilter && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManageDialogOpen(true)}
            >
              Manage labels
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setModalState({
                  open: true,
                  mode: 'create',
                  defaultTeamId: selectedTeamFilter === ALL_TEAMS ? undefined : selectedTeamFilter,
                })
              }
            >
              <Plus className="size-3.5" />
              New label
            </Button>
          </div>
        )}
      </div>

      {/* Table view */}
      <div className="rounded-md border border-border">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40%]">Label</TableHead>
              <TableHead className="w-[25%]">Group</TableHead>
              <TableHead className="w-[25%]">Team</TableHead>
              <TableHead className="w-[10%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLabels.length > 0 ? (
              filteredLabels.map((label) => {
                const team = label.teamId ? teamMap.get(label.teamId) : null;
                const parent = label.parentId ? labelMap.get(label.parentId) : null;
                const canManageLabel = Boolean(team?.canManage);

                return (
                  <TableRow key={label.id} className="h-11">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full border border-border"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="truncate text-foreground font-medium">{label.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {parent ? (
                        <Badge variant="secondary" className="font-normal text-[11px]">
                          {parent.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {team ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-muted-foreground">
                          <span className="font-semibold text-foreground">{team.key}</span>
                          <span className="text-[11px]">· {team.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Workspace</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManageLabel ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${label.name}`}>
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem
                              onClick={() => setModalState({ open: true, mode: 'edit', label })}
                            >
                              <Pencil className="size-3.5" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(label)}
                            >
                              <Trash2 className="size-3.5" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">View only</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Tag className="size-5 text-muted-foreground/60" />
                    <p className="text-sm font-medium">No labels found</p>
                    <p className="text-xs text-muted-foreground">
                      {labels.length === 0
                        ? 'Create your first label to start organizing issues.'
                        : 'No labels match your filter.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateEditLabelDialog
        state={modalState}
        teams={teams}
        labels={labels}
        onOpenChange={(open) => setModalState((prev) => ({ ...prev, open }))}
      />

      <ManageLabelsDialog
        open={manageDialogOpen}
        onOpenChange={setManageDialogOpen}
        initialTeamId={selectedTeamFilter === ALL_TEAMS ? teams.find((t) => t.canManage)?.id : selectedTeamFilter}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete label "${deleteTarget?.name}"?`}
        description="This removes the label from all issues using it. Issues themselves will be kept."
        confirmLabel="Delete label"
        onConfirm={() => {
          if (deleteTarget) {
            remove.mutate(deleteTarget.id);
          }
        }}
      />
    </section>
  );
}
