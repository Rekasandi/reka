import { Badge } from '@reka/ui';
import { Check, CircleDot, Clock } from 'lucide-react';
import type { Cycle } from '../api/cycles.api';

export function CycleStatusBadge({ status }: { status: Cycle['status'] }) {
  const Icon = status === 'active' ? CircleDot : status === 'completed' ? Check : Clock;
  return <Badge variant={status === 'active' ? 'success' : 'outline'}><Icon data-icon="inline-start" />{status === 'active' ? 'Active' : status === 'completed' ? 'Completed' : 'Upcoming'}</Badge>;
}
