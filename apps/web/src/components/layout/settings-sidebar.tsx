import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarRail, useSidebar } from '@reka/ui';
import { useAuthStore } from '../../stores/auth.store';
import { getSettingsSection, SETTINGS_GROUPS } from '../../features/settings/lib/settings-navigation';

export function SettingsSidebar() {
  const { pathname } = useLocation();
  const section = getSettingsSection(pathname);
  const role = useAuthStore(state => state.user?.role);
  const canAdminister = role === 'owner' || role === 'admin';
  const { setOpenMobile } = useSidebar();
  React.useEffect(() => { setOpenMobile(false); }, [pathname, setOpenMobile]);

  return <Sidebar collapsible="icon">
    <SidebarHeader><SidebarMenu>
      <SidebarMenuItem><SidebarMenuButton asChild tooltip="Back to workspace"><Link to="/dashboard"><ArrowLeft aria-hidden="true" /><span>Back to workspace</span></Link></SidebarMenuButton></SidebarMenuItem>
      <SidebarMenuItem><SidebarMenuButton asChild tooltip="Settings"><Link to="/settings"><Settings aria-hidden="true" /><span className="font-semibold">Settings</span></Link></SidebarMenuButton></SidebarMenuItem>
    </SidebarMenu></SidebarHeader>
    <SidebarContent className="reka-sidebar-nav">
      <nav aria-label="Settings navigation">
        {SETTINGS_GROUPS.filter(group => !group.adminOnly || canAdminister).map(group => <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{group.items.map(item => <SidebarMenuItem key={item.id}>
            <SidebarMenuButton asChild isActive={section === item.id} tooltip={item.label}>
              <Link to={`/settings/${item.id}`} aria-current={section === item.id ? 'page' : undefined}><item.icon aria-hidden="true" /><span>{item.label}</span></Link>
            </SidebarMenuButton>
          </SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>)}
      </nav>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>;
}
