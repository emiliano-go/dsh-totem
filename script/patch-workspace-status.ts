/**
 * Add two sidebar summaries the shell does not expose as slots.
 *
 * 1. A Workspace's live Session state on its folder row. The sidebar
 *    aggregates nothing at the Workspace level: a collapsed folder hides
 *    whether a Session inside is running, waiting for input, or finished
 *    unread. One primary marker per Workspace (pending > running > done, the
 *    same precedence the Session row uses) is overlaid on the folder icon.
 * 2. A tiny "N pending" card above the Workspaces header, counting Sessions
 *    that are waiting on the user (yellow) or finished unread (green). Yellow
 *    wins because waiting blocks progress.
 *
 * Neither surface is a replaceable slot, so the installed package bundle is
 * edited directly. Idempotent; a dsh upgrade/reinstall overwrites it, so rerun
 * this after upgrading. Usage: bun run script/patch-workspace-status.ts
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

const current = readFileSync(file, 'utf8')
const backup = `${file}.bak-totem`
const patched = current.includes('function groupStatus(sessions, list, statuses, archived)')
// A patched file is re-derived from its backup so an updated patch (for
// example a smaller status badge) can be applied again. The backup is written
// on the first patch and only replaced when the unpatched source changed (a DSH
// upgrade), so it always matches the build being patched.
let source = current
if (patched) {
  if (!existsSync(backup)) {
    console.error(`already patched but no backup to re-derive from: ${backup}`)
    process.exit(1)
  }
  source = readFileSync(backup, 'utf8')
} else if (existsSync(backup)) {
  writeFileSync(backup, current)
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
\t\t\t\t\t\t\t\tright: -1,
\t\t\t\t\t\t\t\tbottom: -1,
\t\t\t\t\t\t\t\tdisplay: "grid",
\t\t\t\t\t\t\t\tplaceItems: "center",
\t\t\t\t\t\t\t\tpadding: 0,
\t\t\t\t\t\t\t\tborderRadius: 999,
\t\t\t\t\t\t\t\tbackground: "var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base))",
\t\t\t\t\t\t\t\tpointerEvents: "none"
\t\t\t\t\t\t\t},
\t\t\t\t\t\t\tchildren: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
								state: row.status.dot,
								size: 8
							})
\t\t\t\t\t\t})]
\t\t\t\t\t}),`

const pendingSummary = `\t\t/**
\t\t* Sidebar summary above the Workspaces header: how many Sessions are waiting
\t\t* on the user (a pending interaction) or finished unread. Yellow outranks
\t\t* green, because waiting blocks progress. Lives in this bundle because the
\t\t* shell exposes no slot between the panel list and the browsing region.
\t\t*/
\t\tfunction TotemPendingSummary({ useSessionStatus, useSessions }) {
\t\t\tconst statuses = useSessionStatus((state) => state);
\t\t\tconst list = useSessions((state) => state);
\t\t\tlet waiting = 0;
\t\t\tlet done = 0;
\t\t\tfor (const id of list.ids) {
\t\t\t\tconst row = list.byId[id];
\t\t\t\tif (row === void 0 || row.archived === true) continue;
\t\t\t\tconst status = statuses.get(id);
\t\t\t\tif (status?.pendingInteraction !== void 0) waiting += 1;
\t\t\t\telse if (status?.completionUnread === true) done += 1;
\t\t\t}
\t\t\tconst total = waiting + done;
\t\t\tif (total === 0) return null;
\t\t\tconst label = total + " pending";
\t\t\tconst detail = waiting > 0
\t\t\t\t? waiting + " waiting on you" + (done > 0 ? ", " + done + " done" : "")
\t\t\t\t: done + " done";
\t\t\treturn (0, react_jsx_runtime.jsxs)("div", {
\t\t\t\tclassName: "totem-pending-card",
\t\t\t\trole: "status",
\t\t\t\t"aria-label": detail,
\t\t\t\ttitle: detail,
\t\t\t\tstyle: {
\t\t\t\t\tdisplay: "flex",
\t\t\t\t\talignItems: "center",
\t\t\t\t\tgap: 6,
\t\t\t\t\tmargin: "2px var(--dsh-sidebar-inline-padding) 6px",
\t\t\t\t\tpadding: "4px 8px",
\t\t\t\t\tborderRadius: "var(--dsw-radius-md)",
\t\t\t\t\tborder: "1px solid var(--dsw-alias-border-l4)",
\t\t\t\t\tbackground: "var(--dsw-specific-sidebar-fill)",
\t\t\t\t\tcolor: "var(--dsw-alias-label-secondary)",
\t\t\t\t\tfontSize: 12,
\t\t\t\t\tlineHeight: "16px",
\t\t\t\t\tboxSizing: "border-box",
\t\t\t\t\tuserSelect: "none"
\t\t\t\t},
\t\t\t\tchildren: [
\t\t\t\t\t(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
\t\t\t\t\t\tstate: waiting > 0 ? "warning" : "done",
\t\t\t\t\t\tsize: 8
\t\t\t\t\t}),
\t\t\t\t\t(0, react_jsx_runtime.jsx)("span", { children: label })
\t\t\t\t]
\t\t\t});
\t\t}
`

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
  [
    'function WorkspaceBrowser({ wide,',
    `${pendingSummary}\t\tfunction WorkspaceBrowser({ wide,`,
  ],
  [
    'className: clsx(WorkspaceBrowser_module_css_default.root, !wide && WorkspaceBrowser_module_css_default.rail),\n\t\t\t\tchildren: [\n\t\t\t\t\t(0, react_jsx_runtime.jsxs)("div", {',
    'className: clsx(WorkspaceBrowser_module_css_default.root, !wide && WorkspaceBrowser_module_css_default.rail),\n\t\t\t\tchildren: [\n\t\t\t\t\twide && (0, react_jsx_runtime.jsx)(TotemPendingSummary, {\n\t\t\t\t\t\tuseSessionStatus,\n\t\t\t\t\t\tuseSessions\n\t\t\t\t\t}),\n\t\t\t\t\t(0, react_jsx_runtime.jsxs)("div", {',
  ],
]

let next = source
for (const [before, after] of replacements) {
  if (!next.includes(before)) {
    console.error(`patch anchor missing in ${file} (dsh workspace client changed?): ${before.slice(0, 80)}...`)
    process.exit(1)
  }
  next = next.replace(before, after)
}

if (!existsSync(backup)) writeFileSync(backup, source)
writeFileSync(file, next)
console.log(`patched ${file}`)
