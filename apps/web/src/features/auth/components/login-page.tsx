import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Field, FieldGroup, FieldLabel, Input, Separator } from '@reka/ui';
import { Mail } from 'lucide-react';
import { authClient, authErrorMessage } from '../../../lib/auth-client';
import { AuthLayout, GithubIcon, safeRedirect } from './auth-layout';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(searchParams.get('redirect'));
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState<'password' | 'magic' | 'github' | null>(null);
  const [error, setError] = React.useState<string | null>(searchParams.get('error'));
  const [magicSent, setMagicSent] = React.useState(false);
  const [unverified, setUnverified] = React.useState(false);

  const signInWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending('password'); setError(null); setUnverified(false);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    setPending(null);
    if (error) {
      if (error.status === 403) { setUnverified(true); setError('Verify your email first. We just sent you a new verification link.'); }
      else setError(authErrorMessage(error, 'Wrong email or password.'));
      return;
    }
    navigate(redirect, { replace: true });
  };
  const sendMagicLink = async () => {
    if (!email.trim()) { setError('Enter your email to receive a sign-in link.'); return; }
    setPending('magic'); setError(null);
    const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: redirect, newUserCallbackURL: redirect.startsWith('/accept-invitation/') ? redirect : '/onboarding' });
    setPending(null);
    if (error) { setError(authErrorMessage(error)); return; }
    setMagicSent(true);
  };
  const signInWithGithub = async () => {
    setPending('github'); setError(null);
    const { error } = await authClient.signIn.social({ provider: 'github', callbackURL: redirect, errorCallbackURL: '/login?error=GitHub%20sign-in%20failed.%20Try%20again.' });
    if (error) { setPending(null); setError(authErrorMessage(error)); }
  };

  return (
    <AuthLayout title="Sign in" description={<>New to REKA? <Link to={`/signup${searchParams.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-foreground underline underline-offset-4">Create an account</Link></>}>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      {magicSent ? (
        <Alert role="status"><AlertDescription>Check <strong>{email.trim()}</strong> for a sign-in link. It works once and expires in 15 minutes.</AlertDescription></Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={signInWithPassword}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="login-email">Email</FieldLabel>
              <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
            </Field>
            <Field>
              <div className="flex items-center justify-between"><FieldLabel htmlFor="login-password">Password</FieldLabel><Link to="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">Forgot password?</Link></div>
              <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
            </Field>
          </FieldGroup>
          <Button type="submit" className="w-full" disabled={pending !== null}>{pending === 'password' ? 'Signing in…' : 'Sign in'}</Button>
          {unverified && <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => authClient.sendVerificationEmail({ email: email.trim(), callbackURL: redirect })}>Resend verification email</Button>}
        </form>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />or<Separator className="flex-1" /></div>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" className="w-full justify-center gap-2" disabled={pending !== null || magicSent} onClick={sendMagicLink}><Mail className="size-4" />{pending === 'magic' ? 'Sending link…' : 'Email me a sign-in link'}</Button>
        <Button type="button" variant="outline" className="w-full justify-center gap-2" disabled={pending !== null} onClick={signInWithGithub}><GithubIcon className="size-4" />{pending === 'github' ? 'Redirecting…' : 'Continue with GitHub'}</Button>
      </div>
    </AuthLayout>
  );
}
