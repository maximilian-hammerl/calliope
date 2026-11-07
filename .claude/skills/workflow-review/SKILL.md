---
name: workflow-review
description: Review a change to calliope — uncommitted changes, a branch against main, or a GitHub pull request — for bugs and for breaks of calliope's written rules (the AGENTS.md files, the .claude/rules/ notes for the touched paths, the design system), and report verified findings as must fix, should fix and can fix, each with its options and a recommendation. Use when asked to review a change, a branch or a PR, or before handing a change over.
argument-hint: "[<branch> | pr <number>]"
user-invocable: true
allowed-tools: Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git show *), Bash(git fetch *), Bash(git worktree add *), Bash(git worktree remove *), Bash(gh pr view *), Bash(gh pr diff *), Bash(gh issue view *), Bash(grep *), Bash(dbmate --env-file ../.env --url *calliope_review*)
---

A review reports only what it has checked and leaves every decision to the human. It changes no
file until the human picks fixes (step 8), except a stale generated file its checks regenerate.

## 1. Target and intent

Arguments: `$ARGUMENTS`

| Arguments | Target | Its diff |
| --- | --- | --- |
| none | the uncommitted changes, staged, unstaged and untracked | `git diff HEAD`, `git status --short` |
| a branch | its commits since it left `main` | `git diff origin/main...<branch>`, `git log origin/main..<branch>` |
| `pr <number>` | a GitHub pull request | `gh pr diff <number>` |

- `git fetch origin` first, so `origin/main` is current. No arguments and a clean tree: on a
  branch, review it against `origin/main`; on `main`, ask.
- A pull request: `gh pr view <number> --json title,body,baseRefName,headRefName,headRefOid`. Its
  comments come from `gh pr view <number> --comments` and, for those on lines,
  `gh api repos/{owner}/{repo}/pulls/<number>/comments`. A point already raised isn't reported
  again.
- A pull request, or a branch not checked out here: check its head out in a throwaway worktree
  outside the checkout (`git fetch origin pull/<number>/head`, then
  `git worktree add --detach <dir> FETCH_HEAD`), since the human's checkout may change meanwhile.
- **Intent:** the commit messages, the pull request's title and description, the issue they name
  (`gh issue view <n> --comments`), and the sections of the specification it cites.

## 2. Checks, in the background

Start `/workflow-validate` without `--fix` for the target, in the directory that holds it, before
the hunt. The only files it changes are generated ones: a `schema.ts` or `open-api.json` it
regenerates was stale, which is a finding, and stays regenerated, since that is what to commit.

A throwaway worktree is set up as `/workflow-validate` step 3 says, with one difference: its
`.env` copy always names `calliope_review` in `DATABASE_URL` (`<review>`), so the tests run on the
target's migrations and never on the human's database. `dbmate --env-file ../.env --url
"<review>" up` in its `database/` creates and migrates it.

## 3. Hunt: one agent per angle

List the `.claude/rules/` files whose `paths:` match a changed file (`grep -rn -A15 '^paths:'
.claude/rules/`). Then start the angles that apply in one message, as agents told to change
nothing. Each gets the target, the commands that print its diff, the directory, the intent, its
row below with the rules files for its area, and the candidate shape. It reads the changed files in
full, and the code that calls them or that they call.

| Angle | Runs when | Reads first | Hunts for |
| --- | --- | --- | --- |
| Correctness | code changed | the tests of the changed code | wrong logic or status; an unhandled empty, null or error path; two requests racing; moved code that lost a guard; a flipped default; a test that passes without the change |
| Authorisation | `backend/**` | `backend/AGENTS.md` "Authorisation"; `.claude/rules/backend/scope.md` and `.claude/rules/backend/auth.md` | a 403 or an error that reveals what the user may not see; a child reached outside its parent's chain (`scope/chains.ts`); an act decided by a helper instead of `mayAct` or `mayActInForum`; a route with an id but no case in `stranger_access_test.ts` and `REQUEST_BODIES`; a send awaited in a handler; a password, token or address in a log |
| Data and migrations | `backend/**` or `database/**` | `backend/AGENTS.md` "Data access" and "Notifications and mail"; `database/AGENTS.md`; `.claude/rules/database/migrations.md` | a write, or its read-back, outside the transaction; raw SQL; a `switch` without `assertUnreachable`; a notification outside its cause's transaction, or to the actor; a `migrate:down` that doesn't reverse; a referencing column without an index; a trigger path no test exercises |
| Type chain | `database/migrations/**`, `backend/src/route/**`, or the client's use in `frontend/` | root `AGENTS.md` "One type chain"; `backend/AGENTS.md` "Routes" and "Schemas"; `.claude/rules/frontend/api_client.md` | `schema.ts` or `open-api.json` not regenerated; a schema restating columns instead of `.pick()`; a `refine` the document can't see; a response without `content`; a QUERY list missing from `orval.config.ts`; a length bound written as a literal |
| Conventions | once per touched project | its `AGENTS.md` and matching `.claude/rules/` files; for the frontend, `frontend/.claude/skills/design-system/readme.md` | a broken written rule, quoted with where it's written |
| Completeness | always | the intent; root `AGENTS.md` | a change that doesn't do what its issue or pull request says; changed behaviour without a test; a `.claude/rules/` file, an `AGENTS.md` or the design system left behind when its area changed; a path in an agent doc that doesn't exist |
| Simplification | code changed | — | duplication, derivable state, dead code the change leaves, a comment telling history instead of why |

Angles that read the same rules share an agent: Authorisation with Data and migrations, Type chain
with Completeness, and Conventions with Simplification, one per touched project. Correctness gets
its own; over about 1,500 changed lines, one per project.

Each agent returns its candidates, or "none". A candidate has:

- **location:** `file:line`, several if one cause;
- **title:** at most ten words;
- **problem:** what is wrong;
- **consequence:** the concrete failure (this input or state, that wrong result), or the rule it
  breaks, quoted with where it's written;
- **severity:** proposed, by step 5;
- **fixes:** each way to fix it the agent sees, with its cost.

Only what the change adds, touches or makes worse is a finding. A problem in code the change
doesn't touch is at most can fix, marked pre-existing.

## 4. Verify

Merge candidates with one cause. Stale documents (rules, an `AGENTS.md`, the design system, the
specification) make one candidate with a checklist, and so do missing tests, except a test that a
bug's fix needs, which stays with the bug. Then an agent that didn't find a candidate tries to
refute it: it gets the diff command, the files and the candidate's problem and consequence, and
returns one of

- **CONFIRMED:** traced through the code, and how;
- **PLAUSIBLE:** neither traced nor refuted; what would settle it;
- **REFUTED:** why not.

A must-fix candidate gets a verifier of its own; the others go up to four to a verifier, grouped by
file. A candidate that a failing check proves is confirmed without a verifier. Drop the refuted
ones, and those too small to report: a matter of taste no written rule covers, or a fix that costs
more than it brings.

## 5. Severity

Judged by what merging the change would cause, not by the work to fix it.

- **Must fix:** it breaks something or a hard rule. A confirmed bug with a concrete failure; a
  security hole, something a user may not see made visible, a secret; whatever CI fails on (a
  check, a stale `schema.ts` or `open-api.json`, a migration that doesn't roll back); an edited
  generated file; a migration that loses data.
- **Should fix:** it works today, but breaks a written rule or costs later. A rule from an
  `AGENTS.md`, a `.claude/rules/` file or the design system; changed behaviour without a test; a
  rule or document left behind.
- **Can fix:** optional. A simpler form, a clearer name or comment, dead code nearby, a
  pre-existing problem.

Torn between two, take the lower one and say why; for security and data loss, the higher. A
plausible finding keeps its severity and says what would settle it. A checklist finding takes the
severity of its worst item.

## 6. Options and recommendation

- **Options** only where a reasonable reviewer could choose differently: in the backend or the
  frontend, in a migration or a service, a route test or a service test, change the rule or the
  code. Otherwise the one fix, and nothing invented beside it.
- **Trade-offs** name the cost: what else must change, what it risks, what it leaves open. "More
  complex" is no trade-off.
- **The recommendation** picks one and reasons in calliope's terms: a written rule, the issue, what
  the surrounding code does.
- Findings fixed together say so ("fixed by M1, option B").

## 7. Report

In the conversation: a header of at most three lines under its title, the verdict, then the
findings by severity, within one by consequence. Refuted and dropped candidates are counted, not
described. Ids run per severity (M1, S1, C1); an empty severity says "None.", and nothing is padded.

```markdown
## Review: <target>, <n> commits, <n> files, +<n> −<n>

<What the change does, in one sentence.>
**Checks:** <each: passed, or failed with its first cause and the finding it became>. Not run: <check> (<why>).
**Reviewed:** <angles>; <n> candidates, <n> refuted, <n> too small; <n> points already raised on the pull request.

**Verdict:** <mergeable now, or after which findings>. <What can wait, and until when.>

### Must fix

#### M1 · <title>
`<file>:<line>` · confirmed

<What is wrong, and the concrete failure.>
**Why must fix:** <the harm, or the rule and where it's written>.

**Options**
- **A · <name>:** <what to do>. <Its trade-off.>
- **B · <name>:** <what to do>. <Its trade-off.>

**Recommendation:** A, because <reason>.

### Should fix

#### S1 · <title>
`<file>:<line>` · plausible: <what would settle it>

<What is wrong, and what it costs.>
**Why should fix:** <the rule and where it's written>.

**Fix:** <the one fix>. <Its cost, if any.>

### Can fix

None.
```

End by asking which to apply, answered by id and option ("M1, S2: B"); the others stay as they are.

## 8. Apply

1. Apply the chosen options: in the checkout for uncommitted changes or a branch checked out here.
   For a pull request or a branch checked out nowhere, ask first: on its branch in a worktree, or
   not at all and left to its author.
2. Check again what the fixes touched, with `/workflow-validate`.
3. Hand over as for any change, without offering another review, and commit only after a confirmed
   review (root `AGENTS.md`).
4. Once nothing in the review's worktree waits for review or a commit, remove it, and drop its
   database first (`dbmate --env-file ../.env --url "<review>" drop` in its `database/`).
