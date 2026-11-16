import React from 'react';

export default function AppFooter({ attributionRef, onScrollToTop }) {
    return (
        <div
            className="netlify-attribution"
            ref={attributionRef}
            style={{
                textAlign: 'center',
                padding: '40px 10px',
                background: '#000',
                borderTop: '4px solid #00ffff',
                marginTop: '60px',
                boxShadow: '0 -20px 50px rgba(0, 255, 255, 0.2)',
                position: 'relative',
                zIndex: 5,
            }}
        >
            <div style={{ marginBottom: '30px', maxWidth: '600px', margin: '0 auto 30px auto' }}>
                <p style={{ color: '#00ffff', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '10px' }}>
                    NON-COMMERCIAL ACADEMIC TOOL
                </p>
                <p style={{ color: '#d4dde6', fontSize: '12px', lineHeight: '1.65' }}>
                    This project is a 100% academic tool created by{' '}
                    <strong>Stephen Martinez (Project Lead &amp; IB Global Politics Teacher)</strong>{' '}
                    to support scholars in the IB Global Politics 2026 Syllabus.
                    It is not a commercial product and provides free pedagogical resources.
                </p>
            </div>
            <div style={{ marginBottom: '30px' }}>
                <a
                    href="/CODE_OF_CONDUCT.md"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px',
                        color: '#ffffff',
                        background: '#7a0099',
                        padding: '12px 20px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '900',
                        letterSpacing: '2px',
                        borderRadius: '0',
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 20px rgba(255, 0, 255, 0.55)',
                    }}
                >
                    OPEN ACCESS CODE OF CONDUCT
                </a>
            </div>
            <div style={{ color: '#fff', fontSize: '10px', fontWeight: '900', letterSpacing: '2px', marginBottom: '15px' }}>
                THIS SITE IS POWERED BY NETLIFY
            </div>
            <a
                href="https://www.netlify.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    background: '#fff',
                    padding: '15px 30px',
                    borderRadius: '0',
                    display: 'inline-block',
                    border: '4px solid #00ffff',
                    boxShadow: '0 0 30px #00ffff, inset 0 0 10px #00ffff',
                }}
            >
                <img
                    src="/assets/netlify-badge-color-accent.svg"
                    width="114"
                    height="50"
                    alt="Deploys by Netlify"
                    style={{ height: '35px', width: 'auto' }}
                />
            </a>
            <div style={{ marginTop: '40px' }}>
                <button type="button" className="back-to-top" onClick={onScrollToTop}>
                    ⏶ BACK TO COMMAND CENTER
                </button>
            </div>
        </div>
    );
}
