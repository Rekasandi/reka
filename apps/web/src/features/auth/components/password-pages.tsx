import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Field, FieldDescription, FieldGroup, FieldLabel, Input } from '@reka/ui';
import { authClient, authErrorMessage } from '../../../lib/auth-client';
import { AuthLayout } from './auth-layout';

export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setPending(true); setError(null);
    const { error } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/reset-password' });
    setPending(false);
    if (error) { setError(authErrorMessage(error)); return; }
    setSent(true);
  };
  return (
    <AuthLayout title="Reset your password" description={<>Remembered it? <Link to="/login" className="text-foreground underline underline-offset-4">Back to sign in</Link></>}>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      {sent ? <Alert role="status"><AlertDescription>If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. It expires in an hour.</AlertDescription></Alert> : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <FieldGroup><Field><FieldLabel htmlFor="forgot-email">Email</FieldLabel><Input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></Field></FieldGroup>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(searchParams.get('error') ? 'This reset link is invalid or has expired. Request a new one.' : null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) { setError('This reset link is missing its token. Request a new one.'); return; }
    setPending(true); setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) { setError(authErrorMessage(error)); return; }
    navigate('/login?error=' + encodeURIComponent('Password updated. Sign in with your new password.'), { replace: true });
  };
  return (
    <AuthLayout title="Choose a new password" description={<Link to="/forgot-password" className="text-foreground underline underline-offset-4">Request a new link</Link>}>
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <FieldGroup><Field><FieldLabel htmlFor="reset-password">New password</FieldLabel><Input id="reset-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /><FieldDescription>At least 8 characters.</FieldDescription></Field></FieldGroup>
        <Button type="submit" className="w-full" disabled={pending || !token}>{pending ? 'Saving…' : 'Set new password'}</Button>
      </form>
    </AuthLayout>
  );
}
