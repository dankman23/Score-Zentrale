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
        {/* Bootstrap 4.6 CSS */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" integrity="sha384-xOolHFLEh07PJGoPkLv1IbcEPTNtaed2xpHsD9ESMhqIYd0nLMwNLD69Npy4HI+N" crossOrigin="anonymous" />
        {/* Chart.js */}
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
      </head>
      <body className="bg-dark text-light">
        {/* Navbar */}
        <nav className="navbar navbar-expand-lg navbar-dark" style={{backgroundColor:'#0f1a24', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <a className="navbar-brand d-flex align-items-center" href="#">
            <img src="https://customer-assets.emergentagent.com/job_fcbab1d5-29db-4ab5-a5a0-eaa26448019b/artifacts/9od052qs_Score-Logo-rechteckig.png" alt="SCORE" height="36" className="mr-2"/>
            <span>Score Zentrale</span>
          </a>
        </nav>
        <div className="container py-4">
          {children}
        </div>
        {/* Bootstrap 4.6 JS */}
        <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js" crossOrigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js" crossOrigin="anonymous"></script>
      </body>
    </html>
  )
}
