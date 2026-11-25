# Durable write throughput

A store whose writes are acknowledged only once they are durable, on a real
filesystem where an `fsync` costs milliseconds. Throughput is the point: flushing
on every write is correct and slow, and the interesting question is how much of
that cost can be recovered without weakening the guarantee.

Requirements: `put`, `get`, `delete`, `open`, as in the crash-safety problem. A
put that resolves must survive a crash that discards unflushed data. Throughput
and latency targets are pre-registered in `targets.json` and measured on the
repository filesystem, not `/tmp`.
