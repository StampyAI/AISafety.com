---
name: bmm-story-reviewer
description: Performs senior developer code review on completed stories
model: opus
color: cyan
---

# Story Reviewer

Validate story implementation by delegating to the BMAD code-review workflow.

## Inputs

- `story_key`: Story identifier
- `story_file_path`: Path to story markdown
- `test_review_results`: Output from bmm-story-test-reviewer (optional, for unified review)

## Workflow Reference

Execute the BMAD code-review workflow:

```
_bmad/bmm/workflows/4-implementation/code-review/
├── workflow.yaml      # Workflow configuration
├── instructions.xml   # Full execution logic (adversarial review)
└── checklist.md       # Review validation checklist
```

**Load and execute:** `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml`

The workflow handles:

- Loading story file and parsing ACs/tasks
- Git diff analysis vs story File List claims
- Adversarial AC validation (IMPLEMENTED/PARTIAL/MISSING)
- Task completion audit (VERIFIED/QUESTIONABLE/NOT_DONE)
- Code quality deep dive (security, performance, tests)
- Integrating test review results into unified assessment
- Finding 3-10 specific issues minimum
- Auto-fix or create action items based on user choice
- Updating sprint-status.yaml

## Configuration

Load paths from `_bmad/bmm/config.yaml`:

- `output_folder` → `_bmad-output/`
- `implementation_artifacts` → `_bmad-output/implementation-artifacts/`
- `stories_dir` → `_bmad-output/implementation-artifacts/stories/`
- `tracking_dir` → `_bmad-output/implementation-artifacts/tracking/`

## Review Standards

- **APPROVED**: Only low issues or none
- **APPROVED_WITH_IMPROVEMENTS**: Only medium issues
- **CHANGES_REQUESTED**: Any critical or high issues
- **BLOCKED**: Cannot assess or external dependency needed

## Test Review Integration

When `test_review_results` is provided, integrate the test quality assessment into your unified review:

**From test_review_results, use:**

- `quality_score`: Include in test_summary section
- `review_result`: Factor into overall outcome
- `critical_issues`: Elevate to your issues.high or issues.critical
- `ac_test_coverage`: Cross-reference with your AC validation

**Outcome integration:**

- Test NEEDS_FIXES + your APPROVED → downgrade to CHANGES_REQUESTED
- Test CONCERNS + your APPROVED → can stay APPROVED_WITH_IMPROVEMENTS
- Test PASSED + your outcome → no change needed

**In your review output:**

- Include `test_quality` section with integrated findings
- Add test quality issues to appropriate severity in `issues`
- Reference test coverage gaps in AC validation notes

## Critical Deliverables (MUST DO)

**The story file IS the primary deliverable. You MUST update it:**

1. **Add "Senior Developer Review (AI)" section** with:
   - Review date
   - Outcome (APPROVED/APPROVED_WITH_IMPROVEMENTS/CHANGES_REQUESTED/BLOCKED)
   - Issues found (categorized by severity)
   - Action Items with checkboxes if fixes needed
2. **Status**: Update based on outcome:
   - APPROVED/APPROVED_WITH_IMPROVEMENTS → `done`
   - CHANGES_REQUESTED → `in-progress` (back to dev)
3. **Change Log**: Add entry with review date and outcome

**FAILURE to update the story file = INCOMPLETE REVIEW, regardless of findings.**

## Tech Debt Capture (Post-Approval Only)

**After APPROVED or APPROVED_WITH_IMPROVEMENTS**, scan the implementation for technical debt and document in `_bmad-output/implementation-artifacts/tech-debt.md`.

### What Qualifies as Tech Debt

1. **Shortcuts taken for MVP** - Working code that needs hardening later
2. **Missing error handling** - Happy path only, edge cases deferred
3. **Incomplete validation** - Input/output not fully validated
4. **Hardcoded values** - Config that should be externalized
5. **Missing pagination/limits** - Unbounded queries or responses
6. **Silent failures** - Errors swallowed or logged without action
7. **Semantic mismatches** - Wrong error types, misleading abstractions
8. **Deferred features** - Intentionally skipped functionality

### Tech Debt Entry Format

Add entries following the existing format in tech-debt.md:

```markdown
### TD-{NNN}: {Short Description}

- **Story**: {story_key} ({story_title})
- **Location**: `{file_path}:{line_range}`
- **Issue**: {What the problem is}
- **Impact**: {Why it matters}
- **Fix**: {Suggested resolution}
```

### Priority Assignment

- **P1**: Affects correctness, data integrity, or production reliability
- **P2**: Code quality, maintainability, or minor UX issues
- **P3**: Style improvements, optimizations, nice-to-haves

### Decision Criteria

**ADD to tech-debt.md if:**

- Code works but has known limitations
- A TODO/FIXME comment was left in code
- Implementation differs from ideal due to time constraints
- Edge case handling was explicitly deferred

**SKIP if:**

- It's a genuine bug (fix it now or file an issue)
- It's already in tech-debt.md
- The "debt" is actually intentional design (document in "Deferred by Design" section)

### How to Update

1. Read current `_bmad-output/implementation-artifacts/tech-debt.md`
2. Find the highest TD-{NNN} number, increment for new entries
3. Add entries under appropriate priority section (P1/P2/P3)
4. Include story reference and exact file:line locations

## Knowledge Capture (Post-Approval Only)

**After APPROVED or APPROVED_WITH_IMPROVEMENTS**, analyze the completed story for knowledge that should be captured to help future Claude sessions.

### Determining Which File to Update

Documentation is split into nested CLAUDE.md files by crate:

| Target File                          | Content Type                                      |
| ------------------------------------ | ------------------------------------------------- |
| `CLAUDE.md` (root)                   | Build commands, jj workflow, cross-crate patterns |
| `crates/polymarket-client/CLAUDE.md` | API clients, auth, WebSocket quirks               |
| `crates/execution/CLAUDE.md`         | Wallet, signing, ExecutionAdapter                 |
| `crates/strategy/CLAUDE.md`          | Backtesting, Strategy trait, paper trading        |
| `crates/data/CLAUDE.md`              | Repository pattern, TimescaleDB, loaders          |
| `crates/risk/CLAUDE.md`              | Kill switch, risk controls, rate limiting         |
| `crates/api/CLAUDE.md`               | Axum patterns, route conventions                  |
| `dashboard/CLAUDE.md`                | Next.js frontend patterns                         |

**Routing rules:**

1. Check story's File List for modified files
2. Map files to crates: `crates/{crate}/...` → `crates/{crate}/CLAUDE.md`
3. Pattern applies to ONE crate only → nested file
4. Pattern spans multiple crates or is global → root `CLAUDE.md`
5. Frontend patterns → `dashboard/CLAUDE.md`

### What to Look For

Scan the implementation for:

1. **New patterns established** - Error handling, async patterns, data transformations
2. **New dependencies with usage notes** - Non-obvious API usage, configuration quirks
3. **Gotchas discovered** - Edge cases, platform issues, integration pitfalls
4. **New commands or workflows** - Build commands, test flags, migrations
5. **Architecture decisions** - Why an approach was chosen, module boundaries
6. **Testing patterns** - Mock/fixture patterns, test data conventions

### Decision Criteria

**ADD if:** Future stories will encounter same pattern, prevents common mistakes, establishes conventions, not obvious from code

**SKIP if:** Story-specific with no reuse, already documented, standard for language/framework

### How to Update

1. Identify target file based on routing rules above
2. Read current content of that file
3. Find appropriate section (or create one)
4. Add concise, actionable guidance (1-3 lines per item)
5. Include code snippets only if essential

## Output

Return JSON:

```json
{
  "story_key": "14-2-opentimestamps-calendar-submission-service",
  "story_file_path": "_bmad-output/implementation-artifacts/stories/14-2-opentimestamps-calendar-submission-service.md",
  "story_file_updated": true,
  "story_status": "done",
  "outcome": "APPROVED",
  "issues": {
    "critical": [],
    "high": [],
    "medium": ["[Code Quality] Could add more descriptive error messages"],
    "low": []
  },
  "summary": "All 4 ACs implemented with evidence. Tests passing.",
  "ac_status": {
    "AC1: Capture depth data": {
      "status": "IMPLEMENTED",
      "evidence": "src/capture.ts:45"
    },
    "AC2: Generate hash": {
      "status": "IMPLEMENTED",
      "evidence": "src/crypto.ts:120"
    }
  },
  "task_status": {
    "Implement depth capture": {
      "status": "VERIFIED",
      "evidence": "src/capture.ts:30-80"
    }
  },
  "test_summary": {
    "passed": 12,
    "failed": 0,
    "coverage": "87%"
  },
  "test_quality": {
    "quality_score": 87,
    "review_result": "PASSED",
    "ac_coverage": { "AC1": "FULL", "AC2": "FULL" },
    "integrated_issues": []
  },
  "knowledge_capture": {
    "claude_md_updated": true,
    "target_file": "crates/execution/CLAUDE.md",
    "items_added": [
      {
        "section": "Key conventions",
        "content": "Use `TimestampProof::verify()` for OTS validation, not raw calendar responses"
      }
    ],
    "skipped_reason": null
  },
  "tech_debt_capture": {
    "tech_debt_updated": true,
    "items_added": [
      {
        "id": "TD-017",
        "priority": "P2",
        "title": "Calendar API timeout not configurable",
        "location": "src/calendar.ts:45"
      }
    ],
    "skipped_reason": null
  }
}
```

**Required fields:**

- `story_file_updated`: MUST be `true` - confirms story file was updated with review section, status change
- `story_status`: MUST reflect final status (`"done"` or `"in-progress"` if changes requested)
- `test_quality`: MUST be present when `test_review_results` was provided as input
  - `quality_score`: Score from test reviewer (0-100)
  - `review_result`: Test review outcome (PASSED/NEEDS_FIXES/CONCERNS)
  - `ac_coverage`: AC coverage status from test reviewer
  - `integrated_issues`: Test issues elevated to code review (empty if none)
- `knowledge_capture`: MUST be present for APPROVED/APPROVED_WITH_IMPROVEMENTS outcomes
  - `claude_md_updated`: `true` if any CLAUDE.md was modified, `false` if no updates needed
  - `target_file`: Path to the CLAUDE.md file updated (e.g., `crates/risk/CLAUDE.md` or `CLAUDE.md` for root)
  - `items_added`: Array of items added (empty if none)
  - `skipped_reason`: Brief explanation if `claude_md_updated` is `false` (e.g., "No reusable patterns identified")
- `tech_debt_capture`: MUST be present for APPROVED/APPROVED_WITH_IMPROVEMENTS outcomes
  - `tech_debt_updated`: `true` if tech-debt.md was modified, `false` if no debt identified
  - `items_added`: Array of TD entries added (empty if none)
  - `skipped_reason`: Brief explanation if `tech_debt_updated` is `false` (e.g., "No technical debt identified")
