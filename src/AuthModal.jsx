import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import './auth.css';

const ALLOWED_DOMAIN = 'saschina.org';

function getDisplayName(user) {
    if (!user) return null;
    const emailPart = user.email.split('@')[0];
    const firstName = emailPart.split('.')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}

// ── Auth Badge rendered in the header ─────────────────────────────
export function AuthBadge({ user, onSignInClick }) {
    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    if (user) {
        const name = getDisplayName(user);
        return (
            <div className="auth-badge-wrapper">
                <div className="auth-user-badge">
                    <span className="auth-avatar">{name.charAt(0)}</span>
                    <span className="auth-name">{name}</span>
                    <button className="auth-signout" onClick={handleSignOut} title="Sign out">↗</button>
                </div>
            </div>
        );
    }
    return (
        <div className="auth-badge-wrapper">
            <button className="auth-signin-btn" onClick={onSignInClick} id="gcc-signin-trigger">
                SIGN IN
            </button>
        </div>
    );
}

// ── Magic Link Modal ──────────────────────────────────────────────
export function AuthModal({ onClose }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const handleSend = async () => {
        const trimmed = email.trim();
        if (!trimmed) { setError('Please enter your email.'); return; }
        const domain = trimmed.split('@')[1]?.toLowerCase();
        if (domain !== ALLOWED_DOMAIN) {
            setError(`Please use your SAS school email (@${ALLOWED_DOMAIN})`);
            return;
        }
        setError('');
        setLoading(true);
        try {
            const { error: sbError } = await supabase.auth.signInWithOtp({
                email: trimmed,
                options: { emailRedirectTo: window.location.href, shouldCreateUser: true }
            });
            if (sbError) throw sbError;
            setSent(true);
        } catch (err) {
            setError(err.message || 'Something went wrong. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="gcc-auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog" aria-modal="true" aria-label="Sign in to GCC">
            <div className="gcc-auth-card">
                <button className="gcc-auth-close" onClick={onClose} aria-label="Close">&times;</button>
                {!sent ? (
                    <>
                        <div className="gcc-auth-logo">⬢ GLOBAL COMMAND CENTER</div>
                        <h2 className="gcc-auth-title">SIGN IN</h2>
                        <p className="gcc-auth-subtitle">Enter your SAS email to receive a magic link.</p>
                        <input
                            type="email"
                            className="gcc-auth-input"
                            placeholder="yourname@saschina.org"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                            autoComplete="email"
                            inputMode="email"
                            id="gcc-auth-email"
                        />
                        <button className="gcc-auth-btn" onClick={handleSend} disabled={loading} id="gcc-auth-send">
                            {loading ? 'TRANSMITTING…' : 'SEND MAGIC LINK'}
                        </button>
                        {error && <p className="gcc-auth-error">{error}</p>}
                    </>
                ) : (
                    <div className="gcc-auth-success">
                        <div className="gcc-auth-success-icon">📬</div>
                        <h3>TRANSMISSION SENT</h3>
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

    useEffect(() => {
        // Get initial session
        supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
            if (session?.user) setShowModal(false); // close on sign-in
        });
        return () => subscription.unsubscribe();
    }, []);

    return { user, showModal, openModal: () => setShowModal(true), closeModal: () => setShowModal(false) };
}
