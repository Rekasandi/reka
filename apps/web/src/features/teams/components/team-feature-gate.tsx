import * as React from 'react';
import { useTeamFeatures } from '../hooks/use-team-features';

/** Renders children only while the team has the given feature switched on. */
export function TeamFeatureGate({ teamId, feature, children }: { teamId?: string; feature: 'cycles' | 'estimates'; children: React.ReactNode }) {
  const features = useTeamFeatures(teamId);
  return (feature === 'cycles' ? features.cyclesEnabled : features.estimatesEnabled) ? <>{children}</> : null;
}
