import type { ReactElement } from 'react';
import type { Issue } from '@reka/types';
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuGroup,
  ContextMenuLabel, ContextMenuItem, ContextMenuSeparator, ContextMenuSub,
  ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuRadioGroup,
  ContextMenuRadioItem, ContextMenuCheckboxItem, toast,
} from '@reka/ui';
import { Archive, ArrowUpToLine, Copy, ExternalLink, GitBranchPlus, ListTodo, RotateCcw, SignalHigh, Tag, Trash2 } from 'lucide-react';
import { STATUS_CONFIG, renderStateIcon } from './status-picker';
import { PRIORITY_CONFIG, PriorityIcon } from './priority-picker';
import { useTeamWorkflowStates } from '../../teams/hooks/use-teams';
import { useIssueLabels } from '../hooks/use-issues';

export function IssueContextMenu({ issue, onOpen, onAddSubIssue, onUpdate, onDelete, onArchive, onMoveToTop, children }: {
  issue: Issue;
  onOpen?: () => void;
  onAddSubIssue?: () => void;
  onUpdate: (data: Partial<Issue>) => void;
  onDelete: () => void;
  onArchive?: () => void;
  onMoveToTop?: () => void;
  children: ReactElement;
}) {
  const { data: workflowStates = [] } = useTeamWorkflowStates(issue.teamId);
  const { data: allLabels = [] } = useIssueLabels();
  const teamLabels = allLabels.filter(
    (l) => (!l.teamId || l.teamId === issue.teamId) && (!l.projectId || l.projectId === issue.projectId),
  );
  const currentLabelIds = (issue.labels || []).map((l) => l.id);
  const statusOptions = workflowStates.length
    ? workflowStates.filter((state) => state.isActive).map((state) => ({ key: state.key, label: state.name, renderIcon: () => renderStateIcon(state.category, state.color) }))
    : Object.entries(STATUS_CONFIG).map(([key, config]) => ({ key, label: config.label, renderIcon: config.renderIcon }));
  const copyIdentifier = async () => {
    try {
      await navigator.clipboard.writeText(issue.identifier);
      toast.success('Issue ID copied');
    } catch {
      toast.error('Unable to copy issue ID');
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild tabIndex={0} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onContextMenu={event => event.stopPropagation()}
        onKeyDown={event => {
          if (!(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return;
          event.preventDefault();
          event.stopPropagation();
          const row = event.currentTarget;
          const bounds = row.getBoundingClientRect();
          row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left + 16, clientY: bounds.top + 16 }));
        }}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56" aria-label={`Actions for ${issue.identifier}`}
        onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <ContextMenuGroup>
          <ContextMenuLabel>{issue.identifier}</ContextMenuLabel>
          <ContextMenuItem disabled={!onOpen} onSelect={onOpen}><ExternalLink />Open issue</ContextMenuItem>
          <ContextMenuItem onSelect={() => { void copyIdentifier(); }}><Copy />Copy issue ID</ContextMenuItem>
          <ContextMenuItem disabled={!onAddSubIssue} onSelect={onAddSubIssue}><GitBranchPlus />Add sub-issue</ContextMenuItem>
          {!issue.archivedAt && <ContextMenuItem disabled={!onMoveToTop} onSelect={onMoveToTop}><ArrowUpToLine />Move to top</ContextMenuItem>}
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger><ListTodo />Status</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
              <ContextMenuRadioGroup value={issue.status} onValueChange={status => {
                if (status !== issue.status) onUpdate({ status: status as Issue['status'] });
              }}>
                {statusOptions.map((option) => (
                  <ContextMenuRadioItem key={option.key} value={option.key}>{option.renderIcon()}{option.label}</ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger><SignalHigh />Priority</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
              <ContextMenuRadioGroup value={issue.priority} onValueChange={priority => {
                if (priority !== issue.priority) onUpdate({ priority: priority as Issue['priority'] });
              }}>
                {PRIORITY_CONFIG.map(item => (
                  <ContextMenuRadioItem key={item.key} value={item.key}><PriorityIcon priority={item.key} />{item.label}</ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger><Tag />Labels</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56 max-h-56 overflow-y-auto" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
              {teamLabels.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground text-center">No labels available</div>
              ) : (
                teamLabels.map((label) => {
                  const isChecked = currentLabelIds.includes(label.id);
                  return (
                    <ContextMenuCheckboxItem
                      key={label.id}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...currentLabelIds, label.id]
                          : currentLabelIds.filter((id) => id !== label.id);
                        onUpdate({ labelIds: next } as any);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="mr-2 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="truncate">{label.name}</span>
                    </ContextMenuCheckboxItem>
                  );
                })
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem disabled={!onArchive} onSelect={onArchive}>{issue.archivedAt ? <RotateCcw /> : <Archive />}{issue.archivedAt ? 'Restore issue' : 'Archive issue'}</ContextMenuItem>
          <ContextMenuItem variant="destructive" onSelect={onDelete}><Trash2 />Delete issue</ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  );
}
