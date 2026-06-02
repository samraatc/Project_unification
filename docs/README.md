# Documentation — Unified Marketing & E-Commerce Management Platform

**Client:** Elskov Services
**Stack:** MERN (MongoDB, Express, React, Node.js) + Next.js 14 + Tailwind + Framer Motion + GSAP + Spline
**Version:** 1.0 — May 2026

This folder is the documentation source-of-truth for the Unified Marketing & E-Commerce Management Platform. It is derived from the v2.0 Master Plan and adapted to a MERN stack with MongoDB as the primary store and a modern motion-driven UI (Neumorphism, Framer Motion, GSAP ScrollTrigger, AOS, Motion One, Spline 3D hero, parallax, sticky sections).

## Structure

```
docs/
├── 01-business/                 What we are building and why
│   ├── BRD.md                   Business requirements, drivers, stakeholders
│   ├── PRD.md                   Product requirements with FR-001..FR-016
│   └── Scope.md                 In/out of scope, change control
│
├── 02-design/
│   ├── Design-System.md         Neumorphic tokens, Framer Motion contracts,
│   │                            scroll-animation system (Intersection Observer,
│   │                            GSAP ScrollTrigger, AOS, Motion One), Spline hero,
│   │                            sidebar/mega-menu/floating header, dialogs,
│   │                            popovers, toasts, skeletons, sticky sections
│   └── Wireframes/
│       └── README.md            Wireframe inventory and Figma source
│
├── 03-technical/                How we are building it
│   ├── TRD.md                   Stack, repo layout, NFRs, standards
│   ├── Architecture.md          Six-layer view, end-to-end flow, resilience
│   ├── Database.md              MongoDB collections, indexes, transactions
│   └── API.md                   REST endpoints, RBAC, entitlement, webhooks
│
├── 04-security/
│   ├── Security-Requirements.md Controls catalogue (ASVS L2 + PCI SAQ-A + GDPR)
│   ├── Threat-Model.md          STRIDE per trust boundary; top-10 ranked
│   └── Security-Audit.md        CI scans, pen test plan, audit gates
│
├── 05-devops/
│   ├── Infrastructure.md        AWS/GCP topology, Kubernetes, Terraform
│   ├── Deployment.md            CI/CD, canary, rollback, migrations
│   └── Backup-Recovery.md       RPO 1h, RTO 4h, DR procedures
│
├── 06-testing/
│   ├── Test-Plan.md             Pyramid, contract tests, performance, security
│   ├── QA.md                    Process, defect lifecycle, regression
│   └── UAT.md                   Three rounds, participants, exit criteria
│
├── 07-monitoring/
│   ├── Logging.md               Pino, structured JSON, PII redaction, retention
│   ├── Monitoring.md            SLOs, dashboards, alerts, on-call
│   └── Incident-Response.md     Severity, roles, per-scenario playbooks
│
├── 08-legal/
│   ├── Privacy-Policy.md        GDPR-aligned draft, pending legal review
│   └── Terms.md                 SaaS ToS draft, pending legal review
│
└── 09-project-management/
    ├── Roadmap.md               8 phases, ≈12 months, dependencies, variants
    ├── Sprint-Plan.md           Team, cadence, per-phase sprint outline
    └── Risk-Register.md         25 risks with owners, mitigations, escalation
```

## Reading Order

For a quick orientation read `01-business/BRD.md` → `01-business/PRD.md` → `03-technical/Architecture.md` → `09-project-management/Roadmap.md`.

For an engineering deep-dive read `03-technical/TRD.md` → `03-technical/Database.md` → `03-technical/API.md` → `04-security/Security-Requirements.md` → `05-devops/Infrastructure.md`.

For an operations deep-dive read `07-monitoring/Monitoring.md` → `07-monitoring/Incident-Response.md` → `05-devops/Backup-Recovery.md`.

For QA and launch readiness read `06-testing/Test-Plan.md` → `06-testing/UAT.md` → `04-security/Security-Audit.md`.

## Conventions

Documents are written in prose with minimal lists; tables appear where they meaningfully aid scanning (matrices, schedules, schemas). Code samples use fenced blocks with language hints. Cross-document references use the relative path from this folder.

All documents are versioned in this repo. Material changes follow the change-control process in `01-business/Scope.md` §7. Privacy Policy and Terms drafts must be reviewed and approved by qualified legal counsel before publication.

## Open Items at v1.0

Privacy Policy and Terms require legal counsel review. Figma source link in `02-design/Wireframes/README.md` is a placeholder pending designer access. The choice between AWS and GCP for primary cloud is a Phase 0 decision. The choice between Stripe Billing as primary or co-equal recurring with eSewa/Khalti depends on tenant-mix at launch.
