# Graph Report - .  (2026-07-28)

## Corpus Check
- Corpus is ~21,406 words - fits in a single context window. You may not need a graph.

## Summary
- 132 nodes · 247 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Analytics and Reports
- Web Interface Templates
- Core Access Controls
- Deployment and Dependencies
- Database Initialization
- New Hope Brand Asset
- Ticket Notifications
- Activity Scheduling
- Password Reset Tokens
- User Password Management
- Hope Desk Brand
- Payment Records
- Application Icon

## God Nodes (most connected - your core abstractions)
1. `Hope Desk base layout` - 16 edges
2. `Ticket` - 8 edges
3. `calculate_accumulated_hours()` - 8 edges
4. `Role-aware navigation` - 8 edges
5. `month_period_bounds()` - 7 edges
6. `send_email()` - 7 edges
7. `analytics_dashboard()` - 7 edges
8. `export_services_report_pdf()` - 7 edges
9. `Analytics dashboard view` - 7 edges
10. `Ticket dashboard view` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ReportLab 4.2.5` --supports_pdf_export_for--> `Ticket dashboard view`  [INFERRED]
  requirements.txt → templates/dashboard.html
- `Flask web application` --depends_on--> `Flask 3.1.0`  [INFERRED]
  README.md → requirements.txt
- `hope_desk service` --loads_env_configuration_for--> `PostgreSQL database`  [INFERRED]
  docker-compose.yml → README.md
- `PostgreSQL database` --accessed_via--> `psycopg binary 3.2.6`  [INFERRED]
  README.md → requirements.txt
- `Docker deployment` --defined_by--> `hope_desk service`  [INFERRED]
  README.md → docker-compose.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Views inheriting the shared Hope Desk layout** — templates_activities_report_view, templates_analytics_view, templates_company_parameters_view, templates_dashboard_view, templates_edit_activity_view, templates_edit_ticket_view, templates_edit_user_view, templates_login_view, templates_new_ticket_view, templates_payments_view, templates_register_view, templates_system_modules_view, templates_ticket_detail_view, templates_users_view, templates_base_layout [EXTRACTED 1.00]
- **Ticket creation, listing, detail, editing, and activity workflow** — templates_new_ticket_view, templates_dashboard_view, templates_ticket_detail_view, templates_edit_ticket_view, templates_edit_activity_view [INFERRED 0.95]
- **Privileged administration views** — templates_company_parameters_view, templates_system_modules_view, templates_payments_view, templates_users_view, templates_base_role_navigation [INFERRED 0.95]
- **Integrated New Hope Brand Identity** — static_logo01_new_hope_brand, static_logo01_phoenix_emblem, static_logo01_nh_monogram, static_logo01_professional_management_and_development [EXTRACTED 1.00]
- **Growth and Innovation Theme** — static_logo01_network_circuit_motifs, static_logo01_growth_chart_motif, static_logo01_professional_growth, static_logo01_digital_connectivity [INFERRED 0.85]

## Communities (13 total, 1 thin omitted)

### Community 0 - "Analytics and Reports"
Cohesion: 0.17
Nodes (22): activities_report(), add_months(), analytics_dashboard(), build_activity_report(), build_services_report_rows(), calculate_accumulated_hours(), calculate_external_ticket_activity_hours(), calculate_paid_hours_for_month() (+14 more)

### Community 1 - "Web Interface Templates"
Cohesion: 0.21
Nodes (20): ReportLab 4.2.5, Activity report view, Chart.js 4.4.3, Analytics dashboard view, Bootstrap 5.3.3, Hope Desk base layout, Role-aware navigation, Company parameters view (+12 more)

### Community 2 - "Core Access Controls"
Cohesion: 0.15
Nodes (5): can_delete_by_month(), delete_activity(), delete_ticket(), manage_system_modules(), SystemModule

### Community 3 - "Deployment and Dependencies"
Cohesion: 0.16
Nodes (14): hope_desk service, external web network, Docker deployment, Email configuration, Flask web application, Hope Desk, PostgreSQL database, Initial superuser (+6 more)

### Community 4 - "Database Initialization"
Cohesion: 0.33
Nodes (9): ensure_superuser(), ensure_system_parameters(), ensure_ticket_schema_updates(), ensure_user_schema_updates(), init_db(), manage_company_parameters(), set_system_parameter(), SystemParameter (+1 more)

### Community 5 - "New Hope Brand Asset"
Cohesion: 0.24
Nodes (10): Digital Connectivity, Growth Chart Motif, Hope and Renewal, Network and Circuit Motifs, New Hope, New Hope Logo, NH Monogram, Multicolored Phoenix Emblem (+2 more)

### Community 6 - "Ticket Notifications"
Cohesion: 0.28
Nodes (9): build_ticket_external_url(), edit_ticket(), login(), new_ticket(), notify_client_new_activity(), notify_client_status_changed(), notify_technicians_new_ticket(), parse_bool_env() (+1 more)

### Community 7 - "Activity Scheduling"
Cohesion: 0.47
Nodes (5): Activity, edit_activity(), find_activity_conflict(), ticket_detail(), validate_activity_period()

### Community 8 - "Password Reset Tokens"
Cohesion: 0.33
Nodes (6): find_user_by_reset_token(), forgot_password(), hash_reset_token(), issue_password_reset_token(), send_password_reset_email(), send_user_reset_link()

### Community 9 - "User Password Management"
Cohesion: 0.40
Nodes (5): change_password(), manage_users(), reset_password(), User, validate_new_password()

### Community 10 - "Hope Desk Brand"
Cohesion: 0.40
Nodes (5): Blue, yellow, and white color palette, Stylized yellow circular emblem replacing the letter O, Hope Desk logo image, Support and community symbolism, HOPE DESK wordmark

### Community 12 - "Application Icon"
Cohesion: 0.50
Nodes (3): Central flame or leaf motif, Stylized golden circular emblem, Symmetrical upward-curving wings or arms

## Knowledge Gaps
- **17 isolated node(s):** `Ticket registration and tracking`, `Initial superuser`, `external web network`, `Flask-SQLAlchemy 3.1.1`, `Werkzeug 3.1.3` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PaymentRecord` connect `Payment Records` to `Core Access Controls`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Ticket` connect `Analytics and Reports` to `Core Access Controls`, `Ticket Notifications`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Ticket` (e.g. with `analytics_dashboard()` and `build_activity_report()`) actually correct?**
  _`Ticket` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `Role-aware navigation` (e.g. with `Activity report view` and `Analytics dashboard view`) actually correct?**
  _`Role-aware navigation` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Ticket registration and tracking`, `Initial superuser`, `external web network` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._