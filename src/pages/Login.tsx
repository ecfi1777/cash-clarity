import { useState, FormEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Navigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (isSignUp) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSignUpSuccess(true);
        setSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError('Invalid email or password. Please try again.');
      }
    }
    setSubmitting(false);
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (!resetEmail.trim()) {
      setResetError('Please enter an email address.');
      return;
    }

    setResetSubmitting(true);

    // Check if a user exists with this email by attempting the reset.
    // Supabase returns success even for non-existent emails by default,
    // so we inform the user accordingly.
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setResetError('Something went wrong. Please try again.');
    } else {
      setResetMessage(
        'If an account exists with that email, a password reset link has been sent. Please check your inbox.'
      );
    }
    setResetSubmitting(false);
  };

  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[400px] border rounded-lg p-5 bg-card text-center">
          <h1 className="text-lg font-medium text-foreground mb-2">Cash Clarity</h1>
          <div className="my-6">
            <p className="text-sm text-foreground font-medium mb-2">Account created!</p>
            <p className="text-sm text-muted-foreground">
              Please check your email to verify your account before signing in.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setSignUpSuccess(false);
              setIsSignUp(false);
              setEmail('');
              setPassword('');
            }}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (forgotMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[400px] border rounded-lg p-5 bg-card">
          <h1 className="text-lg font-medium text-foreground mb-2">Cash Clarity</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter your email to receive a password reset link.
          </p>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Email</label>
              <Input
                type="email"
                required
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
            {resetMessage && <p className="text-sm text-deposit">{resetMessage}</p>}
            <Button type="submit" className="w-full" disabled={resetSubmitting}>
              {resetSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setForgotMode(false);
              setResetError('');
              setResetMessage('');
            }}
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] border rounded-lg p-5 bg-card">
        <h1 className="text-lg font-medium text-foreground mb-2">Cash Clarity</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isSignUp ? 'Create a new account' : 'Sign in to your account'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <Input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Create account' : 'Sign in')}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setForgotMode(true)}
          >
            Forgot password?
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
          >
            {isSignUp ? 'Back to sign in' : 'Create account'}
          </button>
        </div>
      </div>
    </div>
  );
}
