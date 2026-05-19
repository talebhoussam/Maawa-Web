'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '60vh', gap: '12px',
          color: 'rgba(255,255,255,.7)', textAlign: 'center', padding: '20px'
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: '1rem', color: '#fff' }}>
            Une erreur est survenue
          </div>
          <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.5)', maxWidth: '280px' }}>
            {this.state.error?.message || 'Problème de connexion. Vérifiez votre réseau.'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 20px', background: 'var(--b500)', color: '#fff',
              border: 'none', borderRadius: '50px', cursor: 'pointer',
              fontWeight: 600, fontSize: '.82rem', marginTop: '6px'
            }}
          >
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
