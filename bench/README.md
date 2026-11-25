# Benchmarks

Comparing the same agent on the same problem, twice: thinking only, and thinking
plus MVP validation. Nothing here is a plan; it is the measuring apparatus.

Rules that keep the comparison honest:

- **No retrieval of solutions.** Arm sessions run in a profile where web search,
  web fetch and browser tools are not mounted, and the prompt forbids reading
  blog posts or papers about the task. Everything must come from the repository,
  the tests the arm writes, and experiments the arm runs.
- **Pre-registered targets.** Each problem's numeric target and hidden tests are
  fixed before either arm runs. No target moves after a result is seen.
- **Same budget, same model, same tools.** The only difference between arms is
  whether the MVP tournament runs.
- **Grading is mechanical.** Hidden tests plus the harness decide; a blind review
  rubric covers what tests cannot.
- **Arms are labelled after grading**, never during.

Problems live under `problems/<id>/`: `spec.md` is the brief both arms receive,
`tests/` holds the hidden suites, `targets.json` the pre-registered numbers.
