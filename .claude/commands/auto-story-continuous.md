---
description: 'Continuous autonomous story execution with checkpoint/resume support'
---

# auto-story-continuous

Process stories across all epics sequentially: create, implement, review, commit. Halt on failure with detailed report.

## Core Principles

1. **Autonomous execution** - Make decisions without prompting for confirmation
2. **Checkpoint after each phase** - Enable crash recovery
3. **Commit after each success** - Atomic commits with push
4. **Halt on failure** - Write detailed report, stop immediately
5. **Process all epics** - Continue through epics until all stories are done

<default_to_action>
Implement changes autonomously. Infer intent and proceed. Use tools to discover missing details rather than asking.
</default_to_action>

## Orchestrator Role

You coordinate sub-agents but do not perform detailed work yourself.

**You handle:**

- Reading: `sprint-status.yaml`, tracking files, checkpoints (small files only)
- Bash: jj commands only (commit, push, status)
- Task: Invoke sub-agents for all substantive work
- Write: Only tracking files and failure reports

**Sub-agents handle:**

- Reading large docs (PRD, architecture, epics)
- Creating stories with embedded context
- Writing code and tests
- Running verification (tests, typecheck, lint)
- Code review

Before each sub-agent call, output: `→ {agent} | {description}`

## Sub-Agents

All agents invoked via Task tool with appropriate `subagent_type` and `model: opus` with `ultrathink` in prompt.

| Agent                   | Purpose                                  | Key Inputs                                                  | Returns (JSON)                                                       |
| ----------------------- | ---------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| bmm-story-creator       | Create story with context                | story_key, epic_id, validation_issues?                      | `{story_file_path, title, ac_count, status}`                         |
| bmm-story-validator     | Validate story, auto-fix LOWs            | story_key, story_file_path                                  | `{validation_result, low_issues_fixed, issues (MEDIUM+ only)}`       |
| bmm-story-test-planner  | Generate failing acceptance tests (ATDD) | story_key, story_file_path, epic_id                         | `{test_files_created, ac_coverage_map, tests_failing, status}`       |
| bmm-story-implementer   | Write code + tests                       | story_key, story_file_path, feedback?, atdd_checklist_path? | `{files_modified, files_created, test_files, atdd_tests_passed}`     |
| bmm-story-test-reviewer | Review test quality                      | story_key, story_file_path, test_files?                     | `{quality_score, review_result, critical_issues, ac_test_coverage}`  |
| bmm-story-reviewer      | Code review + integrate test review      | story_key, story_file_path, test_review_results?            | `{outcome, issues, summary, knowledge_capture, tech_debt_capture}`   |
| bmm-story-debt-fixer    | Fix auto-fixable tech debt               | epic_id                                                     | `{items_fixed, items_skipped, items_failed}`                         |
| bmm-epic-test-trace     | Epic traceability matrix + quality gate  | epic_id, epic_title, story_keys                             | `{quality_gate, gate_rationale, coverage_summary, gaps_by_priority}` |
| bmm-story-retrospective | Epic retrospective + action items        | epic_id, epic_title, trace_results?                         | `{retrospective_file, action_items_file, summary, next_epic}`        |

## Paths (Read them only when necessary)

- Sprint status: `_bmad-output/implementation-artifacts/tracking/sprint-status.yaml`
- Stories: `_bmad-output/implementation-artifacts/stories/{story_key}.md`
- Epics: `_bmad-output/planning-artifacts/epics.md`
- Tracking: `_bmad-output/implementation-artifacts/tracking/continuous-run-{timestamp}.yaml`
- Failure reports: `_bmad-output/implementation-artifacts/tracking/failure-report-{story_key}-{timestamp}.md`
- Tech debt: `_bmad-output/implementation-artifacts/tech-debt.md`
- Retrospectives: `_bmad-output/implementation-artifacts/retrospectives/epic-{N}-retrospective.md`
- Action items: `_bmad-output/implementation-artifacts/retrospectives/epic-{N}-action-items.md`
- Test plans: `_bmad-output/implementation-artifacts/test-plans/atdd-checklist-{story_key}.md`
- Traceability: `_bmad-output/implementation-artifacts/traceability/traceability-matrix-epic-{N}.md`

## Story Validation Heuristics

The validator auto-fixes LOW issues in-place and only returns MEDIUM+ issues to the orchestrator.

**When validator returns:**

- **PASSED** (no blocking issues) → Proceed to implementation
  - LOWs were auto-fixed by validator, log count: `Validation PASSED ({N} LOW auto-fixed)`
- **NEEDS_FIXES** (MEDIUM+ issues) → Call bmm-story-creator with issues, then **revalidate** (max 3 cycles)
- **Repeated same failure** → Likely systemic, halt with diagnosis

**Note:** You never need to handle LOW issues—validator fixes them directly.

## Code Review Heuristics

When a reviewer returns issues after implementation:

**ALWAYS fix ALL issues**, regardless of severity. Then:

- **No issues** → Proceed (APPROVED)
- **Low issues only** → Call implementer again to fix, then **proceed without re-review** (minor cosmetic fixes)
- **Medium or higher** → As above, then **re-review** (max 3 cycles) to confirm substantive fixes
- **Repeated same failure** → Likely systemic, halt with diagnosis

## Workflow

### 1. Pre-Flight

```
touch .claude/.auto-story-active   # Enable context preservation hook
Read sprint-status.yaml
Run: jj st && jj log -r @ --no-graph -T 'bookmarks'
Check for existing checkpoint → resume if found
Otherwise create tracking file: continuous-run-{YYYYMMDD-HHMMSS}.yaml
```

### 2. Build Queue

```
1. Read sprint-status.yaml
2. Collect ALL pending stories across ALL epics:
   - Filter: status NOT "done", status IN [ready-for-dev, in-progress, review, drafted, backlog]
   - Skip entries starting with "epic-" or ending with "-retrospective"
3. Sort by epic order, then by status: ready-for-dev > in-progress > review > drafted > backlog
4. If no pending stories → report completion and exit
```

### 3. Process Each Story

For each story, extract epic_id from story_key (e.g., "3-5-foo" → epic "3").

**Story Creation + Validation Loop** (max 3 cycles): If story status is "backlog":

1. → bmm-story-creator | Create story with embedded context (or fix issues if retry)
2. → bmm-story-validator | Validate story quality (auto-fixes LOWs in-place)
3. Apply story validation heuristics:
   - If PASSED → break loop, proceed (log LOW auto-fixes if any)
   - If NEEDS_FIXES → pass MEDIUM+ issues to bmm-story-creator, loop back to step 1
4. Update sprint-status: {story_key} → "ready-for-dev"

**Test Planning** (after validation passes):
→ bmm-story-test-planner | Generate failing acceptance tests (ATDD)

- If status == "TESTS_READY" → proceed to implementation with atdd_checklist_path
- If status == "BLOCKED" → halt with report (test scaffolding failed)

**Implementation + Review Loop** (max 3 cycles):

1. → bmm-story-implementer | Implement (pass feedback if retry, pass atdd_checklist_path)
   - Implementer runs verification internally (tests, typecheck, lint)
   - In ATDD mode: makes failing tests pass (GREEN phase)
2. Update sprint-status: {story_key} → "in-progress"
3. → bmm-story-test-reviewer | Test quality review
   - Returns: quality_score, review_result, critical_issues, ac_test_coverage
4. → bmm-story-reviewer | Code review (receives test_review_results)
   - Integrates test quality findings into unified review
   - Returns single outcome with combined issues
5. Update sprint-status: {story_key} → "review"
6. Apply review heuristics on unified outcome:
   - APPROVED → break loop
   - CHANGES_REQUESTED → pass issues to implementer, loop back
7. If approved → break loop

**On Success:**

```bash
jj describe -m "[Story {story_key}] {title}

{summary}

Co-Authored-By: Claude <noreply@anthropic.com>"
jj bookmark set story-{story_key}  # create bookmark for push if needed
jj git push
jj new  # start fresh commit for next story
```

Update sprint-status: {story_key} → "done"
Clear checkpoint.

**Epic Completion Check:**
After marking a story done, check if all stories for the current epic are now complete:

```
1. Get all story keys starting with "{epic_id}-" from sprint-status
2. If ALL have status "done":
   Log: "EPIC {epic_id} COMPLETE | Fixing tech debt..."
   → bmm-story-debt-fixer | Fix auto-fixable tech debt for epic {epic_id}
   Result: N items fixed, M skipped, K failed

   Log: "Running traceability analysis..."
   → bmm-epic-test-trace | Generate traceability matrix + quality gate
   - If PASS: Log "Quality gate PASSED"
   - If CONCERNS: Log "Quality gate CONCERNS: {summary}" (continue)
   - If FAIL: Log "⚠️ Quality gate FAILED: {rationale}" (continue with warning)

   Log: "Running retrospective..."
   → bmm-story-retrospective | Run retrospective for epic {epic_id}
   - Pass trace_results: quality_gate, coverage_summary, gaps_by_priority
   - Retrospective includes test coverage analysis in findings
   Result: retrospective + action items files created
3. Continue to next story (from next epic if current epic done)
```

**Note:** Debt fixer runs BEFORE traceability and retrospective so:

- Traceability analysis reflects on cleaned codebase
- Retrospective has full quality gate context
- Next epic starts with less baggage

**On Failure:**
Write failure report to `_bmad-output/implementation-artifacts/tracking/failure-report-{story_key}-{timestamp}.md`:

- Phase, attempts, error messages
- Files modified before failure
- Root cause analysis
- Resume instructions

Output: `HALTED: {story_key} failed at {phase}. Report: {path}`
Stop execution immediately.

### 4. Final Report

```
rm -f .claude/.auto-story-active   # Disable context preservation hook
COMPLETE | {N} stories | {E} epics | {R} retrospectives | {commits} commits
Stories: {story_key}, ... ({S} commits)
Tech debt fixed: {F} items ({F} commits)
Tech debt remaining: {R} items (skipped/failed)
Retrospectives: epic-1-retrospective.md, ...
Knowledge captured: {items added to CLAUDE.md, if any}
Action items: {total across all retrospectives}
Log: {tracking_file}
```

## Checkpointing

Save after each phase to tracking file:

```yaml
checkpoint:
  story_key: '14-2-opentimestamps-calendar-submission-service'
  phase: 'create' # create | validate | test-plan | implement | review | test-review
  saved_at: '2025-12-17T10:30:00Z'
  data:
    story_file_path: '_bmad-output/implementation-artifacts/stories/14-2-opentimestamps-calendar-submission-service.md'
    atdd_checklist_path: '_bmad-output/implementation-artifacts/test-plans/atdd-checklist-14-2-opentimestamps-calendar-submission-service.md'
    review_cycles: 0
```

On resume: Skip completed phases, continue from checkpoint.phase.

## Example: Successful Run Across Epics

```
Found 4 pending stories across 2 epics:
  Epic 1: 1-8 (backlog), 1-9 (backlog)
  Epic 2: 2-1 (backlog), 2-2 (backlog)

Story 1/4: 1-8-negrisk-market-detection
  → bmm-story-creator | Create story with context
    Result: 1-8-negrisk-market-detection.md, 3 ACs
  → bmm-story-validator | Validate story
    Result: PASSED (2 LOW auto-fixed: added test paths, fixed typo)
  → bmm-story-test-planner | Generate failing tests (ATDD)
    Result: TESTS_READY, 3 test files, all ACs covered
  → bmm-story-implementer | Implement (GREEN phase)
    Result: 5 files modified, all tests passing
  → bmm-story-test-reviewer | Test quality review
    Result: PASSED, score=87, all ACs covered
  → bmm-story-reviewer | Code review (with test results)
    Result: APPROVED (unified)
    Knowledge: Added 1 item to CLAUDE.md
    Tech debt: TD-017 added (P2: validation uses wrong error type)
  Status: done ✓
  jj git push ✓

Story 2/4: 1-9-dashboard-skeleton
  ...
  Status: done ✓

EPIC 1 COMPLETE | Fixing tech debt...
  → bmm-story-debt-fixer | Fix tech debt for Epic 1
    Result: 12 fixed, 2 skipped, 1 failed
    Fixed: TD-002, TD-003, TD-004, TD-007, TD-009, TD-013, TD-014, TD-015...
    Skipped: TD-001 (DB migration), TD-006 (repeated failure)
    jj git push ✓

EPIC 1 COMPLETE | Running traceability analysis...
  → bmm-epic-test-trace | Traceability matrix + quality gate
    Result: PASS - 12/12 P0/P1 ACs covered, 2 P2 gaps
    Output: traceability-matrix-epic-1.md

EPIC 1 COMPLETE | Running retrospective...
  → bmm-story-retrospective | Analyze Epic 1
    Result: epic-1-retrospective.md, epic-1-action-items.md
    Patterns: 3 identified, 4 action items created
    Test coverage: PASS included in analysis
    Next epic ready: yes

Story 3/4: 2-1-order-builder
  ...
  Status: done ✓

Story 4/4: 2-2-order-signing
  ...
  Status: done ✓

EPIC 2 COMPLETE | Fixing tech debt...
  → bmm-story-debt-fixer | Fix tech debt for Epic 2
    Result: 5 fixed, 0 skipped, 0 failed
    jj git push ✓

EPIC 2 COMPLETE | Running traceability analysis...
  → bmm-epic-test-trace | Traceability matrix + quality gate
    Result: PASS - 8/8 P0/P1 ACs covered
    Output: traceability-matrix-epic-2.md

EPIC 2 COMPLETE | Running retrospective...
  → bmm-story-retrospective | Analyze Epic 2
    Result: epic-2-retrospective.md, epic-2-action-items.md
    Test coverage: PASS included in analysis

COMPLETE | 4 stories | 2 epics | 2 retrospectives | 6 commits
Stories: 1-8, 1-9, 2-1, 2-2 (4 commits)
Tech debt fixed: 17 items (2 commits)
Traceability: 2 matrices generated, all quality gates PASSED
Retrospectives: epic-1-retrospective.md, epic-2-retrospective.md
Knowledge captured: 1 item
Tech debt remaining: 1 item (TD-001: DB migration)
Action items: 7 total
```

---

Begin: Read sprint-status.yaml, create tracking file, build queue.
