import { Badge } from '@reka/ui';
import { Timer } from 'lucide-react';
import type { Issue } from '@reka/types';

/** Time left on the issue's SLA (set by the API for urgent/high priority when the team has SLA on). */
export function SlaBadge({ issue }: { issue: Pick<Issue, 'slaBreachesAt'> }) {
  if (!issue.slaBreachesAt) return null;
  const deadline = new Date(issue.slaBreachesAt);
  const hours = (deadline.getTime() - Date.now()) / 3_600_000;
  const left = hours <= 0 ? 'breached' : hours < 24 ? `${Math.max(1, Math.floor(hours))}h left` : `${Math.floor(hours / 24)}d left`;
  return <Badge variant={hours <= 0 ? 'destructive' : hours < 24 ? 'warning' : 'outline'} className="h-5 shrink-0 gap-1 px-1.5 text-xs tabular-nums"
    title={`SLA ${hours <= 0 ? 'breached' : 'due'} ${deadline.toLocaleString()}`} aria-label={`SLA ${left}`}>
    <Timer aria-hidden="true" className="size-3" />{left}
  </Badge>;
}
