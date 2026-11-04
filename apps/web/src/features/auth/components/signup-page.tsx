import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Field, FieldDescription, FieldGroup, FieldLabel, Input, Separator } from '@reka/ui';
import { Mail } from 'lucide-react';
import { authClient, authErrorMessage } from '../../../lib/auth-client';
import { AuthLayout, GithubIcon, safeRedirect } from './auth-layout';

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState<'password' | 'magic' | 'github' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState<'verify' | 'magic' | null>(null);

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending('password'); setError(null);
    const { error } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: redirect });
    setPending(null);
    if (error) { setError(authErrorMessage(error)); return; }
    setSent('verify');
  };
  const sendMagicLink = async () => {
    if (!email.trim()) { setError('Enter your email to receive a sign-in link.'); return; }
    setPending('magic'); setError(null);
    const { error } = await authClient.signIn.magicLink({ email: email.trim(), name: name.trim() || undefined, callbackURL: redirect, newUserCallbackURL: redirect.startsWith('/accept-invitation/') ? redirect : '/onboarding' });
    setPending(null);
    if (error) { setError(authErrorMessage(error)); return; }
    setSent('magic');
  };
  const signUpWithGithub = async () => {
    setPending('github'); setError(null);
    const { error } = await authClient.signIn.social({ provider: 'github', callbackURL: redirect, newUserCallbackURL: redirect.startsWith('/accept-invitation/') ? redirect : '/onboarding', errorCallbackURL: '/signup?error=GitHub%20sign-up%20failed.' });
    if (error) { setPending(null); setError(authErrorMessage(error)); }
  };

  return (
    <AuthLayout title="Create your account" description={<>Already have one? <Link to="/login" className="text-foreground underline underline-offset-4">Sign in</Link></>}>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      {sent === 'verify' && <Alert role="status"><AlertDescription>Almost there. We sent a verification link to <strong>{email.trim()}</strong>. Open it to activate your account; you will be signed in right away.</AlertDescription></Alert>}
      {sent === 'magic' && <Alert role="status"><AlertDescription>Check <strong>{email.trim()}</strong> for a sign-in link. It works once and expires in 15 minutes.</AlertDescription></Alert>}
      {!sent && (
        <>
          <form className="flex flex-col gap-4" onSubmit={signUp}>
            <FieldGroup>
              <Field><FieldLabel htmlFor="signup-name">Full name</FieldLabel><Input id="signup-name" autoComplete="name" required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></Field>
              <Field><FieldLabel htmlFor="signup-email">Email</FieldLabel><Input id="signup-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></Field>
              <Field>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <Input id="signup-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} />
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
            </FieldGroup>
            <Button type="submit" className="w-full" disabled={pending !== null}>{pending === 'password' ? 'Creating account…' : 'Create account'}</Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />or<Separator className="flex-1" /></div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className="w-full justify-center gap-2" disabled={pending !== null} onClick={sendMagicLink}><Mail className="size-4" />{pending === 'magic' ? 'Sending link…' : 'Continue with a sign-in link'}</Button>
            <Button type="button" variant="outline" className="w-full justify-center gap-2" disabled={pending !== null} onClick={signUpWithGithub}><GithubIcon className="size-4" />{pending === 'github' ? 'Redirecting…' : 'Continue with GitHub'}</Button>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
