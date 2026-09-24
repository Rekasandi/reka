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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          <Outlet />
        </div>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
