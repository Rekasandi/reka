import * as React from 'react';
import { createBrowserRouter, Navigate, useLocation, useRouteError, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/use-auth';
import { Button } from '@reka/ui';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { AppLayout } from '../components/layout/app-layout';
import { DashboardPage } from '../features/dashboard/components/dashboard-page';
import { IssuesPage } from '../features/issues/components/issues-page';
import { IssueDetailPage } from '../features/issues/components/issue-detail-page';
import { TriagePage } from '../features/issues/components/triage-page';
import { ProjectsPage } from '../features/projects/components/projects-page';
import { ProjectDetailPage } from '../features/projects/components/project-detail-page';
import { DocumentsPage } from '../features/projects/components/documents-page';
import { DocumentDetailPage } from '../features/projects/components/document-detail-page';
import { CyclesPage } from '../features/cycles/components/cycles-page';
import { CycleDetailPage } from '../features/cycles/components/cycle-detail-page';
import { TeamsPage } from '../features/teams/components/teams-page';
import { TeamDetailPage } from '../features/teams/components/team-detail-page';
import { TeamIssuesPage } from '../features/teams/components/team-issues-page';
import { UsersPage } from '../features/users/components/users-page';
import { ClientsPage } from '../features/clients/components/clients-page';
import { InboxPage } from '../features/notifications/components/inbox-page';
import { SettingsPage } from '../features/settings/components/settings-page';
import { FavoritesPage } from '../features/favorites/components/favorites-page';
import { InsightsPage } from '../features/insights/components/insights-page';
import { LoginPage } from '../features/auth/components/login-page';
import { SignupPage } from '../features/auth/components/signup-page';
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/components/password-pages';
import { OnboardingPage } from '../features/auth/components/onboarding-page';
import { AcceptInvitationPage } from '../features/auth/components/accept-invitation-page';
import { WorkspaceLinkPage } from '../features/auth/components/workspace-link-page';
import { NotFoundPage } from '../features/common/components/not-found-page';

/** Signed in AND working in a workspace; otherwise sign in or finish onboarding first. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  // The API always sends `workspace` (null = none yet); fixtures that omit the key are left alone.
  if (user.workspace === null) return <Navigate to="/onboarding" replace />;
  return children;
}

/** Sign-in pages bounce an already signed-in user into the app. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <Navigate to={user.workspace === null ? '/onboarding' : '/'} replace /> : children;
}

function SignedInOnly({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  return user ? children : <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}

function RouteErrorBoundary() {
  const error = useRouteError() as any;

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center p-6 bg-background text-foreground">
      <div className="flex flex-col items-center max-w-md text-center gap-3">
        <div className="size-10 rounded-full border border-border flex items-center justify-center bg-muted/40">
          <AlertCircle className="size-5 text-destructive" />
        </div>
        <h1 className="text-base font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-xs text-muted-foreground font-mono">
          {error?.message || error?.statusText || 'An unexpected error occurred.'}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button variant="outline" className="gap-1.5" onClick={() => window.location.reload()}>
            <RotateCcw className="size-3.5" />
            <span>Reload</span>
          </Button>
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <PublicOnly><LoginPage /></PublicOnly>, errorElement: <RouteErrorBoundary /> },
  { path: '/signup', element: <PublicOnly><SignupPage /></PublicOnly>, errorElement: <RouteErrorBoundary /> },
  { path: '/forgot-password', element: <PublicOnly><ForgotPasswordPage /></PublicOnly>, errorElement: <RouteErrorBoundary /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/onboarding', element: <SignedInOnly><OnboardingPage /></SignedInOnly>, errorElement: <RouteErrorBoundary /> },
  { path: '/accept-invitation/:id', element: <AcceptInvitationPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/w/:slug/*', element: <WorkspaceLinkPage />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'inbox', element: <InboxPage /> },
      { path: 'triage', element: <TriagePage /> },
      { path: 'favorites', element: <FavoritesPage /> },
      { path: 'my-issues', element: <IssuesPage /> },
      { path: 'issues', element: <IssuesPage /> },
      { path: 'issues/:id', element: <IssueDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'documents/:id', element: <DocumentDetailPage /> },
      { path: 'cycles', element: <CyclesPage /> },
      { path: 'cycles/:id', element: <CycleDetailPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:id', element: <TeamDetailPage /> },
      { path: 'teams/:id/issues', element: <TeamIssuesPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'settings/teams/:teamId', element: <SettingsPage /> },
      { path: 'settings/:section?', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
