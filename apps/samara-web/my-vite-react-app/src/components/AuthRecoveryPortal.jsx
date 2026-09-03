import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { eipMemberAuth, isEipApiConfigured } from '../lib/eipApiAdapter';

const MIN_PASSWORD_LENGTH = 15;

function ForgotPasswordLink() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!email || !isEipApiConfigured()) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await eipMemberAuth.forgotPassword({ email });
      setMessage(result?.message || 'If the account exists, a secure reset link has been sent.');
    } catch {
      setMessage('If the account exists, a secure reset link has been sent.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="pt-1 text-center" data-pf-auth-recovery>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-clay-700 hover:text-clay-605 font-semibold underline cursor-pointer"
        >
          Forgot password?
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-sand-200 bg-sand-50/40 p-4" data-pf-auth-recovery>
      <div>
        <div className="text-xs font-bold text-bark-900">Reset Perfect Fit password</div>
        <p className="mt-1 text-[10px] leading-relaxed text-bark-500">
          Enter the email used for your Perfect Fit account. If it exists, a secure one-time reset link will be sent.
        </p>
      </div>
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email address"
        className="w-full rounded-xl border border-sand-250 bg-white px-3 py-2.5 text-xs text-bark-800 focus:border-clay-550 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-bark-900 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-sand-50 disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setMessage(''); }}
          className="rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-bark-650"
        >
          Cancel
        </button>
      </div>
      {message && <p className="text-[11px] text-clay-700" role="status">{message}</p>}
    </form>
  );
}

function ResetPasswordOverlay({ token, onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await eipMemberAuth.resetPassword({ token, password });
      setDone(true);
      setMessage('Password updated. You can now sign in to Perfect Fit.');
      onComplete?.();
    } catch (error) {
      const feedback = Array.isArray(error?.payload?.feedback) ? error.payload.feedback.join(' ') : '';
      setMessage(feedback || error?.message || error?.code || 'The reset link is invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-bark-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[4px] border border-sand-300 bg-white p-6 shadow-2xl">
        <div className="mb-5 border-b border-sand-100 pb-4">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-clay-605">Perfect Fit Bureau</div>
          <h2 className="mt-1 font-serif text-xl font-bold text-bark-900">Choose a new password</h2>
        </div>
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-bark-650">{message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-bark-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-sand-50"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-xs leading-relaxed text-bark-500">
              Use at least {MIN_PASSWORD_LENGTH} characters. This reset link is single-use and expires automatically.
            </p>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-sand-250 bg-white px-3 py-3 text-xs text-bark-800 focus:border-clay-550 focus:outline-none"
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl border border-sand-250 bg-white px-3 py-3 text-xs text-bark-800 focus:border-clay-550 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-bark-900 px-4 py-3 text-xs font-bold uppercase tracking-wider text-sand-50 disabled:opacity-60"
            >
              {busy ? 'Updating…' : 'Update password'}
            </button>
            {message && <p className="text-xs text-clay-700" role="status">{message}</p>}
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function AuthRecoveryPortal() {
  const [host, setHost] = useState(null);
  const [resetToken, setResetToken] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setResetToken(params.get('pf_reset_token') || '');
  }, []);

  useEffect(() => {
    const findHost = () => {
      setHost(document.getElementById('auth-guest-view'));
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const clearResetToken = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('pf_reset_token');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  };

  return (
    <>
      {host && !resetToken ? createPortal(<ForgotPasswordLink />, host) : null}
      {resetToken ? <ResetPasswordOverlay token={resetToken} onComplete={clearResetToken} /> : null}
    </>
  );
}
