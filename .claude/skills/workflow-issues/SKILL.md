---
name: workflow-issues
description: Calliope's GitHub issue process — finding, writing, labelling, accepting into a milestone, rejecting and closing issues — and the gh commands for it. Use whenever finding, writing or changing an issue.
user-invocable: true
allowed-tools: Bash(gh issue list *), Bash(gh issue view *), Bash(gh label list *)
---

## The process

- **Issues are public and in English**, the technical record.
- **A milestone means accepted**: `v1` or `v2`. `status: proposed` (arrived, not yet decided) and a
  milestone are mutually exclusive, so accepting takes the label off in the same edit. Every open
  issue without a milestone carries `status: proposed`, a new one included.
- **Rejected:** `status: rejected` instead of `status: proposed`, then closed as not planned.
- **Labels say type and area; nothing else goes in the title.** Exactly one `type:` — `user story`
  (members see it), `admin story` (administrators and moderators see it), `bug`, `task` (nobody
  sees it: dependencies, refactors, deployment, docs). An `area:` for each area it touches
  (`backend`, `frontend`, `database`, `deployment`, `design-system`), a `concern:` where one applies
  (`accessibility`, `privacy`, `performance`, `security`). The other labels are Dependabot's.
- **The body is short:** an opening paragraph saying what the problem is, then `## Why`,
  `## Decided` for what is, and `## Open questions` for what is not.
- **The specification** (`docs/product-requirements-feature-specification.md`) is cited as `§N`,
  issues as `#N`. Quote the section before citing it. It is an inspiration: a section says where an
  idea came from, the issue says what is decided.
- **Before writing one,** search for a duplicate in every state.

## Commands

```bash
# Duplicates, in every state
gh issue list --state all --search '<words>' --json number,title,state,milestone,labels

# Awaiting a decision; accepted for a milestone
gh issue list --label 'status: proposed'
gh issue list --milestone v1

# Read one, with its comments
gh issue view <n> --comments

# Write one: the body from a file, in the shape above
gh issue create --title '<what>' --label 'type: user story' --label 'area: frontend' \
  --label 'status: proposed' --body-file <file>

# Accept, in one edit
gh issue edit <n> --milestone v1 --remove-label 'status: proposed'

# Reject
gh issue edit <n> --remove-label 'status: proposed' --add-label 'status: rejected'
gh issue close <n> --reason 'not planned'
```

Writing, editing and closing publish at once, on a public repository: they ask first.
