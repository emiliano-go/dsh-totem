/**
 * Path classification shared by the deterministic checks.
 *
 * Scanning generated or vendored content is not just noise: a sourcemap or a
 * bundle contains the scanner's own patterns, so the rule that protects against
 * `curl | sh` reports the bundle for containing the string it searches for.
 *
 * @module dsh-totem/paths
 */

const GENERATED_DIRECTORY =
  /(?:^|\/)(?:node_modules|dist|build|out|coverage|vendor|\.venv|__snapshots__)\//iu
const GENERATED_FILE =
  /\.(?:map|min\.js|min\.css|lockb)$/iu

/** Whether a path is generated, vendored, or a lockfile. */
export function isGeneratedPath(path: string): boolean {
  if (path.length === 0) return false
  return GENERATED_DIRECTORY.test(path) || GENERATED_FILE.test(path) || /\.lock$/iu.test(path)
}

const TEST_DIRECTORY = /(?:^|\/)(?:tests?|__tests__|spec)\//iu
const TEST_FILE =
  /(?:^|\/)(?:test_[^/]+|[^/]+_test\.[A-Za-z]+|[^/]+\.(?:test|spec)\.[A-Za-z]+)$/iu

/** Whether a path is test code. */
export function isTestPath(path: string): boolean {
  if (path.length === 0) return false
  return TEST_DIRECTORY.test(path) || TEST_FILE.test(path)
}
