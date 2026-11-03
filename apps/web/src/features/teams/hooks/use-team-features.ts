import { estimateScaleValues, type EstimateScale } from '@reka/types';
import { useTeams } from './use-teams';

/** Per-team feature switches. Defaults to "enabled / any number" until the team list has loaded so nothing flickers away. */
export function useTeamFeatures(teamId?: string) {
  const { data: teams } = useTeams();
  const team = teams?.find(item => item.id === teamId);
  const estimateScale = (team?.estimateScale ?? 'free') as EstimateScale;
  return {
    loaded: !!team,
    cyclesEnabled: team?.cyclesEnabled ?? true,
    estimatesEnabled: team?.estimatesEnabled ?? true,
    estimateScale,
    estimateValues: estimateScaleValues(estimateScale),
  };
}
