import './globals.css'
import LogoutButton from '../components/LogoutButton'

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
        <link rel="stylesheet" href="/styles/score-theme.css?v=2" />
        {/* CRITICAL: Force Dark Mode - Inline styles always loaded */}
        <style dangerouslySetInnerHTML={{__html: `
          :root {
            --app-bg: #111418;
            --surf: #171b21;
            --card: #1d232b;
            --line: #2b3340;
            --txt: #e7ecf2;
            --muted: #a3afc1;
            --accent: #F6B10A;
          }
          html, body {
            background: var(--app-bg) !important;
            color: var(--txt) !important;
            min-height: 100vh;
          }
          .navbar {
            background: rgba(17, 20, 24, 0.92) !important;
            border-bottom: 1px solid var(--line);
            padding: 0.5rem 1rem !important;
            min-height: 50px;
          }
          .navbar .nav-link {
            padding: 0.4rem 0.8rem !important;
            font-size: 0.9rem;
            color: #ffffff !important;
          }
          .subnav-icons .nav-link {
            color: #ffffff !important;
            font-weight: 500;
          }
          .subnav-icons .nav-link.active,
          .subnav-icons .nav-link:hover {
            color: #F6B10A !important;
            background: rgba(246, 177, 10, 0.15) !important;
          }
          .card {
            background: var(--card) !important;
            border: 1px solid var(--line);
          }
          .form-control, .form-select {
            background: #141a20 !important;
            border-color: #2a3340 !important;
            color: var(--txt) !important;
          }
          .text-muted {
            color: var(--muted) !important;
          }
          .btn-primary {
            background: var(--accent) !important;
            border-color: #e6a908 !important;
            color: #111 !important;
          }
          /* Datum-Picker Icon weiß machen */
          input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
            cursor: pointer;
          }
          input[type="datetime-local"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
            cursor: pointer;
          }
        `}} />
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
            <img src="https://customer-assets.emergentagent.com/job_score-zentrale/artifacts/h3bcqslm_logo_score_schleifwerkzeuge.png" alt="SCORE" className="brand-logo mr-2" style={{height: '28px', width: 'auto'}}/>
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
              <li className="nav-item"><a className="nav-link" href="#glossar"><i className="bi bi-book mr-1"/>Glossar</a></li>
              <li className="nav-item dropdown">
                <a className="nav-link dropdown-toggle" href="#outbound" id="outboundDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                  <i className="bi bi-send mr-1"/>Outbound
                </a>
                <div className="dropdown-menu" aria-labelledby="outboundDropdown">
                  <a className="dropdown-item" href="#outbound"><i className="bi bi-list-ul mr-2"/>Prospect Management</a>
                  <a className="dropdown-item" href="#kaltakquise"><i className="bi bi-search mr-2"/>Kaltakquise</a>
                  <a className="dropdown-item" href="#warmakquise"><i className="bi bi-people mr-2"/>Warmakquise</a>
                </div>
              </li>
              <li className="nav-item"><a className="nav-link" href="#produkte"><i className="bi bi-box-seam mr-1"/>Produkte</a></li>
              <li className="nav-item"><a className="nav-link" href="#preise"><i className="bi bi-calculator mr-1"/>Preise</a></li>
              <li className="nav-item"><a className="nav-link" href="#orga"><i className="bi bi-calendar-check mr-1"/>Orga</a></li>
              <li className="nav-item"><a className="nav-link" href="#fibu"><i className="bi bi-receipt-cutoff mr-1"/>FIBU</a></li>
              <li className="nav-item">
                <a 
                  className="nav-link logout-btn" 
                  href="/login"
                  style={{cursor: 'pointer'}}
                >
                  <i className="bi bi-box-arrow-right mr-1"/>Abmelden
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Kompakte Navigation mit dünnem Hintergrundbild */}
        <div className="hero-band" style={{minHeight: '50px'}}>
          <div className="hero-bg d-flex align-items-center" style={{backgroundImage:"url('https://customer-assets.emergentagent.com/job_score-zentrale/artifacts/g4o0uovx_Header.JPG')", backgroundSize:'cover', backgroundPosition:'center', minHeight: '50px', maxHeight: '50px'}}>
            <div className="container">
              <div className="hero-shield p-0">
                <ul className="nav nav-pills subnav-icons" style={{margin: 0, padding: '5px 0', flexWrap: 'nowrap', gap: '4px'}}>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#dashboard" style={{fontSize: '0.85rem'}}><i className="bi bi-speedometer2 mr-1"/>Dashboard</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#sales" style={{fontSize: '0.85rem'}}><i className="bi bi-bar-chart mr-1"/>Sales</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#marketing" style={{fontSize: '0.85rem'}}><i className="bi bi-bullseye mr-1"/>Marketing</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#glossar" style={{fontSize: '0.85rem'}}><i className="bi bi-book mr-1"/>Glossar</a></li>
                  <li className="nav-item dropdown">
                    <a className="nav-link dropdown-toggle py-1 px-2" href="#outbound" role="button" data-toggle="dropdown" style={{fontSize: '0.85rem'}}>
                      <i className="bi bi-send mr-1"/>Outbound
                    </a>
                    <div className="dropdown-menu">
                      <a className="dropdown-item" href="#outbound">Prospect Management</a>
                      <a className="dropdown-item" href="#kaltakquise">Kaltakquise</a>
                      <a className="dropdown-item" href="#warmakquise">Warmakquise</a>
                    </div>
                  </li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#produkte" style={{fontSize: '0.85rem'}}><i className="bi bi-box-seam mr-1"/>Produkte</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#preise" style={{fontSize: '0.85rem'}}><i className="bi bi-calculator mr-1"/>Preise</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#orga" style={{fontSize: '0.85rem'}}><i className="bi bi-calendar-check mr-1"/>Orga</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2" href="#fibu" style={{fontSize: '0.85rem'}}><i className="bi bi-receipt-cutoff mr-1"/>FIBU</a></li>
                  <li className="nav-item"><a className="nav-link py-1 px-2 logout-btn-hero" href="/login" style={{fontSize: '0.85rem', color: '#ff6b6b !important'}}><i className="bi bi-box-arrow-right mr-1"/>Abmelden</a></li>
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
              <li className="nav-item"><a className="nav-link" href="#produkte"><i className="bi bi-box-seam d-block"/><small>Produkte</small></a></li>
            </ul>
          </div>
        </div>

        {/* Bootstrap 4.6 JS (am Ende Body) */}
        <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js"></script>
        
        {/* Logout Button Handler */}
        <script dangerouslySetInnerHTML={{__html: `
          document.addEventListener('DOMContentLoaded', function() {
            const logoutBtn = document.querySelector('.logout-btn');
            if (logoutBtn) {
              logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                localStorage.removeItem('score_auth');
                window.location.href = '/login';
              });
            }
          });
        `}} />
      </body>
    </html>
  )
}
