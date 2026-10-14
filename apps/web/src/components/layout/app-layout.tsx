import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './sidebar';
import { Header } from './header';
import { CommandPalette } from '../command-palette/command-palette';
import { useKeyboardShortcuts } from '../../hooks/use-keyboard-shortcuts';
import { SidebarProvider, SidebarInset } from '@reka/ui';

export function AppLayout() {
  useKeyboardShortcuts();

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <a href="#workspace-content" className="fixed left-4 top-2 z-50 -translate-y-20 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:translate-y-0">Skip to content</a>
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Header />
        <div id="workspace-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background focus:outline-none">
          <div className="workspace-page p-4 sm:p-6">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
