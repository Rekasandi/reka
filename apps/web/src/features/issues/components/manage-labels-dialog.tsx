import * as React from 'react';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton } from '@reka/ui';
import { RefreshCw, Save, Tag, Trash2 } from 'lucide-react';
import type { Label } from '@reka/types';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { ColorPickerField } from '../../../components/common/color-picker-field';
import { useTeams } from '../../teams/hooks/use-teams';
import { useCreateLabel, useDeleteLabel, useIssueLabels, useUpdateLabel } from '../hooks/use-issues';

function LabelRow({ label, canManage }: { label: Label; canManage: boolean }) {
  const [name, setName] = React.useState(label.name);
  const [color, setColor] = React.useState(label.color);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const update = useUpdateLabel(); const remove = useDeleteLabel();
  React.useEffect(() => { setName(label.name); setColor(label.color); }, [label.name, label.color]);
  const changed = name.trim() !== label.name || color !== label.color;
  return <li className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-center gap-2 border-b border-border py-2 last:border-b-0">
    <label className="flex min-w-0 items-center gap-2 text-sm"><span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} /><Input aria-label={`${label.name} label name`} value={name} maxLength={50} disabled={!canManage || update.isPending} onChange={event => setName(event.target.value)} /></label>
    <ColorPickerField label={`${label.name} label color`} value={color} disabled={!canManage || update.isPending} onValueChange={setColor} />
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon-sm" aria-label={`Save ${label.name}`} title="Save label" disabled={!canManage || !changed || !name.trim() || update.isPending} onClick={() => update.mutate({ id: label.id, name: name.trim(), color })}><Save /></Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete ${label.name}`} title="Delete label" disabled={!canManage || remove.isPending} onClick={() => setDeleteOpen(true)}><Trash2 className="text-destructive" /></Button>
    </div>
    <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete “${label.name}”?`} description="This removes the label from issues that use it. The issues themselves are preserved." onConfirm={() => remove.mutate(label.id)} />
  </li>;
}

export function ManageLabelsDialog({ open, onOpenChange, initialTeamId }: { open: boolean; onOpenChange: (open: boolean) => void; initialTeamId?: string }) {
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, refetch: retryTeams } = useTeams();
  const { data: labels = [], isLoading: labelsLoading, isError: labelsError, refetch: retryLabels } = useIssueLabels();
  const create = useCreateLabel();
  const [teamId, setTeamId] = React.useState(initialTeamId ?? '');
  const [name, setName] = React.useState(''); const [color, setColor] = React.useState('#6b7280');
  React.useEffect(() => { if (open) setTeamId(initialTeamId ?? teams.find(team => team.canManage)?.id ?? teams[0]?.id ?? ''); }, [open, initialTeamId, teams]);
  const selectedTeam = teams.find(team => team.id === teamId);
  const visibleTeams = initialTeamId ? teams.filter(team => team.id === initialTeamId) : teams;
  const teamLabels = labels.filter(label => label.teamId === teamId);
  const canManage = !!selectedTeam?.canManage;
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (!teamId || !name.trim() || !canManage) return;
    create.mutate({ teamId, name: name.trim(), color }, { onSuccess: () => setName('') });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[min(86svh,44rem)] gap-0 overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Manage labels</DialogTitle><DialogDescription>Rename, recolor, create or delete team labels. Changes apply to all issues using that label.</DialogDescription></DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        {teamsLoading ? <Skeleton className="h-9 w-full" /> : teamsError ? <div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">Teams unavailable<Button type="button" variant="outline" size="sm" onClick={() => void retryTeams()}>Retry</Button></div> : <label className="flex flex-col gap-1 text-xs text-muted-foreground">Team<select aria-label="Label team" value={teamId} onChange={event => setTeamId(event.target.value)} disabled={!!initialTeamId || visibleTeams.length === 0} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"><option value="">Select a team</option>{visibleTeams.map(team => <option key={team.id} value={team.id}>{team.key} · {team.name}</option>)}</select></label>}
        {!teamsLoading && !canManage && <p className="text-xs text-muted-foreground">Team leads and authorized workspace administrators can manage labels. Team members can still use labels on issues.</p>}
        {labelsLoading ? <div role="status" aria-label="Loading labels" className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : labelsError ? <div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">Labels unavailable<Button type="button" variant="outline" size="sm" onClick={() => void retryLabels()}><RefreshCw data-icon="inline-start" />Retry</Button></div> : teamId && <>
          {teamLabels.length ? <ul aria-label="Team labels" className="max-h-64 overflow-y-auto">{teamLabels.map(label => <LabelRow key={label.id} label={label} canManage={canManage} />)}</ul> : <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Tag className="size-4" />No labels in this team yet.</p>}
          {canManage && <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)_3rem_auto] items-end gap-2 border-t border-border pt-4">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">New label<Input aria-label="New label name" maxLength={50} value={name} onChange={event => setName(event.target.value)} placeholder="Label name" /></label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Color<ColorPickerField label="New label color" value={color} onValueChange={setColor} /></label>
            <Button type="submit" disabled={!name.trim() || create.isPending}><Tag data-icon="inline-start" />Create</Button>
          </form>}
        </>}
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
