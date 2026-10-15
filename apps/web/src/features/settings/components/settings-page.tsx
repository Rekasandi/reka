import * as React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Alert, AlertDescription, Avatar, AvatarFallback, AvatarImage, Badge, Button, Field, FieldGroup, FieldLabel, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@reka/ui';
import { ExternalLink } from 'lucide-react';
import { useAuthStore } from '../../../stores/auth.store';
import { useTheme } from '../../../components/theme/theme-provider';
import { NotificationPreferencesDialog } from '../../notifications/components/notification-preferences-dialog';
import { UsersPage } from '../../users/components/users-page';
import { GithubIcon, GithubSettings } from './github-settings';
import { WorkspaceSettings } from './workspace-settings';
import { IssueSettings, ProjectSettings } from './settings-resource-pages';
import { getSettingsSection, LEGACY_SETTINGS_SECTIONS, SETTINGS_GROUPS, SETTINGS_ITEMS } from '../lib/settings-navigation';

function Preferences() {
  const { theme, setTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  return <div className="flex flex-col gap-8">
    <section className="flex flex-col gap-4"><div><h2 className="text-sm font-medium">Appearance</h2><p className="mt-1 text-sm text-muted-foreground">Choose a theme for this browser. System follows your device preference.</p></div>
      <FieldGroup className="max-w-sm"><Field><FieldLabel htmlFor="appearance-theme">Theme</FieldLabel>
        <Select value={theme} onValueChange={value => setTheme(value as 'dark' | 'light' | 'system')}><SelectTrigger id="appearance-theme" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="dark">Dark</SelectItem><SelectItem value="light">Light</SelectItem><SelectItem value="system">System</SelectItem></SelectGroup></SelectContent></Select>
      </Field></FieldGroup>
    </section>
    <section className="flex flex-col items-start gap-3 border-t border-border pt-6"><div><h2 className="text-sm font-medium">Notifications</h2><p className="mt-1 text-sm text-muted-foreground">Choose which events appear in your Inbox.</p></div><Button variant="outline" onClick={() => setNotificationsOpen(true)}>Notification preferences</Button></section>
    {notificationsOpen && <NotificationPreferencesDialog open onOpenChange={setNotificationsOpen} />}
  </div>;
}

function Profile() {
  const user = useAuthStore(state => state.user);
  return <section className="flex flex-col gap-6">
    <div className="flex items-center gap-4"><Avatar className="size-14"><AvatarImage src={user?.avatarUrl || undefined} alt={user?.name} /><AvatarFallback>{user?.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback></Avatar><p className="text-sm text-muted-foreground">Your profile is supplied by your signed-in account.</p></div>
    <dl className="flex flex-col divide-y divide-border">{[['Full name', user?.name], ['Email address', user?.email], ['GitHub username', user?.githubUsername ? `@${user.githubUsername}` : null]].map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[180px_minmax(0,1fr)]"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-all text-sm">{value || 'Not available'}</dd></div>)}</dl>
  </section>;
}

function ConnectedAccounts() {
  const username = useAuthStore(state => state.user?.githubUsername);
  return <section className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div className="flex min-w-0 items-center gap-3"><GithubIcon className="size-5 shrink-0" /><div><h2 className="text-sm font-medium">GitHub</h2><p className="text-sm text-muted-foreground">{username ? `@${username}` : 'No verified GitHub identity available'}</p></div></div>{username && <Badge variant="success">Connected</Badge>}</div>
    <p className="text-sm text-muted-foreground">This is your sign-in identity. Workspace GitHub App installations are managed separately under Integrations.</p>
    <div className="flex flex-wrap gap-2">{username && <Button variant="outline" size="sm" asChild><a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer">View on GitHub<ExternalLink data-icon="inline-end" /></a></Button>}<Button variant="outline" size="sm" asChild><Link to="/settings/github">GitHub integration</Link></Button></div>
  </section>;
}

export function SettingsPage() {
  const location = useLocation();
  const section = getSettingsSection(location.pathname);
  const item = SETTINGS_ITEMS.find(item => item.id === section);
  const role = useAuthStore(state => state.user?.role);
  const canAdminister = role === 'owner' || role === 'admin';
  const adminOnly = SETTINGS_GROUPS.some(group => group.adminOnly && group.items.some(item => item.id === section));
  React.useEffect(() => {
    const previous = document.title;
    document.title = `${item?.label || 'Settings'} | REKA`;
    return () => { document.title = previous; };
  }, [item?.label]);
  if (location.pathname === '/settings') {
    const legacy = LEGACY_SETTINGS_SECTIONS[location.hash.slice(1)] || (new URLSearchParams(location.search).has('github') ? 'github' : null);
    if (legacy) return <Navigate to={`/settings/${legacy}${location.search}`} replace />;
  }
  if (!item) return <Alert><AlertDescription>Settings page not found. <Link to="/settings">Back to settings</Link></AlertDescription></Alert>;
  if (adminOnly && !canAdminister) return <div className="flex flex-col gap-4"><h1 className="text-xl font-semibold">{item.label}</h1><Alert><AlertDescription>Only workspace owners and admins can manage these settings.</AlertDescription></Alert></div>;
  if (section === 'members') return <UsersPage />;
  return <div className="flex w-full max-w-4xl flex-col gap-8 pb-10">
    <header className="flex flex-col gap-2 border-b border-border pb-5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.label}</h1><p className="text-sm text-muted-foreground">{item.description}</p></header>
    {section === 'preferences' && <Preferences />}
    {section === 'profile' && <Profile />}
    {section === 'accounts' && <ConnectedAccounts />}
    {['workflows', 'labels'].includes(section) && <IssueSettings key={section} labels={section === 'labels'} />}
    {section === 'projects' && <ProjectSettings />}
    {section === 'github' && <GithubSettings />}
    {section === 'workspace' && <div className="settings-sections"><WorkspaceSettings /></div>}
  </div>;
}
