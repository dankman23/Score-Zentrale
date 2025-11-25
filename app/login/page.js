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

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()

      if (data.ok) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_user', JSON.stringify(data.user))
        router.push('/')
      } else {
        setError(data.error || 'Login fehlgeschlagen')
      }
    } catch (err) {
      setError('Verbindungsfehler. Bitte versuchen Sie es erneut.')
    } finally {
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
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '14px'
          }}>
            <i className="bi bi-exclamation-triangle mr-2"/>
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: '#d1d5db',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px'
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
                padding: '12px 16px',
                background: '#1f2227',
                border: '1px solid #3a3f47',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#3a3f47'}
              placeholder="Benutzername eingeben"
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              color: '#d1d5db',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px'
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
                padding: '12px 16px',
                background: '#1f2227',
                border: '1px solid #3a3f47',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#3a3f47'}
              placeholder="Passwort eingeben"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#4b5563' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s, opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
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
          marginTop: '32px',
          color: '#6b7280',
          fontSize: '13px'
        }}>
          © 2025 SCORE Schleifwerkzeuge
        </div>
      </div>
    </div>
  )
}
