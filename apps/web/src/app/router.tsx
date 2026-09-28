import * as React from 'react';
import { createBrowserRouter, Navigate, useRouteError, Link } from 'react-router-dom';
import { Button } from '@reka/ui';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { AppLayout } from '../components/layout/app-layout';
import { DashboardPage } from '../features/dashboard/components/dashboard-page';
import { IssuesPage } from '../features/issues/components/issues-page';
import { ProjectsPage } from '../features/projects/components/projects-page';
import { ProjectDetailPage } from '../features/projects/components/project-detail-page';
import { CyclesPage } from '../features/cycles/components/cycles-page';
import { CycleDetailPage } from '../features/cycles/components/cycle-detail-page';
import { TeamsPage } from '../features/teams/components/teams-page';
import { TeamDetailPage } from '../features/teams/components/team-detail-page';
import { TeamIssuesPage } from '../features/teams/components/team-issues-page';
import { UsersPage } from '../features/users/components/users-page';
import { ClientsPage } from '../features/clients/components/clients-page';
import { InboxPage } from '../features/notifications/components/inbox-page';
import { SettingsPage } from '../features/settings/components/settings-page';
import { LoginPage } from '../features/auth/components/login-page';
import { NotFoundPage } from '../features/common/components/not-found-page';

function RouteErrorBoundary() {
  const error = useRouteError() as any;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="flex flex-col items-center max-w-md text-center gap-3">
        <div className="size-10 rounded-full border border-border flex items-center justify-center bg-muted/40">
          <AlertCircle className="size-5 text-rose-500" />
        </div>
        <h1 className="text-base font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-xs text-muted-foreground font-mono">
          {error?.message || error?.statusText || 'An unexpected error occurred.'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => window.location.reload()}>
            <RotateCcw className="size-3.5" />
            <span>Reload</span>
          </Button>
          <Button size="sm" asChild className="h-8 text-xs">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'my-issues', element: <IssuesPage /> },
      { path: 'issues', element: <IssuesPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'cycles/:id', element: <CycleDetailPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:id', element: <TeamDetailPage /> },
      { path: 'teams/:id/issues', element: <TeamIssuesPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
