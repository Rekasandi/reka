import { Building2, CircleDot, FolderKanban, GitBranch, Link2, SlidersHorizontal, Tags, UserRound, Users } from 'lucide-react';

export const SETTINGS_GROUPS = [
  { label: 'Personal', items: [
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal, description: 'Appearance and notifications for your account.' },
    { id: 'profile', label: 'Profile', icon: UserRound, description: 'Your identity and account details.' },
    { id: 'accounts', label: 'Connected accounts', icon: Link2, description: 'The identity you use to sign in to REKA.' },
  ] },
  { label: 'Issues', items: [
    { id: 'workflows', label: 'Workflows', icon: CircleDot, description: 'Manage issue states and access for each team.' },
    { id: 'labels', label: 'Labels', icon: Tags, description: 'Organize issues with labels from your teams.' },
  ] },
  { label: 'Projects', items: [
    { id: 'projects', label: 'Project settings', icon: FolderKanban, description: 'Choose a project to manage its properties, milestones and repositories.' },
  ] },
  { label: 'Integrations', items: [
    { id: 'github', label: 'GitHub', icon: GitBranch, description: 'Workspace installations, repositories and workflow activity.' },
  ] },
  { label: 'Administrations', adminOnly: true, items: [
    { id: 'workspace', label: 'Workspace', icon: Building2, description: 'Workspace identity and invitations.' },
    { id: 'members', label: 'Members', icon: Users, description: 'Manage workspace members and their roles.' },
  ] },
];

export const SETTINGS_ITEMS = SETTINGS_GROUPS.flatMap(group => group.items);
export const LEGACY_SETTINGS_SECTIONS: Record<string, string> = {
  appearance: 'preferences', profile: 'profile', workspace: 'workspace',
  'github-workflows': 'github', 'github-connections': 'github',
};
export const getSettingsSection = (pathname: string) => pathname.split('/')[2] || 'preferences';
