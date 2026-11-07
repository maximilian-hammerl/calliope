---
name: workflow-ship
description: How a change reaches main — a branch, the hand-over and the human's review, the commit, a pull request that merges itself once Validate passes, stacked pull requests — and, at the end, what is still open. Use when starting work on a change, and when the human says to commit, push, open a pull request, merge or ship.
user-invocable: true
allowed-tools: Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git fetch *), Bash(gh pr view *), Bash(gh pr checks *), Bash(gh run view *), Bash(gh issue view *)
---

`main` takes changes only through pull requests: a ruleset requires the three Validate jobs
(`Backend`, `Database`, `Frontend`) and nobody bypasses it. Pull requests merge with a merge
commit, never squashed or rebased, so stacked branches keep their commits; a merged branch is
deleted. No reviewer is required, so the human's review before the commit is the change's review.
What the human's confirmation covers is in the root `AGENTS.md`.

## 1. Start

1. **The issue:** the one the change does (`/workflow-issues`). Without one, ask whether to write
   it; if not, the change goes without.
2. **The branch**, from `origin/main` after `git fetch origin`: `<type>/<issue>-<slug>`, or
   `<type>/<slug>` without an issue, the type as in the commit header. A session the desktop app
   started in its own worktree already has its branch: work there. If the human's checkout has
   uncommitted changes, ask before switching.

## 2. Change and hand over

Done means `/workflow-validate` passed. Then hand over:

1. `git status --short` and `git diff --stat`, as git prints them;
2. what changed and why;
3. what ran, with results, and what didn't;
4. where to review first: the risky or non-obvious parts;
5. a proposed commit message in [Conventional Commits](https://www.conventionalcommits.org) style:
   `<type>[(<scope>)][!]: <description>`, the description lower case and imperative
   (`feat(frontend): add a swipe to the carousel`), a body saying why, and the `Co-Authored-By`
   trailer. The types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`,
   `style`, `revert`; a breaking change gets `!` after the type and a `BREAKING CHANGE:` footer. The
   scope, if any, is the area, named like the `area:` labels (`backend`, `frontend`, `database`,
   `deployment`, `design-system`).

Then offer `/workflow-review` before the human reviews, unless a review produced the change. The
human reviews the diff either way, and confirms.

## 3. Commit, push, pull request

1. Stage by path and commit with the reviewed message; `git push -u origin HEAD`.
2. `gh pr create --base main --title "<commit header>" --body-file <file>`. The body: what changed
   and why, what was checked and what wasn't, `Closes #<issue>` if it finishes one, and it ends with
   the "Generated with Claude Code" line.
3. `gh pr merge <number> --auto --merge`: it merges once the three checks pass.

If the human committed or pushed themselves, ask once before opening the pull request.

## 4. Follow it

In the desktop app, its pull-request pane follows the checks; bind the pull request to the session.
Elsewhere, one background `gh pr checks <number> --watch`, not repeated polling.

- **A failed check:** `gh run view <run> --log-failed`. A failure the change causes is fixed on the
  branch and handed over again (step 2), since the fix is reviewed like any change. One it doesn't
  cause (a flaky test): say so, and `gh run rerun <run> --failed`.
- **A conflict:** merge `origin/main` into the branch. A resolution is a change: hand it over before
  committing.
- **A comment from a person** asking for a change: `gh pr merge <number> --disable-auto`, and ask.

## 5. After the merge

1. `git fetch --prune origin`. Where the change was made in the human's checkout, and it is still on
   that branch with nothing uncommitted (`git status --porcelain` prints nothing):
   `git switch main`, `git pull --ff-only` and `git branch -d <branch>`. A worktree the desktop app
   made is the app's to clean up (`git rev-parse --git-dir` and `--git-common-dir` differ).
2. **The deploy is the human's:** `./deployment/deploy.sh --environment testing` on the server
   (`deployment/README.md`). Say that it is still to do.

## 6. What's still open

Unasked, at the end: go through every source since the session's first request, and say whether
anything planned or anything that came up is still open, or whether everything is done.

- **The conversation:** questions either side asked that weren't answered; what the human asked for
  that the change doesn't do; what was put off ("later", "a follow-up"); what the hand-over named as
  not run; `/workflow-review` findings not picked; problems noticed in passing. If the conversation
  was summarised, say so: the summary may have dropped some.
- **The issue:** its body against what the change did, its „Open questions", its comments.
- **The pull request:** comments from people still open.
- **The deploy**, and **the checkout:** uncommitted changes, a branch left behind and why.
- **Work started elsewhere** for this change: sessions, agents or branches not finished or merged.

Report them as **Questions**, **Tasks** and **Issues**, leaving out an empty group. Each gets a
line: what it is, where it came from, and a proposed next step: do it here, an issue
(`/workflow-issues`, after its duplicate search), or let it go. Act on none before the human says
which. With nothing open, say that everything is done and name the sources checked; a source that
couldn't be checked isn't empty, and the change isn't done.

## Stacked pull requests

For changes that build on each other:

- Each branch starts from the one below it, and its pull request targets that branch
  (`gh pr create --base <branch below>`), so it shows only its own diff. Validate runs on it there.
- Auto-merge goes on the bottom one only, which targets `main`. When it merges and its branch is
  deleted, GitHub points the next pull request at `main`; the checks it already has count, since
  they belong to its commits. Then set auto-merge on that one.
- A fix lower in the stack is committed on its branch after review, then merged into each branch
  above (`git merge`, never a rebase) and pushed.
