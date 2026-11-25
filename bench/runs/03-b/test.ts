import { createIndex } from "./index.ts"

let fails = 0
function check(name: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got), b = JSON.stringify(want)
  if (a !== b) { fails++; console.log("FAIL", name, "got", a, "want", b) }
}

// conjunctive match + ranking by term frequency
{
  const ix = createIndex()
  ix.add("a", "alpha beta gamma")
  ix.add("b", "alpha beta")
  ix.add("c", "alpha")
  ix.add("d", "beta gamma")
  check("all terms", ix.search("alpha beta", 10).sort(), ["a", "b"])
  check("single term", ix.search("alpha", 10).sort(), ["a", "b", "c"])
  check("k truncates", ix.search("alpha", 1).length, 1)
  check("no match", ix.search("alpha zzz", 10), [])
  check("empty query", ix.search("", 10), [])
  check("punct query", ix.search("!!!", 10), [])
  check("k=0", ix.search("alpha", 0), [])
  check("k<0", ix.search("alpha", -3), [])
  check("case fold", ix.search("ALPHA Beta", 10).sort(), ["a", "b"])
  check("repeated term", ix.search("alpha alpha", 10).sort(), ["a", "b", "c"])
  check("hyphen tokenizes", ix.search("beta-gamma", 10).sort(), ["a", "d"])
  check("k > matches", ix.search("alpha", 99).length, 3)
}
// add-order tie-break and determinism
{
  const ix = createIndex()
  ix.add("x", "one two")
  ix.add("y", "two one")
  check("tie-break add order", ix.search("one two", 2), ["x", "y"])
  check("deterministic", ix.search("one two", 2), ["x", "y"])
}
// repeated add + duplicate ids remain distinct docs (no crash)
{
  const ix = createIndex()
  ix.add("a", "same text")
  ix.add("a", "same text")
  check("dup id docs", ix.search("same", 10), ["a", "a"])
}
// tf ranking: repeated term beats single occurrence
{
  const ix = createIndex()
  ix.add("once", "term filler filler filler")
  ix.add("thrice", "term term term filler")
  check("tf ranking", ix.search("term", 2), ["thrice", "once"])
}
// unicode / punctuation robustness
{
  const ix = createIndex()
  ix.add("u", "café don't 42nd")
  check("unicode splits", ix.search("caf", 10), ["u"])
  check("digits", ix.search("42nd", 10), ["u"])
}
// larger randomized check against an oracle
{
  const docs: [string, string][] = []
  const words = ["aa","bb","cc","dd","ee","ff","gg","hh"]
  for (let i = 0; i < 300; i++) {
    const toks: string[] = []
    for (let j = 0; j < 12; j++) toks.push(words[(i * 7 + j * 13) % words.length])
    docs.push(["d" + i, toks.join(" ")])
  }
  const ix = createIndex()
  for (const [id, t] of docs) ix.add(id, t)
  let ok = true
  for (const q of ["aa bb", "cc", "dd ee ff", "hh aa", "zz"]) {
    const terms = q.split(" ")
    const want = new Set(docs.filter(([, t]) => terms.every(x => t.split(" ").includes(x))).map(([id]) => id))
    const got = new Set(ix.search(q, 1000))
    if (want.size !== got.size || [...want].some(x => !got.has(x))) ok = false
  }
  check("oracle", ok, true)
}
console.log(fails === 0 ? "all tests passed" : fails + " test(s) failed")
if (fails) process.exit(1)
