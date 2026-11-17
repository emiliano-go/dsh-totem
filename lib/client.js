window.__ModuleLoader__.load({
  id: "dsh-totem",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/client/index.tsx
var exports_client = {};
__export(exports_client, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(exports_client);

// src/client/TotemMemoryCard.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/controller.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function routeKey(provider, model) {
  return `${provider}\x00${model}`;
}
function parseRouteKey(key) {
  if (key === "")
    return { provider: "", model: "" };
  const at = key.indexOf("\x00");
  return at < 0 ? { provider: key, model: "" } : { provider: key.slice(0, at), model: key.slice(at + 1) };
}
function storedRoute(value) {
  if (value === undefined)
    return "";
  const provider = typeof value.provider === "string" ? value.provider.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  return provider.length > 0 && model.length > 0 ? routeKey(provider, model) : "";
}
var EMBEDDING_BACKENDS = ["auto", "hash", "model2vec"];
function storedBackend(value) {
  const backend = typeof value?.embeddingBackend === "string" ? value.embeddingBackend.trim() : "";
  return EMBEDDING_BACKENDS.includes(backend) ? backend : "auto";
}

class TotemMemoryCardController {
  scope;
  ctx;
  groups = [];
  failures = [];
  catalogStatus = "idle";
  draft;
  draftBackend;
  draftRevision;
  saving = false;
  failed = false;
  conflicted = false;
  disposed = false;
  saveGeneration = 0;
  catalogGeneration = 0;
  store;
  unsubscribe;
  constructor(scope, ctx) {
    this.scope = scope;
    this.ctx = ctx;
    this.store = import_dsh_client_store.createSnapshotStore(this.projection());
    this.unsubscribe = scope.subscribe(() => {
      const snapshot = this.scope.getSnapshot();
      const dirty = this.draft !== undefined || this.draftBackend !== undefined;
      if (!this.saving && dirty && snapshot.revision !== this.draftRevision) {
        const sameRoute = this.draft === undefined || storedRoute(snapshot.value) === this.draft;
        const sameBackend = this.draftBackend === undefined || storedBackend(snapshot.value) === this.draftBackend;
        if (sameRoute && sameBackend)
          this.clearDraft();
        else
          this.conflicted = true;
      }
      this.publish();
    });
    this.loadCatalog();
  }
  dispose() {
    this.disposed = true;
    this.saveGeneration += 1;
    this.catalogGeneration += 1;
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { totemMemoryCard: this.store },
      select: (key) => {
        this.select(key);
      },
      selectBackend: (value) => {
        this.selectBackend(value);
      },
      save: () => {
        this.save();
      },
      discard: () => {
        this.discard();
      },
      retryCatalog: () => {
        this.loadCatalog();
      }
    };
  }
  refreshCatalog() {
    if (this.disposed)
      return;
    this.catalogGeneration += 1;
    this.catalogStatus = "idle";
    this.loadCatalog();
  }
  current() {
    return storedRoute(this.scope.getSnapshot().value);
  }
  currentBackend() {
    return storedBackend(this.scope.getSnapshot().value);
  }
  requested() {
    return this.draft ?? this.current();
  }
  requestedBackend() {
    return this.draftBackend ?? this.currentBackend();
  }
  select(key) {
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving)
      return;
    if (this.draft === undefined)
      this.draftRevision = snapshot.revision;
    this.draft = key;
    this.failed = false;
    this.conflicted = false;
    this.publish();
  }
  selectBackend(value) {
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving)
      return;
    if (!EMBEDDING_BACKENDS.includes(value))
      return;
    if (this.draft === undefined && this.draftBackend === undefined) {
      this.draftRevision = snapshot.revision;
    }
    this.draftBackend = value;
    this.failed = false;
    this.conflicted = false;
    this.publish();
  }
  discard() {
    if (this.saving)
      return;
    this.clearDraft();
    this.publish();
  }
  clearDraft() {
    this.draft = undefined;
    this.draftBackend = undefined;
    this.draftRevision = undefined;
    this.failed = false;
    this.conflicted = false;
  }
  async save() {
    const snapshot = this.scope.getSnapshot();
    const desired = this.requested();
    const desiredBackend = this.requestedBackend();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving || desired === this.current() && desiredBackend === this.currentBackend())
      return;
    const staged = this.draft !== undefined || this.draftBackend !== undefined;
    if (staged && snapshot.revision !== this.draftRevision) {
      this.conflicted = true;
      this.publish();
      return;
    }
    const route = parseRouteKey(desired);
    const generation = this.saveGeneration;
    this.saving = true;
    this.failed = false;
    this.conflicted = false;
    this.publish();
    await this.scope.mutate([
      { op: "set", path: ["provider"], value: route.provider },
      { op: "set", path: ["model"], value: route.model },
      { op: "set", path: ["embeddingBackend"], value: desiredBackend }
    ], this.draftRevision);
    if (generation !== this.saveGeneration)
      return;
    const landed = this.current() === desired && this.currentBackend() === desiredBackend;
    this.saving = false;
    this.failed = !landed;
    if (landed)
      this.clearDraft();
    this.publish();
  }
  async loadCatalog() {
    if (this.disposed || this.catalogStatus === "loading")
      return;
    const generation = this.catalogGeneration;
    this.catalogStatus = "loading";
    this.publish();
    const response = await this.ctx.remote.session.modelCatalog();
    if (generation !== this.catalogGeneration)
      return;
    if (response.ok) {
      this.groups = response.value.groups;
      this.failures = response.value.failures;
      this.catalogStatus = "ready";
    } else {
      this.catalogStatus = "error";
    }
    this.publish();
  }
  projection() {
    const snapshot = this.scope.getSnapshot();
    const current = this.current();
    const requested = this.requested();
    const currentBackend = this.currentBackend();
    const requestedBackend = this.requestedBackend();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: current !== requested || currentBackend !== requestedBackend,
      invalid: requested !== "" && requested !== current && !this.known(requested),
      saving: this.saving,
      failed: this.failed,
      current,
      requested,
      currentBackend,
      requestedBackend,
      groups: this.groups,
      failures: this.failures,
      catalogStatus: this.catalogStatus,
      catalogPartial: this.failures.length > 0,
      conflicted: this.conflicted
    };
  }
  known(key) {
    const route = parseRouteKey(key);
    return this.groups.some((group) => group.id === route.provider && group.models.some((model) => model.id === route.model));
  }
  publish() {
    this.store.set(this.projection());
  }
}

// src/client/TotemMemoryCard.tsx
var jsx_runtime = require("react/jsx-runtime");
var LABELS = {
  unavailable: "This deployment does not serve the Totem settings row.",
  readOnly: "This deployment stores settings read-only.",
  saveFailed: "The deployment did not accept this model; the previous choice is still active.",
  save: "Save",
  saving: "Saving…"
};
var SELECT_STYLE = {
  width: "100%",
  maxWidth: 460,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  background: "var(--dsw-alias-bg-secondary, transparent)",
  color: "inherit",
  fontSize: 13
};
var HELP_STYLE = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
function TotemMemoryCard(props) {
  const state = props.useTotemMemoryCard((snapshot) => snapshot);
  if (props.view === "summary")
    return /* @__PURE__ */ jsx_runtime.jsx("span", {
      children: "Choose the model that writes Totem memories."
    });
  const requested = parseRouteKey(state.requested);
  const storedUnavailable = state.requested !== "" && !state.dirty && !state.groups.some((group) => group.id === requested.provider && group.models.some((model) => model.id === requested.model));
  return /* @__PURE__ */ jsx_runtime.jsx(import_dsh_client_ui_primitives.SettingsForm, {
    labels: LABELS,
    state,
    onSave: props.save,
    onDiscard: props.discard,
    children: /* @__PURE__ */ jsx_runtime.jsxs("div", {
      style: { display: "flex", flexDirection: "column", gap: 8 },
      children: [
        /* @__PURE__ */ jsx_runtime.jsx("label", {
          htmlFor: "dsh-totem-memory-model",
          style: { fontSize: 13, fontWeight: 600 },
          children: "Memory model"
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("select", {
          id: "dsh-totem-memory-model",
          style: SELECT_STYLE,
          value: state.requested,
          disabled: !state.writable || state.saving || state.catalogStatus === "loading",
          onChange: (event) => {
            props.select(event.target.value);
          },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "",
              children: "Deployment default"
            }),
            state.groups.map((group) => /* @__PURE__ */ jsx_runtime.jsx("optgroup", {
              label: group.name.length > 0 ? group.name : group.id,
              children: group.models.map((model) => /* @__PURE__ */ jsx_runtime.jsx("option", {
                value: routeKey(group.id, model.id),
                children: model.name.length > 0 ? model.name : model.id
              }, routeKey(group.id, model.id)))
            }, group.id)),
            storedUnavailable ? /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: state.requested,
              children: `${requested.provider} / ${requested.model} (unavailable)`
            }) : null
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          children: "The model that writes Totem memories after file reads and edits. Leave the deployment default to reuse your main agent model, or pick any model from any configured provider."
        }),
        /* @__PURE__ */ jsx_runtime.jsx("label", {
          htmlFor: "dsh-totem-embedding-backend",
          style: { fontSize: 13, fontWeight: 600 },
          children: "Retrieval encoder"
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("select", {
          id: "dsh-totem-embedding-backend",
          style: SELECT_STYLE,
          value: state.requestedBackend,
          disabled: !state.writable || state.saving,
          onChange: (event) => {
            props.selectBackend(event.target.value);
          },
          children: [
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "auto",
              children: "Automatic (Model2Vec when installed)"
            }),
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "model2vec",
              children: "Model2Vec (potion-retrieval-32M)"
            }),
            /* @__PURE__ */ jsx_runtime.jsx("option", {
              value: "hash",
              children: "Offline hash (no extra dependency)"
            })
          ]
        }),
        /* @__PURE__ */ jsx_runtime.jsxs("p", {
          style: HELP_STYLE,
          children: [
            "The dense retrieval leg used by Totem. Model2Vec needs the optional",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("code", {
              children: "totem-mcp[embeddings]"
            }),
            " package and downloads",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("code", {
              children: "minishlab/potion-retrieval-32M"
            }),
            " on first use; the hash encoder is the dependency-free fallback. Applies the next time the Totem server starts."
          ]
        }),
        state.catalogStatus === "error" ? /* @__PURE__ */ jsx_runtime.jsxs("p", {
          style: HELP_STYLE,
          role: "status",
          children: [
            "The model catalog is unavailable.",
            " ",
            /* @__PURE__ */ jsx_runtime.jsx("button", {
              type: "button",
              onClick: props.retryCatalog,
              children: "Retry"
            })
          ]
        }) : null,
        state.catalogPartial ? /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          role: "status",
          children: "Some providers could not be listed; their saved routes remain selectable."
        }) : null,
        state.conflicted ? /* @__PURE__ */ jsx_runtime.jsx("p", {
          style: HELP_STYLE,
          role: "status",
          children: "Settings changed elsewhere; reopen this page before saving."
        }) : null
      ]
    })
  });
}

// src/client/AssistantSection.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var jsx_runtime2 = require("react/jsx-runtime");
var TABS = [
  { id: "memory", label: "Memory" },
  { id: "candidates", label: "Candidates" },
  { id: "conflicts", label: "Conflicts" },
  { id: "reminders", label: "Reminders" },
  { id: "watches", label: "Watches" },
  { id: "notifications", label: "Notifications" },
  { id: "verify", label: "Verify" },
  { id: "server", label: "Server" }
];
var FIELD = {
  width: "100%",
  maxWidth: 520,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  background: "var(--dsw-alias-bg-secondary, transparent)",
  color: "inherit",
  fontSize: 13,
  boxSizing: "border-box"
};
var MUTED = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
var CARD = {
  border: "1px solid var(--dsw-alias-border, #333)",
  borderRadius: 8,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 4
};
var ROW_ACTIONS = { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" };
function AssistantSection(props) {
  const state = props.useAssistant((snapshot) => snapshot);
  const [draft, setDraft] = import_react.useState({
    ntfyUrl: state.config.ntfyUrl ?? "https://ntfy.sh",
    ntfyTopic: state.config.ntfyTopic ?? "",
    ntfyToken: state.config.ntfyToken ?? "",
    telegramBotToken: state.config.telegramBotToken ?? "",
    telegramChatId: state.config.telegramChatId ?? ""
  });
  const [watch, setWatch] = import_react.useState({ kind: "page", url: "", condition: "", interval: "15" });
  const [verifyDraft, setVerifyDraft] = import_react.useState({ command: state.verifyCommand, disable: state.verifyDisable });
  const [confirmRestart, setConfirmRestart] = import_react.useState(false);
  import_react.useEffect(() => {
    setVerifyDraft({ command: state.verifyCommand, disable: state.verifyDisable });
  }, [state.verifyCommand, state.verifyDisable]);
  return /* @__PURE__ */ jsx_runtime2.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" },
    children: [
      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", gap: 6, flexWrap: "wrap" },
        children: [
          TABS.map((tab) => /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
            variant: state.tab === tab.id ? "primary" : "ghost",
            onClick: () => {
              props.setTab(tab.id);
            },
            children: tab.label
          }, tab.id)),
          /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
            variant: "ghost",
            onClick: props.refresh,
            disabled: state.status === "loading",
            children: "Refresh"
          })
        ]
      }),
      state.error === null ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
        style: { ...MUTED, color: "var(--dsw-alias-text-error, #e5484d)" },
        role: "status",
        children: state.error
      }),
      state.notice === null ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
        style: MUTED,
        role: "status",
        children: state.notice
      }),
      state.tab === "memory" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 8, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: { ...FIELD, flex: "1 1 320px" },
                value: state.project,
                placeholder: "Project path (absolute)",
                onChange: (event) => {
                  props.setProject(event.target.value);
                }
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: { ...FIELD, flex: "1 1 220px" },
                value: state.query,
                placeholder: "Search memory…",
                onChange: (event) => {
                  props.setQuery(event.target.value);
                },
                onKeyDown: (event) => {
                  if (event.key === "Enter")
                    props.search();
                }
              }),
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "outline",
                onClick: props.search,
                disabled: state.status === "loading",
                children: "Search"
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Searches the selected project's Totem store. Leave the query empty to list recent memories."
          }),
          state.memories.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No memories."
          }) : state.memories.map((item, index) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  item.type === undefined ? "" : `[${item.type}] `,
                  item.title ?? item.id ?? ""
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: item.statement ?? ""
              }),
              item.tags === undefined || item.tags.length === 0 ? null : /* @__PURE__ */ jsx_runtime2.jsx("p", {
                style: MUTED,
                children: item.tags.join(" · ")
              })
            ]
          }, item.id ?? `${index}`))
        ]
      }) : null,
      state.tab === "candidates" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Memories distilled from completed turns, waiting for approval. Approved items are written to the project's Totem store."
          }),
          state.candidates.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No pending candidates."
          }) : state.candidates.map((candidate) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  "[",
                  candidate.type,
                  "] ",
                  candidate.title
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: candidate.statement
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  candidate.project,
                  " · ",
                  candidate.tags.join(" · ")
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.approve(candidate.id);
                    },
                    disabled: state.writing,
                    children: "Approve"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.reject(candidate.id);
                    },
                    disabled: state.writing,
                    children: "Reject"
                  })
                ]
              })
            ]
          }, candidate.id))
        ]
      }) : null,
      state.tab === "conflicts" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Contradictions detected when a memory was written. Resolving one records a contradiction between the pair and, when you keep a side, supersedes the other memory."
          }),
          state.conflictSummary === null ? null : /* @__PURE__ */ jsx_runtime2.jsxs("p", {
            style: MUTED,
            children: [
              state.conflictSummary.total,
              " memories · ",
              state.conflictSummary.durable,
              " durable ·",
              " ",
              state.conflictSummary.staleItems,
              " with stale evidence (",
              Math.round(state.conflictSummary.staleRatio * 100),
              "%)"
            ]
          }),
          state.conflicts.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No open conflicts."
          }) : state.conflicts.map((conflict) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: conflict.condition || "Conflicting claims"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13 },
                children: [
                  "A: ",
                  conflict.claimA || conflict.itemA
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13 },
                children: [
                  "B: ",
                  conflict.claimB || conflict.itemB
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  conflict.itemA.slice(0, 8),
                  " · ",
                  conflict.itemB.slice(0, 8),
                  " · ",
                  new Date(conflict.createdAt).toLocaleString()
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.resolveConflict(conflict.id, "keep-a");
                    },
                    disabled: state.writing,
                    children: "Keep A"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    onClick: () => {
                      props.resolveConflict(conflict.id, "keep-b");
                    },
                    disabled: state.writing,
                    children: "Keep B"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.resolveConflict(conflict.id, "both");
                    },
                    disabled: state.writing,
                    children: "Keep both"
                  })
                ]
              })
            ]
          }, conflict.id))
        ]
      }) : null,
      state.tab === "reminders" ? /* @__PURE__ */ jsx_runtime2.jsx("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: state.reminders.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
          style: MUTED,
          children: state.status === "loading" ? "Loading…" : "No pending reminders. Ask the agent to remind you."
        }) : state.reminders.map((reminder) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
          style: CARD,
          children: [
            /* @__PURE__ */ jsx_runtime2.jsx("div", {
              style: { fontSize: 13, fontWeight: 600 },
              children: reminder.text
            }),
            /* @__PURE__ */ jsx_runtime2.jsxs("p", {
              style: MUTED,
              children: [
                reminder.kind,
                reminder.next === undefined ? " · no further notifications" : ` · next ${new Date(reminder.next.at).toLocaleString()} (${reminder.next.label})`,
                reminder.snoozedUntil === undefined ? "" : ` · snoozed until ${new Date(reminder.snoozedUntil).toLocaleString()}`
              ]
            }),
            /* @__PURE__ */ jsx_runtime2.jsxs("div", {
              style: ROW_ACTIONS,
              children: [
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "outline",
                  onClick: () => {
                    props.snooze(reminder.id, 10);
                  },
                  disabled: state.writing,
                  children: "Snooze 10m"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "outline",
                  onClick: () => {
                    props.ackReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Ack"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "ghost",
                  onClick: () => {
                    props.doneReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Done"
                }),
                /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "ghost",
                  onClick: () => {
                    props.cancelReminder(reminder.id);
                  },
                  disabled: state.writing,
                  children: "Cancel"
                })
              ]
            })
          ]
        }, reminder.id))
      }) : null,
      state.tab === "watches" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { ...CARD, gap: 8 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: "Add a watch"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { display: "flex", gap: 8, flexWrap: "wrap" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: { ...FIELD, width: 160 },
                    value: watch.kind,
                    onChange: (event) => {
                      setWatch({ ...watch, kind: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "page",
                        children: "Page changes"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "rss",
                        children: "Feed items"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "condition",
                        children: "Condition"
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: { ...FIELD, flex: "1 1 280px" },
                    placeholder: "https://…",
                    value: watch.url,
                    onChange: (event) => {
                      setWatch({ ...watch, url: event.target.value });
                    }
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: { ...FIELD, width: 110 },
                    placeholder: "minutes",
                    value: watch.interval,
                    onChange: (event) => {
                      setWatch({ ...watch, interval: event.target.value });
                    }
                  })
                ]
              }),
              watch.kind === "condition" ? /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "Condition (answered YES/NO)",
                value: watch.condition,
                onChange: (event) => {
                  setWatch({ ...watch, condition: event.target.value });
                }
              }) : null,
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                  variant: "primary",
                  disabled: state.writing || watch.url.trim().length === 0,
                  onClick: () => {
                    props.addWatch(watch);
                    setWatch({ kind: "page", url: "", condition: "", interval: "15" });
                  },
                  children: "Add watch"
                })
              })
            ]
          }),
          state.watches.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.status === "loading" ? "Loading…" : "No watches."
          }) : state.watches.map((item) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  item.kind,
                  " · ",
                  item.url
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                style: MUTED,
                children: [
                  "every ",
                  item.intervalMinutes,
                  "m · ",
                  item.active ? "active" : "stopped",
                  item.lastResult === undefined ? "" : ` · ${item.lastResult}`,
                  item.condition === undefined ? "" : ` · ${item.condition}`
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "outline",
                    onClick: () => {
                      props.runWatch(item.id);
                    },
                    disabled: state.writing,
                    children: "Run now"
                  }),
                  item.active ? /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "ghost",
                    onClick: () => {
                      props.cancelWatch(item.id);
                    },
                    disabled: state.writing,
                    children: "Stop"
                  }) : null
                ]
              })
            ]
          }, item.id))
        ]
      }) : null,
      state.tab === "notifications" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Reminders and watches deliver through ntfy and/or Telegram. Leave a channel empty to disable it."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy URL"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.ntfyUrl,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyUrl: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy topic"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.ntfyTopic,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyTopic: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "ntfy token (optional)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                type: "password",
                value: draft.ntfyToken,
                onChange: (event) => {
                  setDraft({ ...draft, ntfyToken: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Telegram bot token"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                type: "password",
                value: draft.telegramBotToken,
                onChange: (event) => {
                  setDraft({ ...draft, telegramBotToken: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Telegram chat id"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: draft.telegramChatId,
                onChange: (event) => {
                  setDraft({ ...draft, telegramChatId: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: ROW_ACTIONS,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "primary",
                onClick: () => {
                  props.saveConfig(draft);
                },
                disabled: state.writing,
                children: "Save"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "outline",
                onClick: props.testNotification,
                disabled: state.writing,
                children: "Send test"
              })
            ]
          })
        ]
      }) : null,
      state.tab === "verify" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Deterministic rules run at the end of every turn and warn only: a finding is reported in the turn card, never enforced. No model is involved."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Verify command (optional, run once per turn)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: verifyDraft.command,
                placeholder: "e.g. bun test",
                onChange: (event) => {
                  setVerifyDraft({ ...verifyDraft, command: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Disabled rules (comma separated ids)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                value: verifyDraft.disable,
                placeholder: "e.g. debug-breakpoint",
                onChange: (event) => {
                  setVerifyDraft({ ...verifyDraft, disable: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            style: ROW_ACTIONS,
            children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
              variant: "primary",
              onClick: () => {
                props.saveVerify(verifyDraft.command, verifyDraft.disable);
              },
              disabled: state.writing,
              children: "Save"
            })
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("p", {
            style: MUTED,
            children: [
              state.verifyRules.length,
              " rule(s) active."
            ]
          }),
          state.verifyRules.map((rule) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { fontSize: 13, fontWeight: 600 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("code", {
                    style: { fontSize: 12 },
                    children: rule.id
                  }),
                  " · ",
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 11, color: rule.severity === "high" ? "var(--dsw-alias-state-error-primary, #e5484d)" : "var(--dsw-alias-text-secondary, #9a9a9a)" },
                    children: rule.severity
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("div", {
                style: { fontSize: 13 },
                children: rule.description
              })
            ]
          }, rule.id))
        ]
      }) : null,
      state.tab === "server" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "Restarts the DSH host that serves this page. The session survives and this page reloads as soon as the replacement answers. A restart pressed during a turn waits for that turn to finish, so nothing is cut in half."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: CARD,
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Host"
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("span", {
                style: MUTED,
                children: [
                  "pid ",
                  state.host?.pid ?? "—",
                  " · ",
                  state.host?.busy === true ? "a turn is running" : "idle"
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("span", {
                style: MUTED,
                children: [
                  "launcher: ",
                  state.host?.launcher ?? "not found (set restartCommand)"
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { ...ROW_ACTIONS, alignItems: "stretch" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "primary",
                style: { minHeight: 44, flex: "1 1 220px" },
                disabled: state.restarting || state.host?.launcher === null,
                onClick: () => {
                  if (confirmRestart) {
                    setConfirmRestart(false);
                    props.restartServer();
                    return;
                  }
                  setConfirmRestart(true);
                },
                children: state.restarting ? state.restartMessage ?? "Restarting…" : confirmRestart ? "Tap again to restart" : "Restart DSH server"
              }),
              confirmRestart && !state.restarting ? /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                variant: "ghost",
                style: { minHeight: 44 },
                onClick: () => {
                  setConfirmRestart(false);
                },
                children: "Cancel"
              }) : null
            ]
          }),
          confirmRestart && !state.restarting ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "The page disconnects for a few seconds and reloads itself."
          }) : null,
          state.restartMessage !== null && !state.restarting ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: state.restartMessage
          }) : null
        ]
      }) : null
    ]
  });
}

// src/client/assistant-controller.ts
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
class AssistantController {
  form;
  ctx;
  store;
  unsubscribe;
  tab = "memory";
  project = "";
  query = "";
  memories = [];
  candidates = [];
  conflicts = [];
  conflictSummary = null;
  reminders = [];
  watches = [];
  verifyRules = [];
  verifyCommand = "";
  verifyDisable = "";
  host = null;
  restarting = false;
  restartMessage = null;
  status = "idle";
  error = null;
  notice = null;
  writing = false;
  disposed = false;
  constructor(form, ctx) {
    this.form = form;
    this.ctx = ctx;
    this.store = import_dsh_client_store2.createSnapshotStore(this.projection());
    this.unsubscribe = form.subscribe(() => {
      this.publish();
    });
    this.loadState();
  }
  dispose() {
    this.disposed = true;
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { assistant: this.store },
      setTab: (tab) => {
        this.setTab(tab);
      },
      setProject: (project) => {
        this.project = project;
        this.publish();
      },
      setQuery: (query) => {
        this.query = query;
        this.publish();
      },
      search: () => {
        this.search();
      },
      refresh: () => {
        this.refresh();
      },
      approve: (id) => {
        this.action(`/candidates/${encodeURIComponent(id)}/approve`, "Memory approved.");
      },
      reject: (id) => {
        this.action(`/candidates/${encodeURIComponent(id)}/reject`, "Candidate rejected.");
      },
      resolveConflict: (id, resolution) => {
        this.action(`/conflicts/${encodeURIComponent(id)}/resolve`, "Conflict resolved.", { resolution });
      },
      snooze: (id, minutes) => {
        this.action(`/reminders/${encodeURIComponent(id)}/snooze`, "Reminder snoozed.", { minutes });
      },
      doneReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/done`, "Reminder done.");
      },
      ackReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/ack`, "Notification acknowledged.");
      },
      cancelReminder: (id) => {
        this.action(`/reminders/${encodeURIComponent(id)}/cancel`, "Reminder canceled.");
      },
      runWatch: (id) => {
        this.action(`/watches/${encodeURIComponent(id)}/run`, "Watch checked.");
      },
      cancelWatch: (id) => {
        this.action(`/watches/${encodeURIComponent(id)}/cancel`, "Watch stopped.");
      },
      addWatch: (draft) => {
        this.addWatch(draft);
      },
      saveConfig: (values) => {
        this.saveConfig(values);
      },
      saveVerify: (command, disable) => {
        this.saveVerify(command, disable);
      },
      testNotification: () => {
        this.testNotification();
      },
      restartServer: () => {
        this.restartServer();
      }
    };
  }
  config() {
    return this.form.getSnapshot().value ?? {};
  }
  token() {
    return this.config().apiToken?.trim() ?? "";
  }
  projection() {
    return {
      tab: this.tab,
      project: this.project,
      query: this.query,
      memories: this.memories,
      candidates: this.candidates,
      conflicts: this.conflicts,
      conflictSummary: this.conflictSummary,
      reminders: this.reminders,
      watches: this.watches,
      status: this.status,
      error: this.error,
      notice: this.notice,
      config: this.config(),
      writing: this.writing,
      verifyRules: this.verifyRules,
      verifyCommand: this.verifyCommand,
      verifyDisable: this.verifyDisable,
      host: this.host,
      restarting: this.restarting,
      restartMessage: this.restartMessage
    };
  }
  publish() {
    if (this.disposed)
      return;
    this.store.set(this.projection());
  }
  async loadState() {
    try {
      const state = await this.request("/state");
      if (this.project.length === 0)
        this.project = state.lastProject ?? "";
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.publish();
    }
  }
  setTab(tab) {
    this.tab = tab;
    this.notice = null;
    this.error = null;
    this.refresh();
  }
  async request(path, init) {
    const token = this.token();
    if (token.length === 0)
      throw new Error("Set the assistant apiToken in the Totem plugin config first.");
    const response = await fetch(`/totem${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${token}`,
        ...init?.body === undefined ? {} : { "content-type": "application/json" }
      }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error ?? `request failed (${response.status})`);
    }
    return await response.json();
  }
  async refresh() {
    this.status = "loading";
    this.error = null;
    this.publish();
    try {
      if (this.tab === "memory")
        await this.search(false);
      else if (this.tab === "candidates") {
        const data = await this.request("/candidates");
        this.candidates = data.items.filter((item) => item.status === "pending");
      } else if (this.tab === "conflicts") {
        const params = new URLSearchParams;
        if (this.project.length > 0)
          params.set("project", this.project);
        const data = await this.request(`/conflicts?${params.toString()}`);
        this.conflicts = data.items;
        this.conflictSummary = data.summary ?? null;
      } else if (this.tab === "reminders") {
        const data = await this.request("/reminders");
        this.reminders = data.items.filter((item) => !item.done);
      } else if (this.tab === "watches") {
        const data = await this.request("/watches");
        this.watches = data.items;
      } else if (this.tab === "verify") {
        const data = await this.request("/verify/rules");
        this.verifyRules = data.rules;
        this.verifyCommand = data.settings.command;
        this.verifyDisable = data.settings.disable.join(", ");
      } else if (this.tab === "server") {
        this.host = await this.request("/host");
      }
      this.status = "ready";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    }
    this.publish();
  }
  async restartServer() {
    if (this.restarting)
      return;
    this.restarting = true;
    this.error = null;
    this.restartMessage = "Scheduling the restart…";
    this.publish();
    try {
      const before = this.host ?? await this.request("/host");
      this.host = before;
      const { plan } = await this.request("/restart", {
        method: "POST",
        body: JSON.stringify({ idle: true })
      });
      this.restartMessage = plan.mode === "idle" ? "Waiting for the running turn to finish…" : "Restarting the host…";
      this.publish();
      await this.waitForNewHost(before.pid);
      this.restartMessage = "Host is back — reloading…";
      this.publish();
      const location = globalThis.location;
      location?.reload();
    } catch (error) {
      this.restarting = false;
      this.restartMessage = null;
      this.error = error instanceof Error ? error.message : String(error);
      this.publish();
    }
  }
  async waitForNewHost(pid) {
    const deadline = Date.now() + 120000;
    let sawDown = false;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        const host = await this.request("/host");
        if (host.pid !== pid)
          return;
      } catch {
        sawDown = true;
      }
    }
    throw new Error(sawDown ? "the host went down but did not come back within two minutes" : "the host did not restart within two minutes");
  }
  async search(publishLoading = true) {
    if (publishLoading) {
      this.status = "loading";
      this.publish();
    }
    const params = new URLSearchParams({ project: this.project, limit: "100" });
    if (this.query.trim().length > 0)
      params.set("query", this.query.trim());
    const data = await this.request(`/memories?${params.toString()}`);
    this.memories = data.items;
    this.status = "ready";
    this.publish();
  }
  async action(path, notice, bodyValue) {
    this.writing = true;
    this.error = null;
    this.publish();
    try {
      await this.request(path, {
        method: "POST",
        ...bodyValue === undefined ? {} : { body: JSON.stringify(bodyValue) }
      });
      this.notice = notice;
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.publish();
    } finally {
      this.writing = false;
      this.publish();
    }
  }
  async addWatch(draft) {
    const interval = Number(draft.interval);
    this.writing = true;
    this.error = null;
    this.publish();
    try {
      await this.request("/watches", {
        method: "POST",
        body: JSON.stringify({
          kind: draft.kind,
          url: draft.url,
          condition: draft.condition,
          intervalMinutes: Number.isFinite(interval) && interval > 0 ? interval : 15
        })
      });
      this.notice = "Watch added.";
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    } finally {
      this.writing = false;
      this.publish();
    }
  }
  async saveConfig(values) {
    const snapshot = this.form.getSnapshot();
    const fields = [
      "ntfyUrl",
      "ntfyTopic",
      "ntfyToken",
      "telegramBotToken",
      "telegramChatId"
    ];
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate(fields.map((field) => ({
      op: "set",
      path: [field],
      value: values[field] ?? ""
    })), snapshot.revision);
    this.writing = false;
    this.notice = ok ? "Notification settings saved." : null;
    this.error = ok ? null : "The Host did not accept the notification settings.";
    this.publish();
  }
  async saveVerify(command, disable) {
    const snapshot = this.form.getSnapshot();
    const ids = disable.split(",").map((part) => part.trim()).filter(Boolean);
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate([
      { op: "set", path: ["verifyCommand"], value: command },
      { op: "set", path: ["verifyDisable"], value: ids }
    ], snapshot.revision);
    this.writing = false;
    this.verifyCommand = command;
    this.verifyDisable = ids.join(", ");
    this.notice = ok ? "Verification settings saved." : null;
    this.error = ok ? null : "The Host did not accept the verification settings.";
    this.publish();
  }
  async testNotification() {
    this.writing = true;
    this.publish();
    try {
      const result = await this.request("/notify-test", {
        method: "POST",
        body: JSON.stringify({ title: "dsh-totem", message: "Notifications are configured correctly." })
      });
      this.notice = `Test sent: ${JSON.stringify(result)}`;
      this.error = null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.writing = false;
      this.publish();
    }
  }
}

// src/client/verify-card.ts
var CACHE_MS = 600;

class VerifyController {
  form;
  cache = new Map;
  constructor(form) {
    this.form = form;
  }
  token() {
    return this.form.getSnapshot().value?.apiToken?.trim() ?? "";
  }
  async request(path) {
    const token = this.token();
    if (token.length === 0)
      return;
    try {
      const response = await fetch(`/totem${path}`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok)
        return;
      return await response.json();
    } catch {
      return;
    }
  }
  lookupTurn = async (turn) => {
    const hit = this.cache.get(turn);
    if (hit !== undefined && Date.now() - hit.at < CACHE_MS)
      return hit.result;
    const data = await this.request(`/verify?turn=${turn}`);
    const result = data?.result ?? null;
    this.cache.set(turn, { at: Date.now(), result });
    return result;
  };
  async rules() {
    const data = await this.request("/verify/rules");
    return {
      rules: data?.rules ?? [],
      command: data?.settings?.command ?? "",
      disable: data?.settings?.disable ?? []
    };
  }
}

// src/client/VerifyTurnCard.tsx
var import_react2 = require("react");

// src/client/turn.ts
function turnNumberOf(value) {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "object" && value !== null) {
    const candidate = value.turn;
    if (typeof candidate === "number" && Number.isFinite(candidate))
      return candidate;
  }
  return;
}
function turnStatusOf(value) {
  if (typeof value !== "object" || value === null)
    return "unknown";
  const status = value.status;
  return status === "open" || status === "closed" ? status : "unknown";
}

// src/client/VerifyTurnCard.tsx
var jsx_runtime3 = require("react/jsx-runtime");
var HIGH = "var(--dsw-alias-state-error-primary, #e5534b)";
var MEDIUM = "var(--dsw-alias-state-warning-primary, #d29922)";
var MUTED2 = "var(--dsw-alias-text-secondary, #9a9a9a)";
var BORDER = "var(--dsw-alias-border, #333)";
function severityColor(severity) {
  return severity === "high" ? HIGH : MEDIUM;
}
function FindingRow({ finding }) {
  return /* @__PURE__ */ jsx_runtime3.jsxs("li", {
    style: { display: "flex", gap: 8, alignItems: "baseline", padding: "3px 0" },
    children: [
      /* @__PURE__ */ jsx_runtime3.jsx("span", {
        style: {
          flex: "0 0 auto",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 11,
          color: severityColor(finding.severity)
        },
        children: finding.rule
      }),
      /* @__PURE__ */ jsx_runtime3.jsxs("span", {
        style: { flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" },
        children: [
          finding.path === undefined || finding.path.length === 0 ? "" : /* @__PURE__ */ jsx_runtime3.jsxs("code", {
            style: { fontSize: 11 },
            children: [
              finding.path,
              " "
            ]
          }),
          finding.detail
        ]
      }),
      /* @__PURE__ */ jsx_runtime3.jsx("span", {
        style: { flex: "0 0 auto", fontSize: 10, color: MUTED2 },
        children: finding.source ?? finding.tool ?? ""
      })
    ]
  });
}
function VerifyTurnCard({ turn, lookupTurn }) {
  const number = turnNumberOf(turn);
  const status = turnStatusOf(turn);
  const [result, setResult] = import_react2.useState(undefined);
  import_react2.useEffect(() => {
    if (number === undefined)
      return;
    let active = true;
    lookupTurn(number).then((loaded) => {
      if (active)
        setResult(loaded);
    });
    return () => {
      active = false;
    };
  }, [number, status, lookupTurn]);
  if (result === undefined || result === null)
    return null;
  if (result.findings.length === 0 && result.command === undefined)
    return null;
  const { findings } = result;
  const high = findings.filter((finding) => finding.severity === "high").length;
  const mutated = result.command !== undefined;
  return /* @__PURE__ */ jsx_runtime3.jsxs("section", {
    "aria-label": "Deterministic verification",
    style: {
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${high > 0 ? HIGH : BORDER}`,
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 12,
      lineHeight: 1.5
    },
    children: [
      /* @__PURE__ */ jsx_runtime3.jsxs("header", {
        style: { display: "flex", gap: 8, alignItems: "baseline", marginBottom: findings.length === 0 ? 0 : 4 },
        children: [
          /* @__PURE__ */ jsx_runtime3.jsx("strong", {
            style: { fontSize: 12 },
            children: "Verification"
          }),
          /* @__PURE__ */ jsx_runtime3.jsxs("span", {
            style: { color: MUTED2 },
            children: [
              findings.length === 0 ? "clean" : `${findings.length} finding${findings.length === 1 ? "" : "s"}${high > 0 ? ` (${high} high)` : ""}`,
              " · ",
              result.ms,
              " ms",
              mutated ? ` · command ${result.command?.ok === true ? "passed" : "failed"}` : ""
            ]
          })
        ]
      }),
      findings.length === 0 ? null : /* @__PURE__ */ jsx_runtime3.jsx("ul", {
        style: { listStyle: "none", margin: 0, padding: 0 },
        children: findings.map((finding, index) => /* @__PURE__ */ jsx_runtime3.jsx(FindingRow, {
          finding
        }, `${finding.rule}:${finding.path ?? ""}:${index}`))
      })
    ]
  });
}

// src/client/SessionUnreadIcon.tsx
var jsx_runtime4 = require("react/jsx-runtime");
function SessionUnreadIcon() {
  return /* @__PURE__ */ jsx_runtime4.jsxs("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsx_runtime4.jsx("circle", {
        cx: "8",
        cy: "8",
        r: "5.2",
        stroke: "currentColor",
        strokeWidth: "1.4"
      }),
      /* @__PURE__ */ jsx_runtime4.jsx("circle", {
        cx: "8",
        cy: "8",
        r: "2.2",
        fill: "currentColor"
      })
    ]
  });
}

// src/client/unread-store.ts
var UNREAD_KEY = "dsh-totem:unread-sessions";
var MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
function defaultStorage() {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return;
  }
}
function readUnread(storage = defaultStorage()) {
  if (storage === undefined)
    return [];
  let parsed;
  try {
    const raw = storage.getItem(UNREAD_KEY);
    parsed = raw === null ? undefined : JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed))
    return [];
  const now = Date.now();
  const seen = new Set;
  const records = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null)
      continue;
    const record = entry;
    if (typeof record.sessionId !== "string" || record.sessionId.length === 0)
      continue;
    const markedAt = typeof record.markedAt === "number" && Number.isFinite(record.markedAt) ? record.markedAt : now;
    if (now - markedAt > MAX_AGE_MS || seen.has(record.sessionId))
      continue;
    seen.add(record.sessionId);
    records.push({ sessionId: record.sessionId, markedAt });
  }
  return records.sort((left, right) => right.markedAt - left.markedAt);
}
function writeUnread(records, storage = defaultStorage()) {
  if (storage === undefined)
    return;
  try {
    storage.setItem(UNREAD_KEY, JSON.stringify(records));
  } catch {}
}
function withMark(records, sessionId, markedAt = Date.now()) {
  const rest = records.filter((record) => record.sessionId !== sessionId);
  return [{ sessionId, markedAt }, ...rest].sort((left, right) => right.markedAt - left.markedAt);
}
function withoutMark(records, sessionId) {
  return records.filter((record) => record.sessionId !== sessionId);
}
function markStored(sessionId, storage) {
  const records = withMark(readUnread(storage), sessionId);
  writeUnread(records, storage);
  return records;
}
function clearStored(sessionId, storage) {
  const records = withoutMark(readUnread(storage), sessionId);
  writeUnread(records, storage);
  return records;
}

// src/client/session-unread.ts
function currentKey(session) {
  const snapshot = session.current.getSnapshot?.() ?? session.current.value;
  return snapshot?.key;
}

class SessionUnreadController {
  session;
  storage;
  constructor(session, storage) {
    this.session = session;
    this.storage = storage;
  }
  isCurrent(sessionId) {
    return currentKey(this.session) === sessionId;
  }
  mark(sessionId) {
    if (sessionId.length === 0)
      return false;
    markStored(sessionId, this.storage);
    this.session.completionUnread.add(sessionId);
    this.session.publishStatus();
    return true;
  }
  restore() {
    const statuses = this.session.sessionStatus.getSnapshot();
    const current = currentKey(this.session);
    let changed = false;
    for (const record of readUnread(this.storage)) {
      const status = statuses.get(record.sessionId);
      if (status?.running === true || record.sessionId === current) {
        clearStored(record.sessionId, this.storage);
        continue;
      }
      if (this.session.completionUnread.has(record.sessionId))
        continue;
      this.session.completionUnread.add(record.sessionId);
      changed = true;
    }
    if (changed)
      this.session.publishStatus();
  }
  watch() {
    return this.session.sessionStatus.subscribe(() => {
      const statuses = this.session.sessionStatus.getSnapshot();
      const current = currentKey(this.session);
      for (const record of readUnread(this.storage)) {
        const resumed = statuses.get(record.sessionId)?.running === true;
        if (resumed || record.sessionId === current)
          clearStored(record.sessionId, this.storage);
      }
    });
  }
}

// src/client/unread-menu.ts
var UNREAD_MENU_ORDER = 350;
function unreadMenuActions(target, deps) {
  const { sessionId } = target;
  if (sessionId.length === 0)
    return [];
  if (deps.isCurrent(sessionId))
    return [];
  const status = deps.statusOf(sessionId);
  if (status?.running === true)
    return [];
  if (status?.completionUnread === true)
    return [];
  return [{
    id: "totem-unread",
    label: "Mark as unread",
    icon: { key: "totem.unread" },
    run: () => {
      deps.mark(sessionId);
    }
  }];
}

// src/client/OverviewPage.tsx
var import_react3 = require("react");
var jsx_runtime5 = require("react/jsx-runtime");
var PAGE = {
  height: "100%",
  overflowY: "auto",
  padding: "28px 32px 40px",
  display: "flex",
  justifyContent: "center"
};
var INNER = { width: "100%", maxWidth: 1040, display: "flex", flexDirection: "column", gap: 22 };
var MUTED3 = { color: "var(--dsw-alias-text-secondary, #9a9a9a)", fontSize: 12 };
var CARD2 = {
  border: "1px solid var(--dsw-alias-border, #2e2e2e)",
  borderRadius: 12,
  background: "var(--dsw-alias-bg-secondary, #161616)",
  padding: "16px 18px"
};
var CHIP = {
  border: "1px solid var(--dsw-alias-border, #3a3a3a)",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 11,
  cursor: "pointer",
  background: "transparent",
  color: "var(--dsw-alias-text-secondary, #9a9a9a)"
};
var COLORS = ["var(--dsw-alias-bg-tertiary, #1b1f24)", "#0e3a5c", "#0b5cad", "#1d8cf8", "#4cb3ff"];
var SOURCES = [
  { id: "all", label: "All" },
  { id: "dsh", label: "dsh" },
  { id: "opencode", label: "opencode" },
  { id: "encoder", label: "encoder" }
];
function compact(value) {
  if (!Number.isFinite(value) || value <= 0)
    return "0";
  if (value >= 1000000000000)
    return `${(value / 1000000000000).toFixed(2)}T`;
  if (value >= 1e9)
    return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)
    return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1000)
    return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}
function integer(value) {
  return Math.round(value).toLocaleString();
}
function shortDate(date) {
  if (date.length === 0)
    return "—";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function shift(date, days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toLocaleDateString("en-CA");
}
function dayOfWeek(date) {
  return new Date(`${date}T12:00:00`).getDay();
}
function buildWeeks(days, mode) {
  const totals = new Map;
  let running = 0;
  for (const day of [...days].sort((left, right) => left.date.localeCompare(right.date))) {
    running += day.tokens;
    totals.set(day.date, mode === "cumulative" ? running : day.tokens);
  }
  const todayKey = new Date().toLocaleDateString("en-CA");
  const start = shift(todayKey, -364);
  const startAligned = shift(start, -dayOfWeek(start));
  const values = [...totals.values()].filter((value) => value > 0).sort((left, right) => left - right);
  const threshold = (quantile) => values.length === 0 ? 0 : values[Math.min(values.length - 1, Math.floor(values.length * quantile))];
  const levels = [threshold(0.25), threshold(0.5), threshold(0.75), threshold(0.9)];
  const weeks = [];
  for (let week = 0;week < 53; week++) {
    const column = [];
    for (let weekday = 0;weekday < 7; weekday++) {
      const date = shift(startAligned, week * 7 + weekday);
      const future = date > todayKey;
      const value = totals.get(date) ?? 0;
      const level = value <= 0 ? 0 : value <= levels[0] ? 1 : value <= levels[1] ? 2 : value <= levels[2] ? 3 : 4;
      column.push({ date, value, level, future });
    }
    weeks.push(column);
  }
  return weeks;
}
function Heatmap({ days, mode }) {
  const weeks = import_react3.useMemo(() => buildWeeks(days, mode), [days, mode]);
  const labels = import_react3.useMemo(() => {
    let previous = "";
    return weeks.map((column) => {
      const month = column[0].date.slice(0, 7);
      if (month === previous)
        return "";
      previous = month;
      return new Date(`${column[0].date}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
    });
  }, [weeks]);
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 6, overflowX: "auto" },
    children: [
      /* @__PURE__ */ jsx_runtime5.jsx("div", {
        style: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "13px", gap: 2, minWidth: 53 * 15 },
        children: labels.map((label, index) => /* @__PURE__ */ jsx_runtime5.jsx("span", {
          style: { ...MUTED3, fontSize: 10, whiteSpace: "nowrap" },
          children: label
        }, index))
      }),
      /* @__PURE__ */ jsx_runtime5.jsx("div", {
        style: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "13px", gap: 2, minWidth: 53 * 15 },
        children: weeks.map((column, index) => /* @__PURE__ */ jsx_runtime5.jsx("div", {
          style: { display: "grid", gridTemplateRows: "repeat(7, 13px)", gap: 2 },
          children: column.map((cell) => /* @__PURE__ */ jsx_runtime5.jsx("div", {
            title: cell.future ? "" : `${cell.date} · ${integer(cell.value)} tokens`,
            style: {
              width: 13,
              height: 13,
              borderRadius: 3,
              background: cell.future ? "transparent" : COLORS[cell.level],
              opacity: cell.future ? 0 : 1
            }
          }, cell.date))
        }, index))
      }),
      /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        style: { display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" },
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            style: { ...MUTED3, fontSize: 10 },
            children: "Less"
          }),
          COLORS.map((color, index) => /* @__PURE__ */ jsx_runtime5.jsx("span", {
            style: { width: 11, height: 11, borderRadius: 2, background: color }
          }, index)),
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            style: { ...MUTED3, fontSize: 10 },
            children: "More"
          })
        ]
      })
    ]
  });
}
function Stat({ label, value }) {
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 108 },
    children: [
      /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: { fontSize: 15, fontWeight: 600 },
        children: value
      }),
      /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: { ...MUTED3, fontSize: 11 },
        children: label
      })
    ]
  });
}
function Failure({ reason, status }) {
  const text = reason === "unauthorized" ? "Set the Totem `apiToken` in Plugins, then reload this page." : reason === "missing-route" ? "The Host has not loaded the Overview endpoint (404). Restart `dsh-totem` and reload." : reason === "offline" ? "Cannot reach the Host. Check that the app is running." : `The Host returned an error${status === undefined ? "" : ` (${status})`}.`;
  return /* @__PURE__ */ jsx_runtime5.jsx("div", {
    style: { ...PAGE, alignItems: "center", justifyContent: "center" },
    children: /* @__PURE__ */ jsx_runtime5.jsxs("div", {
      style: { ...CARD2, maxWidth: 480, textAlign: "center" },
      children: [
        /* @__PURE__ */ jsx_runtime5.jsx("div", {
          style: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
          children: "Overview unavailable"
        }),
        /* @__PURE__ */ jsx_runtime5.jsx("div", {
          style: MUTED3,
          children: text
        })
      ]
    })
  });
}
function OverviewPage(props) {
  const [source, setSource] = import_react3.useState("all");
  const [result, setResult] = import_react3.useState(null);
  const [mode, setMode] = import_react3.useState("daily");
  const [importing, setImporting] = import_react3.useState(false);
  import_react3.useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await props.load(source);
      if (active)
        setResult(next);
    };
    load();
    const timer = setInterval(() => {
      load();
    }, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [source]);
  const runImport = async () => {
    if (importing)
      return;
    setImporting(true);
    const next = await props.importHistory();
    setImporting(false);
    if (next.ok) {
      setSource("all");
      setResult(await props.load("all"));
    } else {
      setResult(next);
    }
  };
  if (result === null) {
    return /* @__PURE__ */ jsx_runtime5.jsx("div", {
      style: { ...PAGE, alignItems: "center", justifyContent: "center" },
      children: /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: MUTED3,
        children: "Loading usage…"
      })
    });
  }
  if (!result.ok)
    return /* @__PURE__ */ jsx_runtime5.jsx(Failure, {
      reason: result.reason,
      status: result.status
    });
  const data = result.data;
  const total = compact(data.totals.tokens);
  const unit = /[A-Za-z]$/u.exec(total)?.[0] ?? "";
  const digits = unit === "" ? total : total.slice(0, -1);
  const importedAt = data.import.importedAt;
  return /* @__PURE__ */ jsx_runtime5.jsx("div", {
    style: PAGE,
    children: /* @__PURE__ */ jsx_runtime5.jsxs("div", {
      style: INNER,
      children: [
        /* @__PURE__ */ jsx_runtime5.jsxs("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
          children: [
            /* @__PURE__ */ jsx_runtime5.jsx("div", {
              style: { display: "flex", gap: 2 },
              children: SOURCES.map((option) => /* @__PURE__ */ jsx_runtime5.jsx("button", {
                type: "button",
                onClick: () => {
                  setSource(option.id);
                },
                style: { ...CHIP, ...source === option.id ? { background: "var(--dsw-alias-bg-tertiary, #222)", color: "inherit" } : {} },
                children: option.label
              }, option.id))
            }),
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: 8 },
              children: [
                importedAt === null ? null : /* @__PURE__ */ jsx_runtime5.jsxs("span", {
                  style: { ...MUTED3, fontSize: 11 },
                  children: [
                    "Imported ",
                    new Date(importedAt).toLocaleString()
                  ]
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("button", {
                  type: "button",
                  style: CHIP,
                  onClick: () => {
                    props.load(source).then(setResult);
                  },
                  children: "Refresh"
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("button", {
                  type: "button",
                  style: { ...CHIP, color: "inherit", borderColor: "var(--dsw-alias-border, #555)" },
                  disabled: importing,
                  onClick: () => {
                    runImport();
                  },
                  children: importing ? "Importing…" : importedAt === null ? "Import history" : "Re-import"
                })
              ]
            })
          ]
        }),
        data.totals.tokens === 0 ? /* @__PURE__ */ jsx_runtime5.jsxs("div", {
          style: { ...CARD2, textAlign: "center", padding: "40px 18px" },
          children: [
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
              children: [
                "No usage for ",
                source
              ]
            }),
            /* @__PURE__ */ jsx_runtime5.jsx("div", {
              style: MUTED3,
              children: "Run a turn, or import the opencode/encoder history. Importing scans the message tables once and caches daily totals."
            })
          ]
        }) : /* @__PURE__ */ jsx_runtime5.jsxs(jsx_runtime5.Fragment, {
          children: [
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 8 },
              children: [
                /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                  style: { display: "flex", alignItems: "baseline", gap: 6 },
                  children: [
                    /* @__PURE__ */ jsx_runtime5.jsx("span", {
                      style: { fontSize: 56, lineHeight: 1, fontWeight: 650, letterSpacing: "-0.03em" },
                      children: digits
                    }),
                    unit === "" ? null : /* @__PURE__ */ jsx_runtime5.jsx("span", {
                      style: { fontSize: 26, fontWeight: 600, color: "var(--dsw-alias-text-secondary, #9a9a9a)" },
                      children: unit
                    })
                  ]
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("span", {
                  style: { ...MUTED3, fontSize: 12 },
                  children: "Lifetime tokens"
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { ...CARD2, display: "flex", flexWrap: "wrap", gap: "16px 28px", justifyContent: "space-between" },
              children: [
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Lifetime tokens",
                  value: integer(data.totals.tokens)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Peak day",
                  value: compact(data.stats.peak.tokens)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Longest streak",
                  value: `${data.stats.longestStreak} days`
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Current streak",
                  value: `${data.stats.currentStreak} days`
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Active days",
                  value: integer(data.totals.activeDays)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Sessions",
                  value: integer(data.totals.sessions)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg tokens/day",
                  value: compact(data.stats.avgTokensPerDay)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg prompts/day",
                  value: String(data.stats.avgPromptsPerDay)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg tokens/prompt",
                  value: compact(data.stats.avgTokensPerPrompt)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Avg session tokens",
                  value: compact(data.stats.avgSessionTokens)
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Stat, {
                  label: "Cached tokens",
                  value: compact(data.totals.cacheRead)
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: CARD2,
              children: [
                /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                  style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
                  children: [
                    /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                      style: { display: "flex", flexDirection: "column", gap: 2 },
                      children: [
                        /* @__PURE__ */ jsx_runtime5.jsx("span", {
                          style: { fontSize: 13, fontWeight: 600 },
                          children: "Token activity"
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsxs("span", {
                          style: { ...MUTED3, fontSize: 11 },
                          children: [
                            data.totals.prompts.toLocaleString(),
                            " prompts · peak ",
                            shortDate(data.stats.peak.date)
                          ]
                        })
                      ]
                    }),
                    /* @__PURE__ */ jsx_runtime5.jsx("div", {
                      style: { display: "flex", gap: 2 },
                      children: ["daily", "cumulative"].map((option) => /* @__PURE__ */ jsx_runtime5.jsx("button", {
                        type: "button",
                        onClick: () => {
                          setMode(option);
                        },
                        style: { ...CHIP, ...mode === option ? { background: "var(--dsw-alias-bg-tertiary, #222)", color: "inherit" } : {} },
                        children: option === "daily" ? "Daily" : "Cumulative"
                      }, option))
                    })
                  ]
                }),
                /* @__PURE__ */ jsx_runtime5.jsx(Heatmap, {
                  days: data.days,
                  mode
                })
              ]
            }),
            data.models.length > 0 ? /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: CARD2,
              children: [
                /* @__PURE__ */ jsx_runtime5.jsx("div", {
                  style: { fontSize: 13, fontWeight: 600, marginBottom: 10 },
                  children: "Top models"
                }),
                /* @__PURE__ */ jsx_runtime5.jsx("div", {
                  style: { display: "flex", flexDirection: "column", gap: 7 },
                  children: data.models.map((model) => {
                    const share = data.totals.tokens === 0 ? 0 : model.tokens / data.totals.tokens;
                    return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
                      style: { display: "flex", alignItems: "center", gap: 10 },
                      children: [
                        /* @__PURE__ */ jsx_runtime5.jsx("span", {
                          style: { width: 190, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                          children: model.model.length > 0 ? model.model : model.provider
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsx("div", {
                          style: { flex: 1, height: 7, borderRadius: 4, background: "var(--dsw-alias-bg-tertiary, #222)", overflow: "hidden" },
                          children: /* @__PURE__ */ jsx_runtime5.jsx("div", {
                            style: { width: `${Math.max(2, Math.round(share * 100))}%`, height: "100%", background: "#1d8cf8" }
                          })
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsx("span", {
                          style: { ...MUTED3, fontVariantNumeric: "tabular-nums", width: 70, textAlign: "right" },
                          children: compact(model.tokens)
                        }),
                        /* @__PURE__ */ jsx_runtime5.jsxs("span", {
                          style: { ...MUTED3, fontSize: 11, width: 42, textAlign: "right" },
                          children: [
                            Math.round(share * 100),
                            "%"
                          ]
                        })
                      ]
                    }, `${model.provider}/${model.model}`);
                  })
                })
              ]
            }) : null,
            /* @__PURE__ */ jsx_runtime5.jsxs("div", {
              style: { ...MUTED3, fontSize: 11, textAlign: "center", paddingBottom: 8 },
              children: [
                "Updated ",
                new Date(data.generatedAt).toLocaleTimeString(),
                " · ",
                data.totals.input.toLocaleString(),
                " in / ",
                data.totals.output.toLocaleString(),
                " out / ",
                data.totals.cacheRead.toLocaleString(),
                " cached",
                importedAt === null ? "" : ` · history imported ${new Date(importedAt).toLocaleDateString()}`
              ]
            })
          ]
        })
      ]
    })
  });
}

// src/client/OverviewIcon.tsx
var jsx_runtime6 = require("react/jsx-runtime");
function OverviewIcon({ size = 18 }) {
  return /* @__PURE__ */ jsx_runtime6.jsxs("svg", {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsx_runtime6.jsx("rect", {
        x: "1.5",
        y: "9.5",
        width: "2.6",
        height: "5",
        rx: "1",
        fill: "currentColor",
        opacity: "0.65"
      }),
      /* @__PURE__ */ jsx_runtime6.jsx("rect", {
        x: "6.7",
        y: "5.5",
        width: "2.6",
        height: "9",
        rx: "1",
        fill: "currentColor",
        opacity: "0.85"
      }),
      /* @__PURE__ */ jsx_runtime6.jsx("rect", {
        x: "11.9",
        y: "1.5",
        width: "2.6",
        height: "13",
        rx: "1",
        fill: "currentColor"
      })
    ]
  });
}

// src/client/overview.ts
async function readResult(response) {
  if (response.status === 401 || response.status === 403)
    return { ok: false, reason: "unauthorized", status: response.status };
  if (response.status === 404)
    return { ok: false, reason: "missing-route", status: 404 };
  if (!response.ok)
    return { ok: false, reason: "error", status: response.status };
  try {
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, reason: "error", status: response.status };
  }
}

class OverviewController {
  form;
  constructor(form) {
    this.form = form;
  }
  token() {
    return this.form.getSnapshot().value?.apiToken?.trim() ?? "";
  }
  load = async (source = "all") => {
    const token = this.token();
    if (token.length === 0)
      return { ok: false, reason: "unauthorized" };
    try {
      const response = await fetch(`/totem/overview?source=${encodeURIComponent(source)}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      return await readResult(response);
    } catch {
      return { ok: false, reason: "offline" };
    }
  };
  importHistory = async () => {
    const token = this.token();
    if (token.length === 0)
      return { ok: false, reason: "unauthorized" };
    try {
      const response = await fetch("/totem/overview/import", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}"
      });
      return await readResult(response);
    } catch {
      return { ok: false, reason: "offline" };
    }
  };
}

// src/client/index.tsx
var inject = ["slots", "remote", "remote.session", "configForms"];
function apply(ctx) {
  const card = new TotemMemoryCardController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    card.dispose();
  }, "dsh-totem: model card lifetime");
  const face = card.inject();
  ctx.effect(() => ctx.remote.$on("llm/adapters-updated", () => {
    card.refreshCatalog();
  }), "dsh-totem: adapter invalidations");
  ctx.effect(() => ctx.remote.$on("settings/document-updated", () => {
    card.refreshCatalog();
  }), "dsh-totem: settings invalidations");
  ctx.effect(() => ctx.on("connection/reset", () => {
    card.refreshCatalog();
  }), "dsh-totem: connection resets");
  const overview = new OverviewController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("contextMenu.icon", () => ctx.slots.register({
    name: "contextMenu.icon",
    key: "totem.unread"
  }, SessionUnreadIcon)), "dsh-totem: unread menu icon");
  let unread;
  ctx.inject?.(["uiSession"], (inner) => {
    const session = inner.uiSession;
    if (session?.completionUnread === undefined)
      return;
    unread = new SessionUnreadController(session);
    unread.restore();
    ctx.effect(() => unread?.watch() ?? (() => {}), "dsh-totem: unread mark expiry");
    const controller = unread;
    ctx.inject?.(["contextMenus"], (menuInner) => {
      const menus = menuInner.contextMenus;
      if (menus?.register === undefined)
        return;
      ctx.effect(() => menus.register({
        id: "totem.unread",
        target: "session",
        order: UNREAD_MENU_ORDER,
        observe: () => [session.sessionStatus],
        resolve: (target) => unreadMenuActions(target, {
          isCurrent: (id) => controller.isCurrent(id),
          statusOf: (id) => session.sessionStatus.getSnapshot().get(id),
          mark: (id) => controller.mark(id)
        })
      }), "dsh-totem: mark unread menu");
    });
  });
  ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: "overview",
    order: -10,
    label: () => "Overview"
  }, OverviewIcon)), "dsh-totem: overview sidebar entry");
  ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: "overview",
    inject: () => ({ load: overview.load, importHistory: overview.importHistory })
  }, OverviewPage)), "dsh-totem: overview panel");
  const verify = new VerifyController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
    name: "conversation.chat.turnTail",
    id: "verify-turn",
    order: 10,
    inject: () => ({ lookupTurn: verify.lookupTurn })
  }, VerifyTurnCard)), "dsh-totem: verify turn card");
  const assistant = new AssistantController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    assistant.dispose();
  }, "dsh-totem: assistant section lifetime");
  const assistantFace = assistant.inject();
  ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "assistant",
    order: 30,
    label: () => "Assistant",
    inject: () => assistantFace
  }, AssistantSection)), "dsh-totem: assistant section");
  ctx.effect(() => ctx.configForms.whileServed(["totem"], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({
    name: "plugins.item",
    id: "totem",
    order: 60,
    label: () => "Totem memory",
    inject: () => face
  }, TotemMemoryCard))), "dsh-totem: settings page");
}

    return module.exports;
  }
});
