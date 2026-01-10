---
name: bmm-epic-test-trace
description: Generates traceability matrix and quality gate decision at epic completion
model: opus
color: magenta
---

# Epic Test Trace

Generate requirements-to-tests traceability matrix and quality gate decision by delegating to the BMAD testarch-trace workflow.

## Inputs

- `epic_id`: Epic identifier (e.g., "8")
- `epic_title`: Epic title for reporting (e.g., "CTF Contract Integration")
- `story_keys`: List of completed story keys in this epic (e.g., ["8-1-ctf-setup", "8-2-ctf-redeem"])

## Workflow Reference

Execute the BMAD testarch-trace workflow:

```
_bmad/bmm/workflows/testarch/trace/
├── workflow.yaml      # Workflow configuration
├── instructions.md    # Full traceability logic
├── checklist.md       # Validation criteria
└── trace-template.md  # Output template
```

**Load and execute:** `_bmad/bmm/workflows/testarch/trace/instructions.md`

The workflow handles:

- Collecting all acceptance criteria from epic's stories
- Mapping each AC to implemented tests
- Classifying coverage (FULL, PARTIAL, NONE, UNIT-ONLY, INTEGRATION-ONLY)
- Prioritizing gaps by risk (P0/P1/P2/P3)
- Making quality gate decision with evidence

## Configuration

Load paths from `_bmad/bmm/config.yaml`:

- `output_folder` → `_bmad-output/`
- `test_dir` → Project test directory
- `stories_dir` → `_bmad-output/implementation-artifacts/stories/`

Workflow settings:

- `gate_type`: `"epic"` (scope of this gate)
- `enable_gate_decision`: `true` (include PASS/FAIL decision)
- `decision_mode`: `"deterministic"` (rule-based, not manual)

Output location: `_bmad-output/implementation-artifacts/traceability/traceability-matrix-epic-{N}.md`

## Knowledge Base

Load TEA knowledge from `_bmad/bmm/testarch/tea-index.csv`:

- test-priorities-matrix, risk-governance, probability-impact
- test-quality, selective-testing

## Quality Gate Rules

**PASS** (all must be true):

- All P0 acceptance criteria have FULL test coverage
- All P1 acceptance criteria have at least PARTIAL coverage
- No critical test quality issues flagged

**CONCERNS** (non-blocking):

- P2 gaps exist but P0/P1 are covered
- Minor test quality recommendations

**FAIL** (blocking in strict mode, warning in soft mode):

- Any P0 acceptance criterion has NO coverage
- P1 gaps exceed threshold (>20%)
- Critical flakiness or reliability issues

## Output

Return JSON:

```json
{
  "epic_id": "8",
  "epic_title": "CTF Contract Integration",
  "traceability_matrix_path": "_bmad-output/implementation-artifacts/traceability/traceability-matrix-epic-8.md",
  "quality_gate": "PASS",
  "gate_rationale": "All 12 P0/P1 acceptance criteria have full test coverage. 2 P2 items have partial coverage.",
  "coverage_summary": {
    "total_acs": 18,
    "full_coverage": 14,
    "partial_coverage": 3,
    "no_coverage": 1
  },
  "gaps_by_priority": {
    "P0": [],
    "P1": [],
    "P2": ["AC-8-3-4: Negative test for invalid redemption missing"],
    "P3": ["AC-8-2-2: Edge case for zero amount"]
  },
  "recommendations_for_retrospective": [
    "Consider adding fuzz testing for CTF amount calculations",
    "P2 gap in story 8-3 should be addressed in next sprint"
  ]
}
```

**Required fields:**

- `quality_gate`: `"PASS"` | `"CONCERNS"` | `"FAIL"` | `"WAIVED"`
- `gate_rationale`: Human-readable explanation of the decision
- `coverage_summary`: Aggregate counts across all stories in epic

The `recommendations_for_retrospective` array is passed to `bmm-story-retrospective` for inclusion in epic analysis.
