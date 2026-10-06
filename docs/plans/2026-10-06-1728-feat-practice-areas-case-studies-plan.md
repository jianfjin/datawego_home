---
title: "feat: Add case studies to Practice Areas + KVK-nummer footer"
type: feat
date: 2026-10-06
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# feat: Add case studies to Practice Areas + KVK-nummer footer

## Goal Capsule

- **Objective:** Prove the three practice areas with real work — four linked case studies inside the Capabilities section, plus the company KVK registration number in the footer.
- **Open blockers:** None.
- **Execution profile:** Static single-file HTML/CSS/JS edit plus a small deploy-script fix; verification is browser/serve smoke, not unit tests.

## Product Contract

### Summary

Add a "Case studies" band below the three feature cards in the Practice Areas (Capabilities) section of `datawego-company-site.html`, covering Pharm Platform and the EHR ETL pipeline (Data platforms), the Marketing Research Swarm (AI-powered solutions), and the EHR Transform Platform architecture (Cloud & enterprise software). Each card carries a marketing-level summary, tech chips, and a link opening the self-contained architecture diagram in `docs/` in a new tab. Add `KVK-nummer: 42077839` to the footer.

### Problem Frame

The site currently claims three areas of work with generic capability bullets and no evidence of shipped work. The user's screenshot (`resources/datawego1.png`) marks the whitespace under the three-card grid as the insertion point. Four architecture diagrams already exist as standalone pages under `docs/` (~800KB each, self-contained); the source project docs supply the prose to summarize. The Dutch translation layer (runtime dictionary swap) and the Cloudflare Pages deploy path (`deploy.js` copies only `index.html` + `resources/`) both need to be kept in sync — otherwise new copy renders English-only and diagram links 404 in production.

### Requirements

- R1: A case-studies block appears inside `#capabilities`, below the three-card grid, visually consistent with existing section patterns (eyebrow + heading, cards, chips).
- R2: "Data platforms" is evidenced by two studies: Pharm Platform (link: `docs/pharm-platform.html`) and the EHR ETL pipeline with mapping pre-pass (link: `docs/etl-dataflow-with-prepass.html`).
- R3: "AI-powered solutions" is evidenced by the Marketing Research Swarm study (link: `docs/marketing-research-swarm.html`).
- R4: "Cloud & enterprise software" is evidenced by the EHR Transform Platform architecture study (link: `docs/ehr-platform-architecture-with-prepass.html`).
- R5: Each study card shows which practice area it belongs to, a 2–4 sentence summary distilled from its source docs, and opens its diagram page in a new tab.
- R6: All new English copy has matching Dutch entries in the in-page `NL` dictionary so EN/NL toggle stays at parity (exception: the KVK-nummer line per R7 — already Dutch, kept untranslated by design).
- R7: The footer displays "KVK-nummer: 42077839" (Dutch: same string — it is a Dutch-language label by nature).
- R8: Deployed site serves the four diagram pages (no 404 on any case-study link in production).

### Key Decisions

- Diagrams are **linked, not embedded** — the four files total 3.3MB; the site page stays a single ~95KB HTML file. Chosen over base64 iframe embedding.
- Case studies go in a **dedicated band below the three cards** (each study tagged with its area) rather than appended inside the feature cards — four studies do not map 1:1 to three cards, and the "Three areas of work" framing stays intact. User confirmed.
- Summaries are **marketing-level prose distilled from engineering plan docs**, not technical detail. User confirmed.

### Scope Boundaries

- In: `datawego-company-site.html` (markup, CSS if needed, NL dictionary), `deploy.js` (copy the four diagram pages to `dist/docs/`).
- Out: editing the four diagram pages under `docs/`; deploying (user runs `deploy.js` when ready); nav-menu changes; other sections of the site.

## Planning Contract

### Key Technical Decisions

- **KTD1 — Card pattern: reuse `.feature card` + `.chip-row`.** The case-studies band uses the existing grid-3/grid-2 card idiom (feature mark optional), a `.chip-row` of technology chips, and a `link-inline` "View architecture" anchor (arrow, if wanted, supplied via CSS `::after` like the existing `.btn-arrow` convention — never inside the text node, which is the dictionary key) with `target="_blank" rel="noopener"`. No new CSS classes except a `.card-tag` micro-style (or reuse of `.meta` eyebrow style) for the practice-area label.
- **KTD2 — Layout: a "Case studies" eyebrow (rendered uppercase by the `.eyebrow` class's `text-transform`; the dictionary key is the authored text) + one `grid-3` row of 3 cards, with the two Data-platform studies as the first two cards** (4th card wraps in the same grid; `grid-template-columns: repeat(3, 1fr)` leaves one card on row two — acceptable and symmetric enough, mirrors the lifecycle flow-wrap behavior). Alternative considered: 2×2 grid via inline `grid-template-columns: repeat(2, 1fr)`; choose 2×2 if the 3+1 wrap looks unbalanced in the browser — this is an execution-time eyeball call.
- **KTD3 — Translation: dictionary keys are normalized visible text strings; keys must match the authored text exactly.** Add entries under a `/* case studies */` comment block next to the existing `/* capabilities */` block. Words appearing in several cards ("View architecture", "Data platforms") already exist or need `tag|text` disambiguation keys only if collision produces wrong Dutch — check each new string against existing keys first (`grep` in the dictionary).
- **KTD4 — Deploy parity: `deploy.js` gains an explicit four-file copy step** — each `docs/<name>.html` copied to `dist/docs/` with a per-file `fs.existsSync` guard, mirroring the style of the existing `resources/` block. NOT a blanket `docs/` sync: `docs/` also holds `plans/` and design notes that must not ship publicly. The four diagram HTML files are currently **untracked** in git — they must be committed for the repo (and thus the deploy source) to be complete.

### Assumptions

- Case-study titles use neutral, non-client-identifying names ("Pharm Platform", "EHR ETL Pipeline", …) — the source projects are internal demos/open builds, no customer references to clear.
- KVK number is static text in the English markup; since "KVK-nummer" is already Dutch, no dictionary entry is needed beyond leaving it untranslated (the swap function keeps unmatched text as-is).

### Sources and Research

- User screenshot `resources/datawego1.png` confirms the insertion point below the three cards.
- Site structure: `datawego-company-site.html` — capabilities section lines ~686-737, NL dictionary ~1134+, footer ~1062-1118, deploy copy step in `deploy.js`.
- Pharm Platform summary: `~/projects/pharm_platform/docs/plans/2026-05-03-001-feat-ai-pharmacy-platform-phased-build-plan.md` (phased build: ingestion of Eurostat/CTIS/ChEMBL open data, canonical drug identity, analytics, forecasting, knowledge-graph gate, no PHI).
- ETL pipeline summary: `~/projects/ehr-transform/docs/plans/2026-08-06-001-feat-dagster-ducklake-fhir-omop-parquet-plan.md` (Dagster-orchestrated, DuckLake-managed Parquet snapshots, independent FHIR/OMOP layer advancement, degradation without data loss) and `2026-07-29-001-feat-ducklake-analytical-layer-plan.md` (DuckLake 1.0 analytical layer, atomic snapshots, reversible storage boundary).
- Swarm summary: `~/projects/crewai_demo/marketing_research_swarm/project_swarm_intelligence_presentation.md` (LangGraph multi-agent research team, RAG-grounded agent selection, shared-blackboard context engineering, persistent caching of analyses).
- Cloud/EHR platform summary: `~/projects/ehr-transform/docs/plans/2026-06-29-001-docs-health-data-platform-layers-plan.md` (governance-first layers: immutable raw zone + control plane; FHIR primary-use, OMOP pseudonymized secondary-use on lakehouse; secure processing environment with vetted outputs; EHDS-aligned).
- Diagram page titles: "Pharm Platform Architecture", "EHR ETL Pipeline — Data Flow (with Mapping Pre-pass)", "marketing_research_swarm Architecture" → present as "Marketing Research Swarm Architecture", "EHR Transform Platform — Architecture (with Mapping Pre-pass)".

## Implementation Units

### U1. Case-studies band markup in the Capabilities section

**Goal:** Add the four case-study cards inside `#capabilities` after the `.grid-3` feature row.

**Requirements:** R1, R2, R3, R4, R5.

**Dependencies:** none.

**Files:**
- `datawego-company-site.html` (capabilities section, after the closing `</div>` of the feature `grid-3`)

**Approach:**
1. Wrapper `<div>` with `<p class="eyebrow">Case studies</p>` and an `<h3 class="h3">` proof line (e.g. "Proof of work in each area.").
2. One card grid (class `grid-3`; see KTD2 for the 2×2 fallback) with four cards, each: `<span class="meta">` practice-area tag, `<h3 class="h3">` title, summary `<p>` (2–4 sentences, copy below), `<div class="chip-row">` tech chips, `<a class="link-inline" href="docs/…html" target="_blank" rel="noopener">View architecture</a>`.
3. Copy `data-od-id` attributes on every new element (`case-studies`, `case-study-card-pharm`, etc.) matching the page's existing convention.
4. Card copy (English, authored markup):
   - **Pharm Platform** (Data platforms): open-data pharmacy intelligence platform — phased build from Eurostat, CTIS and ChEMBL ingestion to canonical drug identity, analytics-ready data models, forecasting and a knowledge-graph decision gate. No patient-level data. Chips: `Python`, `Open data`, `Forecasting`, `Knowledge graph`.
   - **EHR ETL Pipeline** (Data platforms): deterministic mapping pre-pass plus Dagster-orchestrated conversion of non-compliant raw EHR CSVs into governed FHIR R4 and OMOP CDM 5.4 outputs, published as atomic DuckLake Parquet snapshots where each layer advances independently. Chips: `Dagster`, `DuckLake`, `FHIR R4`, `OMOP CDM`.
   - **Marketing Research Swarm** (AI-powered solutions): LangGraph multi-agent research team that plans, retrieves and synthesizes market evidence with RAG-grounded agent selection, a shared blackboard for context and persistent caching of analyses to cut token cost. Chips: `LangGraph`, `RAG`, `Context engineering`.
   - **EHR Transform Platform** (Cloud & enterprise software): governance-first health data architecture — immutable raw landing zone, cross-cutting control plane for consent, access policy and audit, FHIR for identifiable primary-use exchange, pseudonymized OMOP analytics on a lakehouse and a secure processing environment for vetted research outputs, aligned with EHDS. Chips: `EHDS`, `HL7 FHIR`, `OMOP`, `Lakehouse`.

**Execution note:** Static markup — verify in a browser, not with tests.

**Test scenarios:**
- Test expectation: none — static markup; verified by browser smoke in U4.

**Patterns to follow:** existing `.feature card` + `.chip-row` + `link-inline` markup in the same section; `data-od-id` naming of neighbors.

**Verification:** The three-card row is unchanged; four new cards render below it; each link resolves to a local `docs/*.html` file that opens in a new tab.

### U2. Dutch dictionary entries for all new copy

**Goal:** Every new English string renders Dutch in `nl` mode via the runtime swap.

**Requirements:** R6.

**Dependencies:** U1 (strings must match the authored markup exactly).

**Files:**
- `datawego-company-site.html` (NL dictionary, new `/* case studies */` block after the `/* capabilities */` block)

**Approach:**
1. Collect the exact normalized visible strings introduced by U1 (title, headings, card titles are language-neutral product names — leave "Pharm Platform", "Dagster", etc. untranslated where they are proper names; summary sentences, area tags, "Case studies", "View architecture" all get entries).
2. Grep each key against the existing dictionary for collisions first; a shared string ("Data platforms", "View architecture") needs one entry unless context differs, in which case use the `tag|text` key form already supported by `lookup()`.
3. Card area tags reuse existing keys `Data platforms`/`AI-powered solutions`/`Cloud & enterprise software` — already in the dictionary (lines ~1192-1204); do not duplicate.

**Test scenarios:**
- Switch EN→NL with `localStorage` cleared: every sentence inside the case-studies band shows Dutch; no English sentence remains except proper names.
- Switch back NL→EN: original English restored verbatim (no mutation after round-trip).
- A dictionary key that normalizes identical to an existing unrelated key (e.g. "Model"-style collision) does not mistranslate either site — disambiguate with `tag|text`.

**Verification:** In `nl` mode nothing in the new band is untranslated prose; console shows no JS errors from the collect/swap pass.

### U3. Footer KVK-nummer

**Goal:** Show the Chamber of Commerce number at the bottom of the page.

**Requirements:** R7.

**Dependencies:** none.

**Files:**
- `datawego-company-site.html` (footer `.foot-bottom` row)

**Approach:** Place `<span class="meta">KVK-nummer: 42077839</span>` in the `.foot-bottom` row next to the copyright line (bottom of the page, per the request). The string is already Dutch; no dictionary entry needed (unmatched text keeps source — confirm it renders identically in both languages).

**Test scenarios:**
- Both language modes: the KVK line is visible in the footer bottom row and does not break the flex wrap at narrow widths.

**Verification:** Footer shows "© 2026 DataWeGo · Data infrastructure & analytics" and "KVK-nummer: 42077839" without layout breakage at 375px and 1440px.

### U4. Serve diagram pages in deployment

**Goal:** Case-study links work on Cloudflare Pages, not just from the local filesystem.

**Requirements:** R8.

**Dependencies:** U1 (links exist).

**Files:**
- `deploy.js`
- `docs/pharm-platform.html`, `docs/etl-dataflow-with-prepass.html`, `docs/marketing-research-swarm.html`, `docs/ehr-platform-architecture-with-prepass.html` (currently untracked — commit them)

**Approach:**
1. Add an explicit four-file copy step to `main()` (NOT a blanket `docs/` sync — `docs/` also holds this plans directory and design notes that must not ship): copy each `docs/<name>.html` into `dist/docs/<name>.html`, guarded by `fs.existsSync` per file.
2. Commit the four diagram files (they are the deploy source; untracked files will not reach CI/other machines).

**Execution note:** Do NOT invoke `node deploy.js` for verification — its `main()` runs the wrangler production deploy right after the dist step. Extract or replicate only the dist-step copy logic in a scratch script, then serve `dist/` (e.g. `python3 -m http.server`) and curl each linked path for HTTP 200. Real deploys stay user-initiated.

**Test scenarios:**
- After the dist step, `dist/docs/pharm-platform.html` exists alongside `dist/index.html`.
- HTTP GET each of the four diagram paths from a server rooted at `dist/` → 200.
- `fs.existsSync` false path (docs/ absent) skips the copy without crashing deploy.

**Verification:** From a server rooted at `dist/`, the homepage and all four diagram URLs return 200; clicking "View architecture" from the local site shows the interactive diagram.

## Verification Contract

1. Open `datawego-company-site.html` locally: case-studies band below the three cards, four cards, links open the diagram pages.
2. Toggle EN/NL: full translation parity in the new band.
3. Footer bottom row shows KVK-nummer in both languages and both themes (light/dark).
4. Run the deploy dist step and serve `dist/`: all five URLs (index + 4 diagrams) return 200.
5. Dark mode + narrow viewport (375px): no card overflow, chips wrap, links reachable.

## Definition of Done

- R1–R8 verified via the steps above; no regressions to the existing three-card grid, lifecycle section, or language toggle.
- `deploy.js` copies the four diagram pages into `dist/docs/`; diagram HTML files tracked in git.

## System-Wide Impact

- Repo grows ~3.3MB (diagram pages now tracked); Cloudflare Pages free tier handles this fine.
- `datawego1.png` in `resources/` is a working screenshot, not site content — leave it out of `dist/` decisions (it is already in `resources/` and will ship; harmless, or delete if the user prefers — not this plan's call to make silently).
