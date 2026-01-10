#!/bin/bash
# SessionStart hook (compact matcher): re-inject full auto-story-continuous context after compaction
# Injects the complete command file + checkpoint state

set -e

INPUT=$(cat)
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')

MARKER_FILE="$PROJECT_DIR/.claude/.auto-story-active"
COMMAND_FILE="$PROJECT_DIR/.claude/commands/auto-story-continuous.md"
TRACKING_DIR="$PROJECT_DIR/_bmad-output/implementation-artifacts/tracking"

# Only activate if marker file exists
[ -f "$MARKER_FILE" ] || exit 0
[ -f "$COMMAND_FILE" ] || exit 0

# Find latest tracking file for checkpoint state
TRACKING_FILE=$(ls -t "$TRACKING_DIR"/continuous-run-*.yaml 2>/dev/null | head -1 || echo "")

# Export for Python
export PROJECT_DIR COMMAND_FILE TRACKING_FILE

# Use Python to handle JSON escaping properly and generate output
python3 << 'PYTHON_SCRIPT'
import json
import sys
import os
import re

project_dir = os.environ.get('PROJECT_DIR', '')
command_file = os.environ.get('COMMAND_FILE', '')
tracking_file = os.environ.get('TRACKING_FILE', '')

# Read command file and strip frontmatter
with open(command_file, 'r') as f:
    content = f.read()

# Remove YAML frontmatter (--- to ---)
content = re.sub(r'^---\n.*?^---\n', '', content, flags=re.MULTILINE | re.DOTALL)

# Build checkpoint info
checkpoint_info = ""
if tracking_file and os.path.exists(tracking_file):
    with open(tracking_file, 'r') as f:
        tracking_content = f.read()

    if 'checkpoint:' in tracking_content:
        # Extract checkpoint fields
        story_key = ""
        phase = ""
        story_path = ""

        for line in tracking_content.split('\n'):
            if 'story_key:' in line:
                match = re.search(r'story_key:\s*"?([^"\n]+)"?', line)
                if match:
                    story_key = match.group(1).strip()
            elif 'phase:' in line and not phase:
                match = re.search(r'phase:\s*"?([^"\n]+)"?', line)
                if match:
                    phase = match.group(1).strip()
            elif 'story_file_path:' in line:
                match = re.search(r'story_file_path:\s*"?([^"\n]+)"?', line)
                if match:
                    story_path = match.group(1).strip()

        if story_key and phase:
            checkpoint_info = f"""CHECKPOINT STATE (resume from here):
- Story: {story_key}
- Phase: {phase} (create | validate | implement | verify | review)
- Story file: {story_path}
- Tracking file: {tracking_file}

ACTION: Read the tracking file and sprint-status.yaml, then continue from the checkpoint phase."""

if not checkpoint_info:
    checkpoint_info = f"""NO CHECKPOINT FOUND - Rebuild queue:
1. Read sprint-status.yaml
2. Collect pending stories across all epics
3. Continue processing from first pending story
4. Tracking file: {tracking_file or 'none'}"""

# Build full context
full_context = f"""<auto-story-continuous-recovery>
SESSION RECOVERED AFTER COMPACTION

You are running /auto-story-continuous. This hook fired because the session was compacted.

{checkpoint_info}

--- FULL WORKFLOW INSTRUCTIONS ---
{content}
</auto-story-continuous-recovery>"""

# Output valid JSON - SessionStart hooks need hookEventName in hookSpecificOutput
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": full_context
    }
}

print(json.dumps(output))
PYTHON_SCRIPT
