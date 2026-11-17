/**
 * Show a Workspace's live Session state on its folder row.
 *
 * The sidebar aggregates nothing at the Workspace level: a collapsed folder
 * hides whether a Session inside is running, waiting for input, or finished
 * unread. This patch derives one primary marker per Workspace (pending >
 * running > done, the same precedence the Session row uses) and overlays the
 * shared StateDot on the folder icon.
 *
 * The Workspace row is not a replaceable slot, so the installed package bundle
 * is edited directly. Idempotent; a dsh upgrade/reinstall overwrites it, so
 * rerun this after upgrading. Usage: bun run script/patch-workspace-status.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
const file = join(
  npmRoot,
  '@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js',
)

if (!existsSync(file)) {
  console.error(`not found: ${file}`)
  process.exit(1)
}

const source = readFileSync(file, 'utf8')
if (source.includes('function groupStatus(sessions, list, statuses, archived)')) {
  console.log(`already patched: ${file}`)
  process.exit(0)
}

const groupStatus = `\t\tfunction runningChildCount(list, parentId, statuses) {
\t\t\treturn list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce((count, child) => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0) ?? 0;
\t\t}
\t\t/**
\t\t* Aggregate a Workspace's visible Sessions into one folder marker.
\t\t* Pending interaction outranks live activity, which outranks an unread
\t\t* completion, matching the Session row's own precedence. Archived Sessions
\t\t* are skipped because their rows hide status too.
\t\t*/
\t\tfunction groupStatus(sessions, list, statuses, archived) {
\t\t\tlet pending;
\t\t\tlet running = false;
\t\t\tlet completed = false;
\t\t\tfor (const s of sessions) {
\t\t\t\tif (archived.has(s.id)) continue;
\t\t\t\tconst status = statuses.get(s.id);
\t\t\t\tconst kind = visiblePendingKind(status?.pendingInteraction?.kind);
\t\t\t\tif (kind !== void 0 && pending === void 0) pending = kind;
\t\t\t\tif ((status?.running ?? s.running) === true || runningChildCount(list, s.id, statuses) > 0) running = true;
\t\t\t\tif (status?.completionUnread === true) completed = true;
\t\t\t}
\t\t\tif (pending !== void 0) return {
\t\t\t\tstate: "pending",
\t\t\t\tdot: "warning",
\t\t\t\tlabelKey: pending === "plan-review" ? "status.planReview" : pending === "question" ? "status.waitingAnswer" : "status.waitingApproval"
\t\t\t};
\t\t\tif (running) return {
\t\t\t\tstate: "running",
\t\t\t\tdot: "ongoing",
\t\t\t\tlabelKey: "status.running"
\t\t\t};
\t\t\tif (completed) return {
\t\t\t\tstate: "done",
\t\t\t\tdot: "done",
\t\t\t\tlabelKey: "status.completed"
\t\t\t};
\t\t}`

const folder = `\t\t\t\t\t(0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\tclassName: clsx(Rows_module_css_default.slot, Rows_module_css_default.folder, active && Rows_module_css_default.folderActive),
\t\t\t\t\t\tchildren: row.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, {})
\t\t\t\t\t}),`

const folderWithStatus = `\t\t\t\t\t(0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\tclassName: clsx(Rows_module_css_default.slot, Rows_module_css_default.folder, active && Rows_module_css_default.folderActive),
\t\t\t\t\t\tstyle: { position: "relative" },
\t\t\t\t\t\tchildren: [row.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, { key: "folder" }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, { key: "folder" }), row.status === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
\t\t\t\t\t\t\tkey: "status",
\t\t\t\t\t\t\trole: "img",
\t\t\t\t\t\t\ttitle: t(row.status.labelKey),
\t\t\t\t\t\t\t"aria-label": t(row.status.labelKey),
\t\t\t\t\t\t\t"data-workspace-status": row.status.state,
\t\t\t\t\t\t\tstyle: {
\t\t\t\t\t\t\t\tposition: "absolute",
\t\t\t\t\t\t\t\tright: -2,
\t\t\t\t\t\t\t\tbottom: -2,
\t\t\t\t\t\t\t\tdisplay: "grid",
\t\t\t\t\t\t\t\tplaceItems: "center",
\t\t\t\t\t\t\t\tpadding: 1,
\t\t\t\t\t\t\t\tborderRadius: 999,
\t\t\t\t\t\t\t\tbackground: "var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base))",
\t\t\t\t\t\t\t\tpointerEvents: "none"
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tchildren: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: row.status.dot })
\t\t\t\t\t\t})]
\t\t\t\t\t}),`

const replacements: [string, string][] = [
  [
    `\t\tfunction runningChildCount(list, parentId, statuses) {
\t\t\treturn list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce((count, child) => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0) ?? 0;
\t\t}`,
    groupStatus,
  ],
  [
    '\t\t\t\t\tcontainsCurrent: g.key === currentGroup,\n\t\t\t\t\tsessions: expanded ?',
    '\t\t\t\t\tcontainsCurrent: g.key === currentGroup,\n\t\t\t\t\tstatus: groupStatus(g.sessions, list, statuses, archived),\n\t\t\t\t\tsessions: expanded ?',
  ],
  [folder, folderWithStatus],
]

let next = source
for (const [before, after] of replacements) {
  if (!next.includes(before)) {
    console.error(`patch anchor missing in ${file} (dsh workspace client changed?): ${before.slice(0, 80)}...`)
    process.exit(1)
  }
  next = next.replace(before, after)
}

const backup = `${file}.bak-totem`
if (!existsSync(backup)) writeFileSync(backup, source)
writeFileSync(file, next)
console.log(`patched ${file}`)
