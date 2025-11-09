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
        {/* Subnav Active-State Sync */}
        <script dangerouslySetInnerHTML={{__html:`(function(){function sync(){var h=location.hash||'#dashboard';document.querySelectorAll('.subnav-icons a').forEach(a=>{a.classList.toggle('active', a.getAttribute('href')===h)});document.querySelectorAll('.navbar .nav-link').forEach(a=>{a.classList.toggle('active', a.getAttribute('href')===h)});}window.addEventListener('hashchange',sync);document.addEventListener('DOMContentLoaded',sync);})();`}} />
      </head>
      <body>
        {/* Navbar */}
        <nav className="navbar navbar-expand-lg navbar-dark sticky-top">
          <a className="navbar-brand d-flex align-items-center" href="#dashboard">
            <img src="https://customer-assets.emergentagent.com/job_score-zentrale/artifacts/h3bcqslm_logo_score_schleifwerkzeuge.png" alt="SCORE" className="brand-logo mr-2"/>
            <span className="brand-title">Score Zentrale</span>
          </a>
          <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navMain" aria-controls="navMain" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="navMain">
            <ul className="navbar-nav ml-auto">
              <li className="nav-item"><a className="nav-link" href="#dashboard"><i className="bi bi-speedometer2 mr-1"/>Dashboard</a></li>
              <li className="nav-item"><a className="nav-link" href="#sales"><i className="bi bi-bar-chart mr-1"/>Sales</a></li>
              <li className="nav-item"><a className="nav-link" href="#marketing"><i className="bi bi-bullseye mr-1"/>Marketing</a></li>
              <li className="nav-item"><a className="nav-link" href="#kaltakquise"><i className="bi bi-search mr-1"/>Kaltakquise</a></li>
              <li className="nav-item"><a className="nav-link" href="#warmakquise"><i className="bi bi-people mr-1"/>Warmakquise</a></li>
              <li className="nav-item"><a className="nav-link" href="#outbound"><i className="bi bi-send mr-1"/>Outbound</a></li>
            </ul>
          </div>
        </nav>

        {/* Hero + Subnav Icons – Bild abgeschwächt, Inhalte unterlegt */}
        <div className="hero-band">
          <div className="hero-bg d-flex align-items-end" style={{backgroundImage:"url('https://customer-assets.emergentagent.com/job_score-zentrale/artifacts/g4o0uovx_Header.JPG')", backgroundSize:'cover', backgroundPosition:'center'}}>
            <div className="container py-2">
              <div className="hero-shield mb-2">
                <div className="d-flex align-items-center justify-content-between">
                  <div className="small text-muted">SCORE Schleifwerkzeuge • Zentrale KPIs und Outbound-Tools</div>
                  <div className="small text-muted">Dark-Mode aktiv</div>
                </div>
              </div>
              <div className="hero-shield p-0">
                <ul className="nav nav-pills subnav-icons">
                  <li className="nav-item"><a className="nav-link" href="#dashboard"><i className="bi bi-speedometer2"/>Dashboard</a></li>
                  <li className="nav-item"><a className="nav-link" href="#sales"><i className="bi bi-bar-chart"/>Sales</a></li>
                  <li className="nav-item"><a className="nav-link" href="#marketing"><i className="bi bi-bullseye"/>Marketing</a></li>
                  <li className="nav-item"><a className="nav-link" href="#kaltakquise"><i className="bi bi-search"/>Kaltakquise</a></li>
                  <li className="nav-item"><a className="nav-link" href="#warmakquise"><i className="bi bi-people"/>Warmakquise</a></li>
                  <li className="nav-item"><a className="nav-link" href="#outbound"><i className="bi bi-send"/>Outbound</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="container py-4">
          {children}
        </div>

        {/* Bottom Tabbar (Mobile) */}
        <div className="app-tabbar d-lg-none">
          <div className="container-fluid px-0">
            <ul className="nav nav-pills nav-justified">
              <li className="nav-item"><a className="nav-link" href="#dashboard"><i className="bi bi-speedometer2 d-block"/><small>Dashboard</small></a></li>
              <li className="nav-item"><a className="nav-link" href="#sales"><i className="bi bi-bar-chart d-block"/><small>Sales</small></a></li>
              <li className="nav-item"><a className="nav-link" href="#marketing"><i className="bi bi-bullseye d-block"/><small>Marketing</small></a></li>
              <li className="nav-item"><a className="nav-link" href="#kaltakquise"><i className="bi bi-search d-block"/><small>Kaltakq.</small></a></li>
              <li className="nav-item"><a className="nav-link" href="#warmakquise"><i className="bi bi-people d-block"/><small>Warmakq.</small></a></li>
            </ul>
          </div>
        </div>

        {/* Bootstrap 4.6 JS (am Ende Body) */}
        <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  )
}
