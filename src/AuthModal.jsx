import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabase';
import './auth.css';

export const ACCOUNT_NOT_ALLOWED_MESSAGE = 'This account is not authorized to use AI analysis or live search tools. Contact your teacher or administrator.';
export const SIGNUP_DISABLED_MESSAGE = 'New accounts are closed right now. Sign in with an existing approved email, or ask your teacher or administrator for access.';
export const SMTP_DELIVERY_REFUSED_MESSAGE = 'Sign-in emails cannot be sent to this address right now. Contact your teacher or administrator.';

const SIGNUP_REFUSAL_CODES = new Set([
    'signup_disabled',
    'otp_disabled',
    'user_not_found',
]);
const SIGNUP_REFUSAL_PATTERN = /signups?\s+not\s+allowed|signup_disabled|otp_disabled|user\s+not\s+found/i;
const SMTP_REFUSAL_CODES = new Set(['email_address_not_authorized']);
const SMTP_REFUSAL_PATTERN = /email.*not\s+authorized/i;
const RATE_LIMIT_CODES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);

export function formatAuthError(err) {
    const code = String(err?.code || '').trim().toLowerCase();
    const message = String(err?.message || '').trim();
    if (SIGNUP_REFUSAL_CODES.has(code) || SIGNUP_REFUSAL_PATTERN.test(message)) {
        return SIGNUP_DISABLED_MESSAGE;
    }
    if (SMTP_REFUSAL_CODES.has(code) || SMTP_REFUSAL_PATTERN.test(message)) {
        return SMTP_DELIVERY_REFUSED_MESSAGE;
    }
    if (RATE_LIMIT_CODES.has(code) || /rate\s*limit|too\s+many\s+requests/i.test(message)) {
        return 'Too many sign-in requests. Wait a minute and try again.';
    }
    if (code === 'otp_expired' || /otp.*expired|link.*expired/i.test(message)) {
        return 'That sign-in link expired or was already used. Enter your email for a fresh link.';
    }
    return 'Sign-in could not be completed. Check your email address and try again.';
}

export function getDisplayName(user) {
    if (!user) return null;
    const emailPart = typeof user.email === 'string' ? user.email.split('@')[0].trim() : '';
    const firstName = emailPart.split('.')[0].trim();
    if (!firstName) return 'Operator';
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}

// ── Auth Badge rendered in the header ─────────────────────────────
export function AuthBadge({ user, onSignInClick, triggerId = 'gcc-signin-trigger', className = '' }) {
    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const wrapperClass = className ? `auth-badge-wrapper ${className}` : 'auth-badge-wrapper';

    if (user) {
        const name = getDisplayName(user) || 'Operator';
        return (
            <div className={wrapperClass}>
                <div className="auth-user-badge">
                    <span className="auth-avatar" aria-hidden="true">{name.charAt(0)}</span>
                    <span className="auth-name">{name}</span>
                    <button
                        type="button"
                        className="auth-signout"
                        onClick={handleSignOut}
                        aria-label="Sign out"
                        title="Sign out"
                    >
                        ↗
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className={wrapperClass}>
            <button type="button" className="auth-signin-btn" onClick={onSignInClick} id={triggerId}>
                SIGN IN
            </button>
        </div>
    );
}

// ── Magic Link Modal ──────────────────────────────────────────────
export function AuthModal({ onClose, initialError = '' }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState(initialError || '');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const cardRef = useRef(null);
    const inputRef = useRef(null);
    const closeBtnRef = useRef(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (initialError) setError(initialError);
    }, [initialError]);

    useEffect(() => {
        if (sent) {
            closeBtnRef.current?.focus();
        }
    }, [sent]);

    useEffect(() => {
        const previousActive = typeof document !== 'undefined' ? document.activeElement : null;
        inputRef.current?.focus();

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseRef.current?.();
                return;
            }
            if (e.key === 'Tab' && cardRef.current) {
                const focusable = Array.from(
                    cardRef.current.querySelectorAll(
                        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
                    )
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const activeInside = cardRef.current.contains(document.activeElement);
                if (!activeInside) {
                    e.preventDefault();
                    (e.shiftKey ? last : first).focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('keydown', handleKey);
            if (previousActive && typeof previousActive.focus === 'function') {
                previousActive.focus();
            }
        };
    }, []);

    const handleSend = async () => {
        const trimmed = email.trim();
        if (!trimmed) { setError('Please enter your email.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Please enter a valid email address.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const redirectUrl = typeof window !== 'undefined'
                ? `${window.location.origin}${window.location.pathname}${window.location.search}`
                : undefined;
            const { error: sbError } = await supabase.auth.signInWithOtp({
                email: trimmed,
                options: { emailRedirectTo: redirectUrl, shouldCreateUser: false }
            });
            if (sbError) throw sbError;
            setSent(true);
        } catch (err) {
            setError(formatAuthError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="gcc-auth-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gcc-auth-heading"
        >
            <div className="gcc-auth-card" ref={cardRef}>
                <button ref={closeBtnRef} type="button" className="gcc-auth-close" onClick={onClose} aria-label="Close sign-in dialog">&times;</button>
                {!sent ? (
                    <>
                        <div className="gcc-auth-logo">⬢ GLOBAL COMMAND CENTER</div>
                        <h2 className="gcc-auth-title" id="gcc-auth-heading">SIGN IN</h2>
                        <p className="gcc-auth-subtitle">Enter your email to receive a magic link.</p>
                        <label className="gcc-auth-label" htmlFor="gcc-auth-email">Email address</label>
                        <input
                            ref={inputRef}
                            type="email"
                            className="gcc-auth-input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                            autoComplete="email"
                            inputMode="email"
                            id="gcc-auth-email"
                        />
                        <button type="button" className="gcc-auth-btn" onClick={handleSend} disabled={loading} id="gcc-auth-send">
                            {loading ? 'TRANSMITTING…' : 'SEND MAGIC LINK'}
                        </button>
                        {error && <p className="gcc-auth-error" role="alert">{error}</p>}
                    </>
                ) : (
                    <div className="gcc-auth-success">
                        <div className="gcc-auth-success-icon" aria-hidden="true">📬</div>
                        <h3 id="gcc-auth-heading">TRANSMISSION SENT</h3>
                        <p>A sign-in link was dispatched to <strong>{email}</strong>.<br />
                            Click it to authenticate — no password required.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── useAuth hook — call this once in App ──────────────────────────
export function useAuth() {
    const [user, setUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const errorCode = hashParams.get('error_code') || hashParams.get('error');
            if (errorCode) {
                const normalizedCode = errorCode.trim().toLowerCase();
                setAuthError(
                    SIGNUP_REFUSAL_CODES.has(normalizedCode)
                        ? SIGNUP_DISABLED_MESSAGE
                        : normalizedCode === 'otp_expired'
                            ? 'That sign-in link expired or was already used. Enter your email for a fresh link.'
                            : 'Sign-in link could not be verified. Request a new magic link below.'
                );
                setShowModal(true);
                window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
            }
        }

        supabase.auth.getUser().then(({ data: { user: initialUser } }) => setUser(initialUser));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
            if (session?.user) {
                setAuthError('');
                setShowModal(false);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const openModal = useCallback(() => setShowModal(true), []);
    const closeModal = useCallback(() => {
        setShowModal(false);
        setAuthError('');
    }, []);

    return {
        user,
        showModal,
        authError,
        openModal,
        closeModal,
    };
}
