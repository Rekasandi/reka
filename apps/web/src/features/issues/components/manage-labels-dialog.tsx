import * as React from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton, Label, Alert, Spinner } from '@reka/ui';
import { useForm } from '@tanstack/react-form';
import { SelectField } from '../../../components/common/select-field';
import { TeamPicker } from './team-picker';
import { RefreshCw, Save, Tag, Trash2 } from 'lucide-react';
import type { Label as IssueLabel } from '@reka/types';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { ColorPickerField } from '../../../components/common/color-picker-field';
import { useTeams } from '../../teams/hooks/use-teams';
import { useCreateLabel, useDeleteLabel, useIssueLabels, useUpdateLabel } from '../hooks/use-issues';

const NO_GROUP = '__none__';

function LabelRow({ label, canManage, groups, hasChildren }: { label: IssueLabel; canManage: boolean; groups: IssueLabel[]; hasChildren: boolean }) {
  const [name, setName] = React.useState(label.name);
  const [color, setColor] = React.useState(label.color);
  const [parentId, setParentId] = React.useState(label.parentId ?? NO_GROUP);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const update = useUpdateLabel(); const remove = useDeleteLabel();
  React.useEffect(() => { setName(label.name); setColor(label.color); setParentId(label.parentId ?? NO_GROUP); }, [label.name, label.color, label.parentId]);
  const changed = name.trim() !== label.name || color !== label.color || parentId !== (label.parentId ?? NO_GROUP);
  return <li className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-center gap-2 border-b border-border py-2 last:border-b-0">
    <Label className="flex min-w-0 items-center gap-2 text-sm"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} /><Input aria-label={`${label.name} label name`} value={name} maxLength={50} disabled={!canManage || update.isPending} onChange={event => setName(event.target.value)} /></Label>
    <ColorPickerField label={`${label.name} label color`} value={color} disabled={!canManage || update.isPending} onValueChange={setColor} />
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon-sm" aria-label={`Save ${label.name}`} title="Save label" disabled={!canManage || !changed || !name.trim() || update.isPending} onClick={() => update.mutate({ id: label.id, name: name.trim(), color, parentId: parentId === NO_GROUP ? null : parentId })}><Save /></Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${label.name}`} title="Delete label" disabled={!canManage || remove.isPending} onClick={() => setDeleteOpen(true)}><Trash2 className="text-destructive" /></Button>
    </div>
    <div className="col-span-3 flex items-center gap-2 pl-4 text-xs text-muted-foreground">
      <span id={`${label.id}-group`}>Group</span>
      <SelectField aria-label={`${label.name} group`} className="w-48" value={parentId} disabled={!canManage || update.isPending || hasChildren}
        options={[{ value: NO_GROUP, label: hasChildren ? 'Is a group' : 'No group' }, ...groups.filter(group => group.id !== label.id).map(group => ({ value: group.id, label: group.name }))]} onValueChange={setParentId} />
    </div>
    <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete “${label.name}”?`} description="This removes the label from issues that use it. The issues themselves are preserved." onConfirm={() => remove.mutate(label.id)} />
  </li>;
}

export function ManageLabelsDialog({ open, onOpenChange, initialTeamId }: { open: boolean; onOpenChange: (open: boolean) => void; initialTeamId?: string }) {
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, refetch: retryTeams } = useTeams();
  const { data: labels = [], isLoading: labelsLoading, isError: labelsError, refetch: retryLabels } = useIssueLabels();
  const create = useCreateLabel();
  const [teamId, setTeamId] = React.useState(initialTeamId ?? '');
  React.useEffect(() => { if (open) setTeamId(initialTeamId ?? teams.find(team => team.canManage)?.id ?? teams[0]?.id ?? ''); }, [open, initialTeamId, teams]);
  const selectedTeam = teams.find(team => team.id === teamId);
  const visibleTeams = initialTeamId ? teams.filter(team => team.id === initialTeamId) : teams;
  const teamLabels = labels.filter(label => label.teamId === teamId);
  const canManage = !!selectedTeam?.canManage;
  const form = useForm({
    defaultValues: { name: '', color: '#6b7280' },
    onSubmit: ({ value }) => {
      if (!teamId || !value.name.trim() || !canManage) return;
      create.mutate({ teamId, name: value.name.trim(), color: value.color }, { onSuccess: () => form.setFieldValue('name', '') });
    },
  });
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[min(86svh,44rem)] gap-0 overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Manage labels</DialogTitle><DialogDescription>Rename, recolor, create or delete team labels. Changes apply to all issues using that label.</DialogDescription></DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        {teamsLoading ? <Skeleton className="h-9 w-full" /> : teamsError ? <Alert className="rounded-none border-0 bg-transparent px-0 py-0 text-foreground flex items-center gap-2 text-sm text-muted-foreground">Teams unavailable<Button type="button" variant="outline" size="sm" onClick={() => void retryTeams()}>Retry</Button></Alert> : <div className="flex flex-col gap-1 text-xs text-muted-foreground">Team<TeamPicker label="Label team" teams={visibleTeams} teamId={teamId} onTeamChange={setTeamId} disabled={Boolean(initialTeamId) || visibleTeams.length === 0} placeholder="Select a team" className="h-9 w-full justify-start" /></div>}
        {!teamsLoading && !canManage && <p className="text-xs text-muted-foreground">Team leads and authorized workspace administrators can manage labels. Team members can still use labels on issues.</p>}
        {labelsLoading ? <div className="space-y-2"><Spinner aria-label="Loading labels" className="sr-only" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : labelsError ? <Alert className="rounded-none border-0 bg-transparent px-0 py-0 text-foreground flex items-center gap-2 text-sm text-muted-foreground">Labels unavailable<Button type="button" variant="outline" size="sm" onClick={() => void retryLabels()}><RefreshCw data-icon="inline-start" />Retry</Button></Alert> : teamId && <>
          {teamLabels.length ? <ul aria-label="Team labels" className="max-h-64 overflow-y-auto">{teamLabels.map(label => <LabelRow key={label.id} label={label} canManage={canManage} groups={teamLabels.filter(group => !group.parentId && !group.projectId)} hasChildren={teamLabels.some(child => child.parentId === label.id)} />)}</ul> : <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Tag className="size-4" />No labels in this team yet.</p>}
          {canManage && <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-end gap-2 border-t border-border pt-4">
            <form.Field name="name" children={field => <Label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">New label<Input aria-label="New label name" name={field.name} maxLength={50} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} placeholder="Label name" /></Label>} />
            <form.Field name="color" children={field => <Label className="flex flex-col gap-1 text-xs text-muted-foreground">Color<ColorPickerField label="New label color" value={field.state.value} onValueChange={field.handleChange} /></Label>} />
            <form.Subscribe selector={state => state.values.name} children={name => <Button type="submit" disabled={!name.trim() || create.isPending}><Tag data-icon="inline-start" />Create</Button>} />
          </form>}
        </>}
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
