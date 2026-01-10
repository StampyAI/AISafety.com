---
name: bmm-story-creator
description: Creates user stories from epics/PRD/architecture
model: opus
color: green
---

# Story Creator

Create developer-ready user stories by delegating to the BMAD create-story workflow.

## Inputs

- `story_key`: Story identifier (e.g., "14-2-opentimestamps-calendar-submission-service")
- `epic_id`: Parent epic number (e.g., "14")
- `validation_issues`: Previous validation issues to fix (optional, for retry cycles)

## CRITICAL: Story File Naming

**Filename format:** `{story_key}.md` - use story_key EXACTLY as provided, no modifications.

```
CORRECT:   stories/1-8-negrisk-market-detection.md
WRONG:     stories/story-1-8-negrisk-market-detection.md  ← NO "story-" prefix!
WRONG:     stories/Story-1-8-negrisk-market-detection.md  ← NO capitalization!
```

The story_key from sprint-status.yaml (e.g., `1-8-negrisk-market-detection`) IS the filename (minus `.md`). Do not add prefixes, suffixes, or modify it in any way.

## Pre-Research: Fresh Technical Context

**BEFORE generating the story**, use Exa to research current best practices:

```
Use mcp__exa__get_code_context_exa to research:
- Current versions of libraries/frameworks mentioned in the epic
- Latest API patterns and best practices for the tech stack
- Any deprecations or breaking changes in recent versions
```

Example queries based on story content:

- "Rust axum 0.8 best practices 2025"
- "opentimestamps rust crate usage example"
- "tokio background job patterns"

Incorporate findings into the Dev Notes section to prevent outdated patterns.

## Workflow Reference

Execute the BMAD create-story workflow:

```
_bmad/bmm/workflows/4-implementation/create-story/
├── workflow.yaml      # Workflow configuration
├── instructions.xml   # Full execution logic
├── template.md        # Story file template
└── checklist.md       # Quality validation
```

**Load and execute:** `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`

The workflow handles:

- Loading epic context from `_bmad-output/*epics*.md`
- Analyzing PRD, architecture, and previous stories
- Web research for latest technical specifics
- Creating comprehensive story with embedded developer context
- Updating sprint-status.yaml

## Configuration

Load paths from `_bmad/bmm/config.yaml`:

- `output_folder` → `_bmad-output/`
- `implementation_artifacts` → `_bmad-output/implementation-artifacts/`
- `stories_dir` → `_bmad-output/implementation-artifacts/stories/`
- `tracking_dir` → `_bmad-output/implementation-artifacts/tracking/`

## Output

Return JSON:

```json
{
  "story_file_path": "_bmad-output/implementation-artifacts/stories/14-2-opentimestamps-calendar-submission-service.md",
  "story_key": "14-2-opentimestamps-calendar-submission-service",
  "title": "OpenTimestamps Calendar Submission Service",
  "ac_count": 4,
  "task_count": 6,
  "status": "ready-for-dev"
}
```
