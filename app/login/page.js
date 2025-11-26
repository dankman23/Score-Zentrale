'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // EINFACHER SCHUTZ: Nur Passwort prüfen
    const MASTER_PASSWORD = 'Score2025!'
    
    if (password === MASTER_PASSWORD) {
      localStorage.setItem('score_auth', 'authenticated')
      window.location.href = '/'
    } else {
      setError('Falsches Passwort')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1d23 0%, #2d3239 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        padding: '32px',
        maxWidth: '380px',
        width: '100%',
        border: '1px solid #dee2e6'
      }}>
        {/* SCORE Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <img 
            src="https://customer-assets.emergentagent.com/job_bullet-gen/artifacts/qsejfv1b_score-abrasives.png"
            alt="SCORE Logo"
            style={{
              maxWidth: '200px',
              width: '100%',
              height: 'auto',
              marginBottom: '12px',
              display: 'block'
            }}
          />
          <div style={{
            fontSize: '16px',
            color: '#6c757d',
            fontWeight: '300',
            letterSpacing: '2px',
            marginTop: '4px'
          }}>
            ZENTRALE
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c33',
            padding: '10px 12px',
            borderRadius: '6px',
            marginBottom: '18px',
            fontSize: '13px'
          }}>
            <i className="bi bi-exclamation-triangle mr-2"/>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              color: '#495057',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '6px'
            }}>
              Benutzername
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#fff',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                color: '#212529',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#ced4da'}
              placeholder="Benutzername"
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{
              display: 'block',
              color: '#495057',
              fontSize: '13px',
              fontWeight: '500',
              marginBottom: '6px'
            }}>
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#fff',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                color: '#212529',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#ced4da'}
              placeholder="Passwort"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              background: loading ? '#6c757d' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm mr-2"/>
                Anmeldung läuft...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right mr-2"/>
                Anmelden
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          color: '#868e96',
          fontSize: '12px'
        }}>
          © 2025 SCORE Schleifwerkzeuge
        </div>
      </div>
    </div>
  )
}
