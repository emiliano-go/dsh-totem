# Arm B — performance task, reasoning plus MVPs

`bench/runs/07-repo` is a real library checkout. `spec.md` says what to do: make
the workload faster while keeping the project's tests green.

Rules:

- Work only inside `bench/runs/07-repo`. Do not read `bench/problems/` or
  `bench/grading/` — they hold the grading workload measurements and the bar.
- No web search, web fetch, crawl or browser tools.
- **Validate first.** Name at least three genuinely different optimizations, call `spike` once with them and a harness you write, then implement the winner.
- You may run the workload and the project's tests as often as you like.
- Timebox: 25 minutes.

Reply with the diagnosis, the change, the commands you ran and their results, and
what remains unverified.
