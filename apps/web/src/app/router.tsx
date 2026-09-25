import * as React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/app-layout';
import { DashboardPage } from '../features/dashboard/components/dashboard-page';
import { IssuesPage } from '../features/issues/components/issues-page';
import { ProjectsPage } from '../features/projects/components/projects-page';
import { ProjectDetailPage } from '../features/projects/components/project-detail-page';
import { CyclesPage } from '../features/cycles/components/cycles-page';
import { CycleDetailPage } from '../features/cycles/components/cycle-detail-page';
import { TeamsPage } from '../features/teams/components/teams-page';
import { TeamDetailPage } from '../features/teams/components/team-detail-page';
import { UsersPage } from '../features/users/components/users-page';
import { ClientsPage } from '../features/clients/components/clients-page';
import { InboxPage } from '../features/notifications/components/inbox-page';
import { SettingsPage } from '../features/settings/components/settings-page';
import { LoginPage } from '../features/auth/components/login-page';
import { NotFoundPage } from '../features/common/components/not-found-page';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
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
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'cycles/:id', element: <CycleDetailPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:id', element: <TeamDetailPage /> },
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
