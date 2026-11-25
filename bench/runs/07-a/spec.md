# Make this workload faster

`bench/runs/07-repo` is a real library checkout with a real timing workload:

```
/data/bench/venv/bin/python bench/problems/07-perf-optimization/tests/workload-pandas-dev__pandas-57479.py
```

It currently takes about 0.20 seconds per batch. Make it substantially faster
without changing behaviour, and keep the project's tests green.

Rules:

- Edit library code only. Do not edit the workload, the tests, or the environment.
- The graded measurement runs that workload with `/data/bench/venv/bin/python`
  and then runs a set of the project's own tests.
- Both must hold: faster **and** green. A patch that breaks tests scores nothing,
  and a speedup smaller than the pre-registered bar scores nothing.
