import './globals.css'

export const metadata = {
  title: 'SCORE Zentrale',
  description: 'Dashboard & Outbound Suite für SCORE Schleifwerkzeuge',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Bootstrap 4.6 CSS (CDN) */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" />
        {/* Bootstrap Icons */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />
        {/* SCORE Theme (nach Bootstrap) */}
        <link rel="stylesheet" href="/styles/score-theme.css" />
        {/* Chart.js */}
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        {/* Chart.js Dark Defaults auf Basis CSS-Variablen */}
        <script dangerouslySetInnerHTML={{__html:`(function(){try{var css=getComputedStyle(document.documentElement);if(window.Chart){Chart.defaults.color=css.getPropertyValue('--txt').trim();Chart.defaults.borderColor=css.getPropertyValue('--line').trim();}}catch(e){}})();`}} />
      </head>
      <body>
        {/* Navbar */}
        <nav className="navbar navbar-expand-lg navbar-dark sticky-top">
          <a className="navbar-brand d-flex align-items-center" href="#dashboard">
            <img src="https://customer-assets.emergentagent.com/job_fcbab1d5-29db-4ab5-a5a0-eaa26448019b/artifacts/9od052qs_Score-Logo-rechteckig.png" alt="SCORE" height="48" className="mr-2"/>
            <span>Score Zentrale</span>
          </a>
          <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navMain" aria-controls="navMain" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navMain">
            <ul className="navbar-nav mr-auto">
              <li className="nav-item"><a className="nav-link" href="#dashboard">Dashboard</a></li>
              <li className="nav-item"><a className="nav-link" href="#outbound">Outbound</a></li>
              <li className="nav-item"><a className="nav-link" href="#sales">Sales</a></li>
              <li className="nav-item"><a className="nav-link" href="#marketing">Marketing</a></li>
              <li className="nav-item"><a className="nav-link" href="#settings">Settings</a></li>
            </ul>
            <form className="form-inline my-2 my-lg-0">
              <input className="form-control form-control-sm mr-2" type="date" />
              <input className="form-control form-control-sm" type="date" />
            </form>
          </div>
        </nav>

        {/* Hero-Leiste */}
        <div className="hero-band py-2">
          <div className="container d-flex align-items-center justify-content-between">
            <div className="small text-muted">SCORE Schleifwerkzeuge • Zentrale KPIs und Outbound-Tools</div>
            <div className="small text-muted">Dark-Mode aktiv</div>
          </div>
        </div>

        <div className="container py-4">
          {children}
        </div>

        {/* Bootstrap 4.6 JS (am Ende Body) */}
        <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  )
}
