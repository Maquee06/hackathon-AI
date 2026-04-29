'use client';
import { useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function AIAdvisor() {
  const [loading, setLoading] = useState(false);
  const [resultHtml, setResultHtml] = useState('');
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);

  const runAI = async () => {
    setLoading(true);
    setError(null);
    setResultHtml('');
    setSource(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/analyze`, { method: 'POST' });
      const data = await res.json();

      if (data.error) throw new Error(data.message || 'Analysis failed');

      setResultHtml(data.html || 'No response from AI.');
      if (data.source) {
        setSource(data.source);
      }
    } catch (err) {
      setError('Could not reach AI advisor. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>AI Energy Advisor</h2>
        <button 
          onClick={runAI} 
          disabled={loading}
          style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
          onMouseOver={(e) => {
            if (!loading) e.currentTarget.style.background = 'rgba(0, 229, 160, 0.1)';
          }}
          onMouseOut={(e) => {
            if (!loading) e.currentTarget.style.background = 'var(--surface2)';
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze Now'}
        </button>
      </div>
      
      <div style={styles.outputArea}>
        {loading && <p style={styles.loadingText}>Analyzing your energy usage...</p>}
        {error && <span style={styles.errorText}>{error}</span>}
        {!loading && !error && resultHtml && (
          <div style={styles.resultContent}>
            <div dangerouslySetInnerHTML={{ __html: resultHtml }} />
            {source && source !== 'claude' && (
              <p style={styles.sourceText}>Source: {source} analysis</p>
            )}
          </div>
        )}
        {!loading && !error && !resultHtml && (
          <p style={styles.placeholderText}>Click "Analyze Now" for AI-powered suggestions.</p>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '24px',
    marginTop: '24px',
    width: '100%',
    maxWidth: '780px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    zIndex: 1,
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontFamily: 'var(--font-mono)',
    fontSize: '1rem',
    color: 'var(--accent-green)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  button: {
    background: 'var(--surface2)',
    color: 'var(--accent-green)',
    border: '1px solid rgba(0, 229, 160, 0.3)',
    padding: '8px 16px',
    borderRadius: '8px',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    borderColor: 'var(--border)'
  },
  outputArea: {
    background: 'var(--surface2)',
    borderRadius: '8px',
    padding: '20px',
    minHeight: '100px',
    border: '1px solid rgba(255, 255, 255, 0.03)',
  },
  loadingText: {
    color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
  },
  errorText: {
    color: 'var(--accent-red)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
  },
  placeholderText: {
    color: 'var(--muted)',
    fontSize: '0.9rem',
    fontStyle: 'italic',
  },
  resultContent: {
    color: 'var(--text)',
    fontSize: '0.95rem',
    lineHeight: '1.6',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sourceText: {
    fontSize: '0.65rem',
    color: 'var(--muted)',
    marginTop: '12px',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
  }
};
