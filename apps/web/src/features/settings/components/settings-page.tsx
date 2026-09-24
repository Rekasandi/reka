import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@reka/ui';
import { GitBranch, KeyRound, Shield } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground">Manage organization, authentication, and integrations.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="size-4" />
                <CardTitle>GitHub Integration</CardTitle>
              </div>
              <Badge variant="outline">Installed</Badge>
            </div>
            <CardDescription>
              Connect repositories to enable branch linking, commit sync, and automatic PR workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">rekasandi/reka</span>
              <span>•</span>
              <span className="text-emerald-500 font-medium">Webhook Active</span>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border pt-3 justify-end">
            <Button variant="outline" size="sm">Configure</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4" />
                <CardTitle>Passkey Authentication</CardTitle>
              </div>
              <Badge variant="secondary">WebAuthn</Badge>
            </div>
            <CardDescription>
              FIDO2 passwordless sign-in with biometrics or security keys.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">1 security key registered for gustam@rekasandi.com</p>
          </CardContent>
          <CardFooter className="border-t border-border pt-3 justify-end">
            <Button variant="outline" size="sm">Manage Keys</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
