import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@reka/ui';
import { Plus } from 'lucide-react';

export function ClientsPage() {
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Clients</h1>
          <p className="text-xs text-muted-foreground">Client accounts and associated delivery streams.</p>
        </div>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          <span>New Client</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rekasandi Internal</CardTitle>
              <Badge variant="secondary">Active</Badge>
            </div>
            <CardDescription>Internal tooling and infrastructure accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Internal projects, shared developer tools, and operational systems.</p>
          </CardContent>
          <CardFooter className="border-t border-border pt-3 text-xs text-muted-foreground">
            <span>1 active project</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
