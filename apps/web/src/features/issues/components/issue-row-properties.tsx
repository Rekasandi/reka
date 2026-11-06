import type { Issue } from '@reka/types';
import { IssueLabelsPicker } from './issue-labels-picker';
import { ProjectPicker } from './project-picker';
import { CyclePicker } from './cycle-picker';
import { AssigneePicker } from './assignee-picker';
import { SlaBadge } from './sla-badge';

export function IssueRowProperties({ issue, onUpdate }: {
  issue: Issue;
  onUpdate: (data: Partial<Issue>) => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0" onClick={event => event.stopPropagation()}>
      <IssueLabelsPicker
        teamId={issue.teamId}
        projectId={issue.projectId}
        value={(issue.labels || []).map((l) => l.id)}
        compact
        appearance="badge"
        onChange={(labelIds) => onUpdate({ labelIds } as any)}
      />
      <ProjectPicker projectId={issue.projectId ?? null} identifier={issue.identifier} compact onProjectChange={projectId => onUpdate({ projectId })} />
      <CyclePicker cycleId={issue.cycleId ?? null} teamId={issue.teamId} identifier={issue.identifier} compact onCycleChange={cycleId => onUpdate({ cycleId })} />
      <SlaBadge issue={issue} />
      <AssigneePicker size="icon" assigneeId={issue.assigneeId} onAssigneeChange={assigneeId => onUpdate({ assigneeId })} />
    </div>
  );
}
