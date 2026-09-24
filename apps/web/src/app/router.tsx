import * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/app-layout';
import { DashboardPage } from '../features/dashboard/components/dashboard-page';
import { IssuesPage } from '../features/issues/components/issues-page';
import { ProjectsPage } from '../features/projects/components/projects-page';
import { CyclesPage } from '../features/cycles/components/cycles-page';
import { TeamsPage } from '../features/teams/components/teams-page';
import { ClientsPage } from '../features/clients/components/clients-page';
import { InboxPage } from '../features/notifications/components/inbox-page';
import { SettingsPage } from '../features/settings/components/settings-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'my-issues', element: <IssuesPage /> },
      { path: 'issues', element: <IssuesPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
