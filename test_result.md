#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Build Score Zentrale MVP mit Dashboard-Skelett (mocked KPIs) und minimaler Outbound Suite; Bootstrap 4.6, MongoDB; keine externen Keys jetzt"
backend:
  - task: "Catch-all API + Health"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implementiert GET /api/, /api/root Health-Check über catch-all"
      - working: true
        agent: "testing"
        comment: "✅ Health endpoints GET /api/ and /api/root working correctly, returning 'Score Zentrale API online'"
  - task: "GET /api/kpis (Mock KPI Zeitreihen + Kampagnen)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Mock-Daten mit deterministischem Seed; Umsatz/Bestellungen/Marge + Ads + GA4"
      - working: true
        agent: "testing"
        comment: "✅ KPIs endpoint verified: jtl.totals.revenue, jtl.series[0].date, ads.campaigns Array, ga4.totals.users all present. Sample: JTL Revenue 43804, GA4 Users 1768, 3 Ads Campaigns"
  - task: "Prospects: GET/POST /api/prospects (Mongo, UUID, ohne _id)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Einfügen + Dedupe über Domain-RegEx, Score-Heuristik, Liste"
      - working: true
        agent: "testing"
        comment: "✅ Prospects flow working: POST creates prospects with UUID id (no _id), GET retrieves list without _id fields. Duplicate detection working. Fixed minor _id cleanup issue in POST response."
  - task: "Company Analyzer (mock) POST /api/analyze"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Heuristische Mapping auf Metall/Holz; schreibt companies + activities"
      - working: true
        agent: "testing"
        comment: "✅ Analyze endpoint working: returns productGroups (5 items), materials (3 items), hypotheses (3 items). Creates DB entries in companies and activities collections as expected."
  - task: "Mail Composer (mock) POST /api/mailer/compose"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Generiert Subject/Text/HTML; noch kein Versand"
      - working: true
        agent: "testing"
        comment: "✅ Mailer compose working: returns subject, text, html fields with proper content generation based on company, contactRole, industry, useCases, and hypotheses inputs."
  - task: "Emails Draft speichern POST /api/emails"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Speichert Draft in emails-Collection"
      - working: "NA"
        agent: "testing"
        comment: "Not tested - medium priority, not in current focus"
  - task: "Status Endpoints GET/POST /api/status"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
- task: "JTL Ping (Basic Auth)"
  implemented: true
  working: "NA"
  file: "/app/app/api/[[...path]]/route.js"
  stuck_count: 0
  priority: "high"
  needs_retesting: true
  status_history:
    - working: "NA"
      agent: "main"
      comment: "Route auf runtime=nodejs, dynamic, Basic-Auth-handling + one-off pool; zusätzlich Query-Param Fallback u/p"

        comment: "Template-Health; speichert status_checks"
      - working: true
        agent: "testing"
        comment: "✅ Status endpoints working: POST creates status records with UUID, GET retrieves list without _id fields. Tested with client_name 'qa'."
frontend:
  - task: "Dashboard mit KPI Tiles + 2 Charts (Chart.js CDN)"
    implemented: true
    working: true
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Bootstrap 4.6 Dark Theme; lädt /api/kpis"
  - task: "Outbound: Prospect Form + Table + Analyze Button + Mail Composer"
    implemented: true
    working: true
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Form POST /api/prospects; Analyze POST /api/analyze; Mailer POST /api/mailer/compose"
metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Test GET /api/kpis returns expected JSON structure"
    - "Test POST+GET /api/prospects (create + list, UUID, no _id)"
    - "Test POST /api/analyze returns productGroups and logs companies/activities"
    - "Test POST /api/mailer/compose returns subject/text/html"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Bitte Backend-Routen gemäß test_plan prüfen. Mongo steht über MONGO_URL bereit; Collections werden on-the-fly angelegt. Keine externen Keys erforderlich."
  - agent: "testing"
    message: "✅ Backend testing completed successfully! All high-priority endpoints tested and working: GET /api/kpis (verified structure), Prospects flow (POST+GET with UUID, no _id), POST /api/analyze (returns productGroups/materials/hypotheses, creates DB entries), POST /api/mailer/compose (returns subject/text/html), Status endpoints (GET+POST working). Fixed minor _id cleanup issue in POST /api/prospects response. All 5/5 core backend tests PASSED. Ready for main agent to summarize and finish."
  - task: "JTL Sales: GET /api/jtl/ping"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implementiert Ping mit hasColumn(COL_LENGTH) Check für nPosTyp"
      - working: true
        agent: "testing"
        comment: "✅ JTL Ping working: Returns 200 with ok:true, SQL connection info (server: 162.55.235.45, db: eazybusiness, hasNPosTyp: false). Fixed variable hoisting bug in route.js."
  - task: "JTL Sales: GET /api/jtl/sales/date-range"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Ermittelt min/max Rechnungsdatum basierend auf Artikelposition-Filter"
  - task: "JTL Sales: GET /api/jtl/sales/kpi"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Aggregiert Umsatz/Orders/Marge mit runtime-sicherem Artikel-Filter"
  - task: "JTL Sales: GET /api/jtl/sales/kpi/with_platform_fees"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Berechnet Marge inkl. Gebühren pauschal (20% + 1.5 EUR pro Rechnung)"
  - task: "JTL Sales: GET /api/jtl/sales/timeseries"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Zeitreihe Umsatz/Marge pro Tag"
  - task: "JTL Sales: GET /api/jtl/sales/timeseries/with_platform_fees"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Zeitreihe Umsatz + Marge inkl. Gebühren pro Tag"
  - task: "JTL Sales: GET /api/jtl/sales/platform-timeseries"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Zeitreihe Umsatz nach Plattform (CASE über Rechnungs-Felder)"
  - task: "JTL Sales: GET /api/jtl/sales/top-products"
    implemented: true
    working: "NA"
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Top-Produkte mit dynamischer Spalten-Erkennung (ArtNr, Name)"
frontend:
  - task: "Hero sichtbar + abgeschwächt (Overlay, Shield)"
    implemented: true
    working: "NA"
    file: "/app/public/styles/score-theme.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Höhe ~170px, weniger Sättigung/Helligkeit, Shields unterlegen für Logo/Text"
  - task: "Dashboard Degraded Mode (Demo) + Autorange via /date-range"
    implemented: true
    working: "NA"
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Bei 500ern und Flag NEXT_PUBLIC_DEGRADED=1: Demo-Snapshot mit Badge; Zeitraum ggf. automatisch anpassen"
metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Test JTL: GET /api/jtl/ping returns ok or clear error JSON"
    - "Test JTL: GET /api/jtl/sales/date-range returns minDate/maxDate"
    - "Test JTL: GET /api/jtl/sales/kpi & timeseries endpoints"
  stuck_tasks:
    - "JTL endpoints previously returned 404 in logs; verify routing and path matching"
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Bitte zuerst Backend-Tests für neue JTL-Endpunkte ausführen. Erwartung: 200 mit ok:true oder 500 mit ok:false, aber keine unhandled errors. Danach gebe ich Go für UI-Tests."
