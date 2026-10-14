import type { Issue } from '@reka/types';
import { IssueTypePicker } from './issue-type-picker';
import { ProjectPicker } from './project-picker';
import { CyclePicker } from './cycle-picker';
import { AssigneePicker } from './assignee-picker';

export function IssueRowProperties({ issue, onUpdate }: {
  issue: Issue;
  onUpdate: (data: Partial<Issue>) => void;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 shrink-0" onClick={event => event.stopPropagation()}>
      <IssueTypePicker type={issue.type} identifier={issue.identifier} compact onTypeChange={type => onUpdate({ type })} />
      <ProjectPicker projectId={issue.projectId ?? null} identifier={issue.identifier} compact onProjectChange={projectId => onUpdate({ projectId })} />
      <CyclePicker cycleId={issue.cycleId ?? null} teamId={issue.teamId} identifier={issue.identifier} compact onCycleChange={cycleId => onUpdate({ cycleId })} />
      <AssigneePicker size="icon" assigneeId={issue.assigneeId} onAssigneeChange={assigneeId => onUpdate({ assigneeId })} />
    </div>
  );
}
