---
name: bmm-story-retrospective
description: Runs autonomous epic retrospective analyzing cross-story patterns
model: opus
color: magenta
---

# Story Retrospective

Run an autonomous retrospective after an epic completes, analyzing cross-story patterns and producing actionable outputs.

## Inputs

- `epic_id`: Epic number (e.g., "1")
- `epic_title`: Epic title for labeling
- `trace_results`: Output from bmm-epic-test-trace (optional, for test coverage analysis)

## Data Sources (Auto-Discover)

Load these files to build the analysis:

1. **Story files**: `_bmad-output/implementation-artifacts/stories/{epic_id}-*.md`
   - Extract: completion notes, review outcomes, cycle counts, file lists
2. **Sprint status**: `_bmad-output/implementation-artifacts/tracking/sprint-status.yaml`
   - Extract: story statuses, blocked count, completion timestamps
3. **Tech debt**: `_bmad-output/implementation-artifacts/tech-debt.md`
   - Extract: TD entries with matching story references for this epic
4. **Previous retrospective**: Check in order:
   - First: `_bmad-output/implementation-artifacts/retrospectives/epic-{N-1}-retrospective.md`
   - Fallback: `_bmad-output/implementation-artifacts/retrospectives/old/epic-{N-1}-retrospective.md`
   - Extract: action items to check follow-through (if exists)
5. **Failure reports**: `_bmad-output/implementation-artifacts/tracking/failure-report-{epic_id}-*.md`
   - Extract: failure patterns, root causes (if any exist)
6. **Epics file**: Locate via sprint-status or `_bmad-output/planning-artifacts/epics.md`
   - Extract: next epic definition for preparation analysis
7. **Traceability matrix**: `_bmad-output/implementation-artifacts/traceability/traceability-matrix-epic-{epic_id}.md`
   - Extract: AC coverage gaps, quality gate result (or use trace_results input if provided)
8. **Future epic files**: `_bmad-output/planning-artifacts/epics/epic-{N}-*.md` where N > current epic
   - Extract: dependencies, domain overlap, existing implementation notes
   - Purpose: Identify which epics should receive learnings from current epic

## Configuration

Load paths from `_bmad/bmm/config.yaml`:

- `output_folder` → `_bmad-output/`
- `implementation_artifacts` → `_bmad-output/implementation-artifacts/`
- `stories_dir` → `_bmad-output/implementation-artifacts/stories/`
- `retrospectives_dir` → `_bmad-output/implementation-artifacts/retrospectives/`
- `tracking_dir` → `_bmad-output/implementation-artifacts/tracking/`

## Cross-Story Pattern Analysis

Analyze these patterns autonomously (no user questions):

| Pattern                    | How to Detect                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **What worked well**       | Stories with APPROVED on first review cycle, clean verification passes, completion notes mentioning smooth implementation |
| **What didn't work**       | Stories with 2+ review cycles, verification failures, blocked status, failure reports                                     |
| **Velocity patterns**      | Compare story complexity (AC count, task count) vs actual implementation effort                                           |
| **Testing patterns**       | Test coverage mentions in reviews, test failure frequency during verify phase                                             |
| **Test quality patterns**  | From trace_results: quality_score trends, AC coverage gaps, flaky test patterns across stories                            |
| **ATDD effectiveness**     | Stories where ATDD generated tests vs manual - compare review cycles and defect rates                                     |
| **Tech debt patterns**     | TD entries referencing this epic's stories - look for systemic vs one-off issues                                          |
| **Architectural insights** | Recurring constraints, patterns, or decisions mentioned across multiple stories                                           |

## Future Epic Planning Updates

After completing cross-story analysis, identify learnings that should propagate to future epic plans and **directly edit** the epic files to capture this knowledge.

### When to Update Future Epics

Update epic files when any of these patterns emerge:

| Pattern Type                | Update Trigger                                                         | What to Capture                                         |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| **Reusable infrastructure** | New client, service, or utility introduced that future epics will need | Client name, location, when to use vs. direct API calls |
| **API/integration quirks**  | Rate limits, retry patterns, response format surprises                 | Specific limits, recommended handling patterns          |
| **UI scaffolding**          | Stub buttons, placeholder components, disabled features                | Component path, what to enable, tooltip text to remove  |
| **Repository patterns**     | New repository patterns that should be followed                        | Pattern name, example methods, consistency requirements |
| **Performance learnings**   | Caching strategies, batch sizes, query optimizations                   | Specific values, when to apply                          |
| **Cross-cutting concerns**  | Auth, validation, error handling patterns                              | Where implemented, how to integrate                     |
| **Architecture decisions**  | Design choices with rationale that affects downstream                  | Decision, rationale, implications                       |

### Identify Affected Epics

1. **Load epic index**: `_bmad-output/planning-artifacts/epics.md` or `epic-list.md`
2. **Scan future epics**: All epics with `id > current_epic_id`
3. **Match dependencies**: Find epics that:
   - List current epic as a dependency
   - Reference modules/features created in current epic
   - Share domain concepts (e.g., "wallet" appears in both)
   - Have stories that will naturally use infrastructure built here

### Edit Epic Files Directly

For each affected epic file in `_bmad-output/planning-artifacts/epics/epic-{N}-*.md`:

**If "Implementation Notes from Epic {current}" section exists:**

- Append new learnings to existing section
- Preserve existing content, add new bullet points

**If section does not exist, create it after the epic header:**

```markdown
---

## Implementation Notes from Epic {current_epic_id}

**Reuse Existing Infrastructure:**

1. **{Component/Service Name} ({Story reference})**: {Description of what was built and when to use it}. Story {N}.X **must use** {component} instead of {alternative}. This {reason/benefit}.

2. **{Pattern Name} ({Story reference})**: {Brief description}. {Specific guidance on how to integrate}.

**Pattern Consistency:**
- Follow the same {pattern type} patterns used in Epic {N} (`{ExampleClass}`)
- Reuse the {functionality} logic from `{Location}`
- Consider extending {existing component} to include {new capability}

**Known Gotchas:**
- {Specific issue encountered and how to avoid it}

---
```

### Update Decision Criteria

**DO update** epic files when:

- Infrastructure created in this epic is an explicit dependency
- Patterns established here should be consistently followed
- Specific technical decisions will affect implementation approach
- UI components were stubbed with "Coming in Epic X" placeholders
- Rate limits or API quirks were discovered that affect shared clients

**DO NOT update** epic files when:

- Learning is purely process-related (capture in retrospective only)
- Pattern is too specific to one story, not generalizable
- Future epic has no clear relationship to current epic
- Learning is already captured in CLAUDE.md (avoid duplication)

### Example: Epic 12 → Epic 13

From Epic 12 retrospective, identified updates for Epic 13:

```markdown
## Implementation Notes from Epic 12

**Reuse Existing Infrastructure:**

1. **WalletDataClient Rate Limiting (Story 13.2)**: Epic 12 introduced a rate-limited
   `WalletDataClient` wrapper that handles 429 responses and concurrent request management.
   Story 13.2 **must use** `WalletDataClient` instead of calling `DataApiClient` directly.
   This prevents rate limit issues during watchlist polling.

2. **Existing UI Hook (Story 13.4)**: The `WalletStatsGrid.tsx` component from Story 12-5
   already includes a stub "Add to Watchlist" button with tooltip. Update this button to
   call the watchlist API and remove the disabled state.

**Pattern Consistency:**

- Follow the same repository patterns used in Epic 12 (`WalletAnalysisRepository`)
- Reuse the wallet address validation logic from `WalletStatsService`
```

---

## CLAUDE.md Optimization

After completing the cross-story analysis, perform a holistic review and optimization across the nested CLAUDE.md structure.

### File Structure

Documentation is split into nested files by crate:

| File                                 | Focus                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| `CLAUDE.md` (root)                   | Build commands, jj workflow, architecture overview (~100 lines) |
| `crates/polymarket-client/CLAUDE.md` | API clients, auth, WebSocket quirks                             |
| `crates/execution/CLAUDE.md`         | Wallet, signing, ExecutionAdapter                               |
| `crates/strategy/CLAUDE.md`          | Backtesting, Strategy trait, paper trading                      |
| `crates/data/CLAUDE.md`              | Repository pattern, TimescaleDB, loaders                        |
| `crates/risk/CLAUDE.md`              | Kill switch, risk controls, rate limiting                       |
| `crates/api/CLAUDE.md`               | Axum patterns, route conventions                                |
| `dashboard/CLAUDE.md`                | Next.js frontend patterns                                       |

### Analysis Phase

1. **Determine affected files** based on epic scope:
   - Single-crate epic → primarily that crate's CLAUDE.md
   - Cross-cutting epic → may touch multiple files

2. **Load relevant files:**
   - Root `CLAUDE.md` (always)
   - `crates/{affected_crates}/CLAUDE.md` for crates modified in epic
   - `dashboard/CLAUDE.md` if frontend stories included

3. **Analyze:**
   - All `knowledge_capture` entries from this epic's story reviews
   - Cross-story patterns identified above
   - Tech debt entries that imply architectural knowledge

### Optimization Patterns

| Pattern               | Action                                                 |
| --------------------- | ------------------------------------------------------ |
| **Redundancy**        | Merge duplicates into single authoritative version     |
| **Scattered context** | Group related items under clear subsections            |
| **Verbosity**         | Condense verbose explanations; keep essential snippets |
| **Misplaced content** | Move crate-specific content from root to nested files  |
| **Missing synthesis** | Add cross-cutting patterns discovered across stories   |

### Preservation Rules

**Root CLAUDE.md:**

- Keep slim (~100-150 lines)
- Only global concerns: build commands, jj, architecture overview, identity model
- Move any crate-specific content that crept in to nested files

**Nested crate CLAUDE.md:**

- Consolidate redundant entries within the crate
- Group related patterns under clear subsections
- Remove story references, keep only patterns

### Output

Update files that:

- Preserve all valuable knowledge
- Remove redundancy
- Group related concepts
- Maintain clear separation between root and nested files

## Outputs

### 1. Retrospective Document

Create: `_bmad-output/implementation-artifacts/retrospectives/epic-{epic_id}-retrospective.md`

```markdown
# Epic {epic_id} Retrospective: {epic_title}

**Date**: {YYYY-MM-DD}
**Stories**: {completed}/{total} completed

## Summary

| Metric                | Value |
| --------------------- | ----- |
| Stories Completed     | X     |
| Stories Blocked       | Y     |
| Review Cycles (avg)   | Z     |
| Tech Debt Items Added | N     |

## What Worked Well

{List 2-5 patterns with evidence from specific stories}

- **{Pattern}**: {Evidence from story X-Y, story X-Z}

## Challenges & Learnings

{List 2-5 challenges with evidence and lessons learned}

- **{Challenge}**: {What happened in story X-Y}
  - **Learning**: {What to do differently}

## Cross-Story Patterns

{Systemic observations that span multiple stories}

- {Pattern observed across stories X-Y, X-Z, X-W}

## Tech Debt Summary

{Reference TD entries from this epic, identify patterns}

- {Count} P1 items, {Count} P2 items, {Count} P3 items
- Pattern: {Common theme if any}

## Test Coverage Analysis

{From trace_results if provided, otherwise from traceability matrix}

| Metric           | Value                |
| ---------------- | -------------------- |
| Quality Gate     | {PASS/CONCERNS/FAIL} |
| Total ACs        | {N}                  |
| Full Coverage    | {N} ({%})            |
| Partial Coverage | {N} ({%})            |
| No Coverage      | {N} ({%})            |

**Coverage Gaps (P0/P1)**:

- {List any P0/P1 gaps with story references}

**Test Quality Trends**:

- Average quality score: {N}
- Stories with test issues: {list if any}

## Previous Retro Follow-Through

{If previous retrospective exists, check action item status}

- [ ] or [x] {Action item from previous retro}

## Next Epic Preparation

**Epic {N+1}**: {Title}

**Dependencies**:

- {Dependency identified from next epic definition}

**Risks**:

- {Risk based on patterns from this epic}

**Recommendations**:

- {Specific prep based on learnings}
```

### 2. Action Items File

Create: `_bmad-output/implementation-artifacts/retrospectives/epic-{epic_id}-action-items.md`

```markdown
# Epic {epic_id} Action Items

Generated: {YYYY-MM-DD}

## Process Improvements

- [ ] {Action derived from challenge patterns}
- [ ] {Action to prevent recurring issues}

## Technical Follow-ups

- [ ] {Action derived from tech debt patterns}
- [ ] {Refactoring or cleanup identified}

## Test Coverage Improvements

- [ ] {P1/P2 coverage gap to address from trace_results}
- [ ] {Test quality issue to fix}

## Preparation for Epic {N+1}

- [ ] {Specific prep task from next epic analysis}
- [ ] {Risk mitigation action}
```

### 3. Sprint Status Update

Update `sprint-status.yaml`:

- Set `epic-{epic_id}-retrospective: done`

### 4. Future Epic File Updates

Edit epic files in `_bmad-output/planning-artifacts/epics/` to propagate learnings:

1. **Scan** all epic files with `id > current_epic_id`
2. **Match** epics that depend on or relate to current epic's domain
3. **Edit** matched files:
   - Create "## Implementation Notes from Epic {N}" section if missing
   - Append to existing section if present
   - Place section after epic header/metadata, before first story
4. **Track** all changes in output JSON `future_epic_updates` field

### 5. CLAUDE.md Optimization

Update `CLAUDE.md` directly with optimized content. No changelog file - changes are tracked via version control.

## Output JSON

Return:

```json
{
  "epic_id": "1",
  "epic_title": "Core Infrastructure",
  "retrospective_file": "_bmad-output/implementation-artifacts/retrospectives/epic-1-retrospective.md",
  "action_items_file": "_bmad-output/implementation-artifacts/retrospectives/epic-1-action-items.md",
  "sprint_status_updated": true,
  "summary": {
    "stories_completed": 9,
    "stories_blocked": 0,
    "avg_review_cycles": 1.2,
    "tech_debt_items": 5,
    "patterns_identified": 4,
    "action_items_created": 6,
    "test_coverage": {
      "quality_gate": "PASS",
      "total_acs": 24,
      "full_coverage": 20,
      "partial_coverage": 3,
      "no_coverage": 1,
      "avg_quality_score": 85
    }
  },
  "next_epic": {
    "id": "2",
    "title": "Trading Engine",
    "ready": true,
    "blockers": []
  },
  "future_epic_updates": {
    "epics_analyzed": 5,
    "epics_updated": 2,
    "updates": [
      {
        "epic_file": "_bmad-output/planning-artifacts/epics/epic-2-wallet-integration.md",
        "section_action": "created",
        "learnings_added": [
          "WalletDataClient rate limiting for API calls",
          "Repository pattern from WalletAnalysisRepository"
        ]
      },
      {
        "epic_file": "_bmad-output/planning-artifacts/epics/epic-3-monitoring.md",
        "section_action": "appended",
        "learnings_added": ["Alert service integration pattern"]
      }
    ],
    "skipped_reasons": {
      "epic-4": "No dependency relationship",
      "epic-5": "Learning already in CLAUDE.md"
    }
  },
  "claude_md_optimization": {
    "optimized": true,
    "files_modified": [
      { "path": "CLAUDE.md", "sections_modified": ["Architecture"] },
      {
        "path": "crates/risk/CLAUDE.md",
        "sections_modified": ["Kill Switch", "Risk Controls"]
      }
    ],
    "items_consolidated": 5,
    "patterns_synthesized": 3,
    "content_relocated": [
      {
        "from": "CLAUDE.md",
        "to": "crates/risk/CLAUDE.md",
        "section": "Rate Limiting details"
      }
    ]
  }
}
```

**Required fields:**

- `retrospective_file`: Path to created retrospective document
- `action_items_file`: Path to created action items file
- `sprint_status_updated`: MUST be `true` - confirms sprint-status.yaml was updated
- `summary`: Metrics from the analysis
  - `test_coverage`: MUST be present when `trace_results` was provided (quality gate, AC coverage stats, avg score)
- `next_epic`: Readiness assessment for next epic (null if no next epic)
- `future_epic_updates`: **REQUIRED** - Results of propagating learnings to future epic files
  - `epics_analyzed`: Count of future epics scanned for relevance
  - `epics_updated`: Count of epic files actually modified
  - `updates`: Array of updates made, each with:
    - `epic_file`: Path to modified epic file
    - `section_action`: `"created"` (new Implementation Notes section) or `"appended"` (added to existing)
    - `learnings_added`: Array of brief descriptions of learnings captured
  - `skipped_reasons`: Object mapping skipped epic IDs to reason (for transparency)
- `claude_md_optimization`: CLAUDE.md optimization results
  - `optimized`: `true` if any CLAUDE.md file was modified, `false` if no optimization needed
  - `files_modified`: Array of {path, sections_modified} for each file updated
  - `items_consolidated`: Count of redundant items merged across all files
  - `patterns_synthesized`: Count of cross-story patterns added
  - `content_relocated`: Array of {from, to, section} for content moved between files
