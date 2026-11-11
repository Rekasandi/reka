import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Skeleton, Switch, toast } from '@reka/ui';
import { getWorkspace, updateWorkspaceMetadata, WORKSPACE_QUERY_KEY, type Workspace } from '../api/workspace.api';
import { parseWorkspaceMetadata, readNavigationSettings, WORKSPACE_NAV_ITEMS, type NavPlacement, type WorkspaceNavigationSettings } from '../lib/workspace-navigation';

export function SidebarSettings() {
  const queryClient = useQueryClient();
  const workspace = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  const settings = readNavigationSettings(workspace.data?.metadata);

  const save = useMutation({
    mutationFn: (next: WorkspaceNavigationSettings) => updateWorkspaceMetadata({ ...parseWorkspaceMetadata(workspace.data?.metadata), ...next }),
    // Apply instantly so the sidebar reflects the change while the request is in flight.
    onMutate: async next => {
      await queryClient.cancelQueries({ queryKey: WORKSPACE_QUERY_KEY });
      const previous = queryClient.getQueryData<Workspace>(WORKSPACE_QUERY_KEY);
      if (previous) queryClient.setQueryData<Workspace>(WORKSPACE_QUERY_KEY, { ...previous, metadata: { ...parseWorkspaceMetadata(previous.metadata), ...next } });
      return { previous };
    },
    onError: (_error, _next, context) => { if (context?.previous) queryClient.setQueryData(WORKSPACE_QUERY_KEY, context.previous); },
    onSuccess: () => toast.success('Sidebar updated'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY }),
  });

  const setPlacement = (to: string, placement: NavPlacement) => save.mutate({ ...settings, navigation: { ...settings.navigation, [to]: placement } });
  const setClients = (clients: boolean) => save.mutate({ ...settings, features: { ...settings.features, clients } });

  if (workspace.isLoading) return <Skeleton className="h-64 w-full" />;
  if (workspace.isError) return <Alert variant="destructive"><AlertDescription>Could not load your workspace. <Button variant="outline" size="sm" onClick={() => workspace.refetch()}>Retry</Button></AlertDescription></Alert>;

  return <div className="flex flex-col gap-8">
    <section className="flex flex-col gap-4">
      <div><h2 className="text-sm font-medium">Features</h2><p className="mt-1 text-sm text-muted-foreground">Optional pages stay hidden for everyone in the workspace until they are turned on.</p></div>
      <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
        <div className="min-w-0"><label htmlFor="feature-clients" className="text-sm font-medium">Clients</label><p className="mt-1 text-sm text-muted-foreground">Track client companies and link them to projects.</p></div>
        <Switch id="feature-clients" checked={settings.features.clients} disabled={save.isPending} onCheckedChange={setClients} />
      </div>
    </section>

    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <div><h2 className="text-sm font-medium">Workspace pages</h2><p className="mt-1 text-sm text-muted-foreground">Show a page directly in the sidebar, or tuck it under More.</p></div>
      <div className="flex flex-col divide-y divide-border">
        {WORKSPACE_NAV_ITEMS.filter(item => item.to !== '/clients' || settings.features.clients).map(item => <div key={item.to} className="flex items-center justify-between gap-4 py-3">
          <span className="flex min-w-0 items-center gap-2.5 text-sm"><item.icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />{item.label}</span>
          <Select value={settings.navigation[item.to]} disabled={save.isPending} onValueChange={value => setPlacement(item.to, value as NavPlacement)}>
            <SelectTrigger className="w-36" aria-label={`${item.label} placement`}><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="sidebar">Sidebar</SelectItem><SelectItem value="more">More</SelectItem></SelectGroup></SelectContent>
          </Select>
        </div>)}
      </div>
    </section>
    {save.isError && <Alert variant="destructive"><AlertDescription>{save.error.message}</AlertDescription></Alert>}
  </div>;
}
