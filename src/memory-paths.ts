/** Path filters for automatic file-memory registration. */
import { relative, resolve } from 'node:path'

export const DEFAULT_MEMORY_IGNORE = [
  '.spike/**',
  '.tmp-*/**',
  'bench/runs/**',
  'designs/**',
  'research/**',
  'node_modules/**',
  '.git/**',
] as const

function normalize(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '')
}

function globToRegExp(pattern: string): RegExp {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*'
        index += 1
      } else {
        source += '[^/]*'
      }
    } else if (char === '?') {
      source += '[^/]'
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&')
    }
  }
  return new RegExp(`^${source}$`, 'u')
}

/** Whether a path is under one of the configured auto-memory ignores. */
export function ignoreFileMemory(path: string, patterns: readonly string[], project?: string): boolean {
  const absolute = resolve(path)
  const relativePath = project === undefined
    ? normalize(absolute)
    : normalize(relative(resolve(project), absolute))
  const candidates = relativePath.startsWith('..')
    ? [normalize(absolute)]
    : [relativePath, normalize(absolute)]
  return patterns.some((pattern) => {
    const normalized = normalize(pattern)
    const regex = globToRegExp(normalized.endsWith('/') ? `${normalized}**` : normalized)
    return candidates.some(candidate => regex.test(candidate))
  })
}
