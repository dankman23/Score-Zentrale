'use client'

export default function LogoutButton({ className, style, mobile = false }) {
  const handleLogout = () => {
    localStorage.removeItem('score_auth')
    window.location.href = '/login'
  }

  if (mobile) {
    return (
      <button 
        className="nav-link btn btn-link text-danger"
        onClick={handleLogout}
      >
        <i className="bi bi-box-arrow-right"/>Abmelden
      </button>
    )
  }

  return (
    <button 
      className={className}
      onClick={handleLogout}
      style={style}
    >
      <i className="bi bi-box-arrow-right mr-1"/>Abmelden
    </button>
  )
}
