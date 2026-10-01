---
name: handoff
description:
    Write a handoff note so a fresh session can pick up VectorAdmin where this
    one stopped. Use when the user asks for a handoff, a new context, notes for
    the next session, or says they are starting a new session.
---

# Handoff

Write `.claude/handoff/YYYY-MM-DD.md` (today's date; add `-2`, `-3` if that file
exists). The reader is the next Claude session, cold: it has CLAUDE.md and
nothing else. It must be able to start work from this file alone.

## Gather before writing (don't write from memory)

1. Read the newest existing file in `.claude/handoff/`. Carry forward what is
   still true, update what changed, drop what is done.
2. `git log --oneline <last handoff's HEAD>..HEAD` and `git status --short`:
   list what landed since, and whether anything is uncommitted.
3. Run `yarn test` for the current test count; state it as a fact.
4. Check `.env.local` for which API it points at (the host only, never the
   token).
5. Scan this conversation for: user decisions, corrections, preferences, gotchas
   that cost time, and anything asked for but not finished.

## Sections, in this order

- **Read first**: the files a new session must read, with one line each on why
  (CLAUDE.md, CONTEXT.md, PRD revisions, ADRs, this file).
- **What exists**: the page top to bottom, each section in a few bullets. Name
  the URL params and defaults.
- **Data flow**: the pipeline from admin client to BFF routes to hooks, and
  every pure util in `src/features/dashboard/utils/` with one line each.
- **Ground rules from the user**: verbatim in substance. Keep every earlier rule
  unless the user changed it in this session; note the change and date.
- **Running and verifying**: scripts, env, how to drive the browser (the helpers
  in `.claude/handoff/`), cold-load times.
- **Gotchas already paid for**: one bullet per trap: the symptom, the cause, the
  fix, and where it lives. Only things a new session would hit again.
- **Open items**: numbered, most useful first. Each says what is decided, what
  is waiting on the user, and what is blocked, plus any data behind it.

## Style

- Plain, specific prose and bullets; file paths in backticks; no filler.
- Facts you checked, not guesses. Mark anything unverified as such.
- About 150–250 lines. If it grows past that, cut history, not rules.
- Prettier rewraps `.claude/*.md`; run it on the file when done.

## After writing

Tell the user the path and one line on what changed since the last handoff.
Don't commit unless asked (the user pushes; commit messages are one prose
paragraph, no subject line, no co-author trailer).
