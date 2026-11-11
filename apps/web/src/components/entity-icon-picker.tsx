import {
  BriefcaseBusiness, Boxes, Building2, CodeXml, Folder, FolderKanban,
  Layers3, Rocket, Target, Users, Users2, UsersRound, Workflow, Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { EntityIconName } from '@reka/types';

const ENTITY_ICONS: Record<EntityIconName, ComponentType<{ className?: string }>> = {
  FolderKanban,
  Folder,
  BriefcaseBusiness,
  Rocket,
  Layers3,
  CodeXml,
  Users,
  UsersRound,
  Users2,
  Zap,
  Target,
  Boxes,
  Workflow,
  Building2,
};

export function resolveEntityIcon(icon?: EntityIconName | null) {
  return (icon && ENTITY_ICONS[icon]) || FolderKanban;
}

