# Issue: measurement parsing disqualifies valid candidates

`spike` ranks candidates from a JSON object that their benchmark prints. Two
reports say valid measurements are being thrown away:

1. **Indented output.** A candidate whose benchmark prints its object across
   several lines is recorded as "missing" and disqualified, even though the JSON
   is well formed and parses fine on its own.
2. **Counts are not proof.** A candidate that reports `indexed: 20000` — a
   stronger proof than a boolean — fails a `pass` criterion, because the check
   wants the literal `true`.

Expected behaviour: both shapes are accepted as measurements. A candidate that
genuinely reports nothing must still be disqualified, and a zero count must still
fail a `pass` criterion.

The benchmark may print noise before the object; the object is the last thing it
prints.
