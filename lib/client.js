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
  { id: "laya", label: "Laya" }
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
  const [narrow, setNarrow] = import_react.useState({ task: "", diff: "", loading: false, error: null, result: null });
  const [laya, setLaya] = import_react.useState({
    passThreshold: String(state.config.layaPassThreshold ?? 0.65),
    reviewBand: String(state.config.layaReviewBand ?? 0.05),
    vetoThreshold: String(state.config.layaVetoThreshold ?? 0.5),
    confidenceFloor: String(state.config.layaConfidenceFloor ?? 0),
    calibrationFile: state.config.layaCalibrationFile ?? "",
    maxRetries: String(state.config.layaMaxRetries ?? 1),
    timeoutMs: String(state.config.layaTimeoutMs ?? 60000),
    stepChecks: state.config.layaStepChecks ?? "veto",
    stepCadence: state.config.layaStepCadence ?? "turn",
    stepMaxFeedback: String(state.config.layaStepMaxFeedback ?? 2),
    verifyCommand: state.config.layaVerifyCommand ?? "",
    verifyExternal: state.config.layaVerifyExternal ?? "off",
    verifyDisable: (state.config.layaVerifyDisable ?? []).join(", "),
    model: state.config.layaModel ?? "",
    questionsFile: state.config.layaQuestionsFile ?? ""
  });
  const configKey = JSON.stringify(state.config);
  import_react.useEffect(() => {
    setDraft({
      ntfyUrl: state.config.ntfyUrl ?? "https://ntfy.sh",
      ntfyTopic: state.config.ntfyTopic ?? "",
      ntfyToken: state.config.ntfyToken ?? "",
      telegramBotToken: state.config.telegramBotToken ?? "",
      telegramChatId: state.config.telegramChatId ?? ""
    });
    setLaya({
      passThreshold: String(state.config.layaPassThreshold ?? 0.65),
      reviewBand: String(state.config.layaReviewBand ?? 0.05),
      vetoThreshold: String(state.config.layaVetoThreshold ?? 0.5),
      confidenceFloor: String(state.config.layaConfidenceFloor ?? 0),
      calibrationFile: state.config.layaCalibrationFile ?? "",
      maxRetries: String(state.config.layaMaxRetries ?? 1),
      timeoutMs: String(state.config.layaTimeoutMs ?? 60000),
      stepChecks: state.config.layaStepChecks ?? "veto",
      stepCadence: state.config.layaStepCadence ?? "turn",
      stepMaxFeedback: String(state.config.layaStepMaxFeedback ?? 2),
      verifyCommand: state.config.layaVerifyCommand ?? "",
      verifyExternal: state.config.layaVerifyExternal ?? "off",
      verifyDisable: (state.config.layaVerifyDisable ?? []).join(", "),
      model: state.config.layaModel ?? "",
      questionsFile: state.config.layaQuestionsFile ?? ""
    });
  }, [configKey]);
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
                new Date(reminder.nextAt).toLocaleString(),
                " · ",
                reminder.recurrence
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
      state.tab === "laya" ? /* @__PURE__ */ jsx_runtime2.jsxs("div", {
        style: { display: "flex", flexDirection: "column", gap: 12 },
        children: [
          /* @__PURE__ */ jsx_runtime2.jsx("p", {
            style: MUTED,
            children: "The judge runs on finished turns at the configured threshold; the verify lane and step checks run before it. The composer switch starts/stops the server."
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Pass threshold"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.passThreshold,
                    onChange: (event) => {
                      setLaya({ ...laya, passThreshold: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 140 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Retries / turn"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.maxRetries,
                    onChange: (event) => {
                      setLaya({ ...laya, maxRetries: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 170 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Request timeout (ms)"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.timeoutMs,
                    onChange: (event) => {
                      setLaya({ ...laya, timeoutMs: event.target.value });
                    }
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Review band"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.reviewBand,
                    onChange: (event) => {
                      setLaya({ ...laya, reviewBand: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Veto threshold"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.vetoThreshold,
                    onChange: (event) => {
                      setLaya({ ...laya, vetoThreshold: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Confidence floor"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.confidenceFloor,
                    onChange: (event) => {
                      setLaya({ ...laya, confidenceFloor: event.target.value });
                    }
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Step checks"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: FIELD,
                    value: laya.stepChecks,
                    onChange: (event) => {
                      setLaya({ ...laya, stepChecks: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "off",
                        children: "off"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "veto",
                        children: "veto"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "full",
                        children: "full"
                      })
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 160 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Step cadence"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: FIELD,
                    value: laya.stepCadence,
                    onChange: (event) => {
                      setLaya({ ...laya, stepCadence: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "turn",
                        children: "turn"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "tool",
                        children: "tool"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "both",
                        children: "both"
                      })
                    ]
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 150 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Step feedback cap"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.stepMaxFeedback,
                    onChange: (event) => {
                      setLaya({ ...laya, stepMaxFeedback: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, width: 150 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "External scanners"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsxs("select", {
                    style: FIELD,
                    value: laya.verifyExternal,
                    onChange: (event) => {
                      setLaya({ ...laya, verifyExternal: event.target.value });
                    },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "off",
                        children: "off"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "auto",
                        children: "auto"
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("option", {
                        value: "on",
                        children: "on"
                      })
                    ]
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Verify command (optional)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "pytest -q",
                value: laya.verifyCommand,
                onChange: (event) => {
                  setLaya({ ...laya, verifyCommand: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("label", {
            style: { display: "flex", flexDirection: "column", gap: 4 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsx("span", {
                style: { fontSize: 12, fontWeight: 600 },
                children: "Disabled rules (comma-separated)"
              }),
              /* @__PURE__ */ jsx_runtime2.jsx("input", {
                style: FIELD,
                placeholder: "external-semgrep, test-weakened",
                value: laya.verifyDisable,
                onChange: (event) => {
                  setLaya({ ...laya, verifyDisable: event.target.value });
                }
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { display: "flex", gap: 12, flexWrap: "wrap" },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Model path"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.model,
                    onChange: (event) => {
                      setLaya({ ...laya, model: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Questions file (optional)"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    value: laya.questionsFile,
                    onChange: (event) => {
                      setLaya({ ...laya, questionsFile: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 280px" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Calibration file (optional)"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    placeholder: ".encoder/decision.calibration.json",
                    value: laya.calibrationFile,
                    onChange: (event) => {
                      setLaya({ ...laya, calibrationFile: event.target.value });
                    }
                  })
                ]
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime2.jsx("div", {
            style: ROW_ACTIONS,
            children: /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
              variant: "primary",
              disabled: state.writing,
              onClick: () => {
                props.saveLaya({
                  layaPassThreshold: Number(laya.passThreshold),
                  layaReviewBand: Number(laya.reviewBand),
                  layaVetoThreshold: Number(laya.vetoThreshold),
                  layaConfidenceFloor: Number(laya.confidenceFloor),
                  layaCalibrationFile: laya.calibrationFile,
                  layaMaxRetries: Number(laya.maxRetries),
                  layaTimeoutMs: Number(laya.timeoutMs),
                  layaStepChecks: laya.stepChecks,
                  layaStepCadence: laya.stepCadence,
                  layaStepMaxFeedback: Number(laya.stepMaxFeedback),
                  layaVerifyCommand: laya.verifyCommand,
                  layaVerifyExternal: laya.verifyExternal,
                  layaVerifyDisable: laya.verifyDisable.split(",").map((value) => value.trim()).filter(Boolean),
                  layaModel: laya.model,
                  layaQuestionsFile: laya.questionsFile
                });
              },
              children: "Save Laya settings"
            })
          }),
          /* @__PURE__ */ jsx_runtime2.jsxs("div", {
            style: { ...CARD, gap: 10 },
            children: [
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("strong", {
                    style: { fontSize: 13 },
                    children: "Narrow a diff"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: MUTED,
                    children: "Manual hunk ranking; never gates or steers."
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Task / bug description"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("input", {
                    style: FIELD,
                    placeholder: "What is wrong, or what should the change do?",
                    value: narrow.task,
                    onChange: (event) => {
                      setNarrow({ ...narrow, task: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("label", {
                style: { display: "flex", flexDirection: "column", gap: 4 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx("span", {
                    style: { fontSize: 12, fontWeight: 600 },
                    children: "Unified diff"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx("textarea", {
                    style: { ...FIELD, minHeight: 150, fontFamily: "monospace", fontSize: 12, resize: "vertical" },
                    placeholder: "Paste a unified diff, or load the last recorded turn diff.",
                    value: narrow.diff,
                    onChange: (event) => {
                      setNarrow({ ...narrow, diff: event.target.value });
                    }
                  })
                ]
              }),
              /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: ROW_ACTIONS,
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "primary",
                    disabled: narrow.loading || narrow.task.trim().length === 0 || narrow.diff.trim().length === 0,
                    onClick: () => {
                      setNarrow({ ...narrow, loading: true, error: null, result: null });
                      props.localize(narrow.task, narrow.diff).then((result) => {
                        setNarrow((current) => ({ ...current, loading: false, result }));
                      }).catch((error) => {
                        setNarrow((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }));
                      });
                    },
                    children: narrow.loading ? "Ranking…" : "Rank hunks"
                  }),
                  /* @__PURE__ */ jsx_runtime2.jsx(import_dsh_client_ui_primitives2.Button, {
                    variant: "outline",
                    disabled: narrow.loading,
                    onClick: () => {
                      setNarrow({ ...narrow, loading: true, error: null, result: null });
                      props.lastDiff().then((last) => {
                        if (last === null)
                          throw new Error("No recorded turn changes yet; paste a diff or enable Laya for one turn.");
                        setNarrow((current) => ({ ...current, loading: false, task: last.task, diff: last.diff }));
                      }).catch((error) => {
                        setNarrow((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }));
                      });
                    },
                    children: "Use last turn diff"
                  })
                ]
              }),
              narrow.error !== null ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
                style: { ...MUTED, color: "var(--dsw-alias-text-danger, #e06c75)" },
                children: narrow.error
              }) : null,
              narrow.result !== null ? narrow.result.hunks.length === 0 ? /* @__PURE__ */ jsx_runtime2.jsx("p", {
                style: MUTED,
                children: "No hunks found in that diff."
              }) : /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: 4 },
                children: [
                  /* @__PURE__ */ jsx_runtime2.jsxs("p", {
                    style: MUTED,
                    children: [
                      narrow.result.top === null ? "No top hunk." : `Top hunk: ${narrow.result.top}`,
                      ` · ${narrow.result.ms} ms`
                    ]
                  }),
                  narrow.result.hunks.map((hunk) => /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                    style: { borderTop: "1px solid var(--dsw-alias-border, #333)", paddingTop: 4, fontSize: 12 },
                    children: [
                      /* @__PURE__ */ jsx_runtime2.jsxs("div", {
                        style: { display: "flex", gap: 8, justifyContent: "space-between" },
                        children: [
                          /* @__PURE__ */ jsx_runtime2.jsx("span", {
                            style: { fontFamily: "monospace" },
                            children: hunk.header
                          }),
                          /* @__PURE__ */ jsx_runtime2.jsxs("span", {
                            children: [
                              Math.round(hunk.score * 1000) / 10,
                              "%"
                            ]
                          })
                        ]
                      }),
                      /* @__PURE__ */ jsx_runtime2.jsx("div", {
                        style: { ...MUTED, fontFamily: "monospace", whiteSpace: "pre-wrap" },
                        children: hunk.added.slice(0, 3).join(`
`) || "(no added lines)"
                      })
                    ]
                  }, hunk.index))
                ]
              }) : null
            ]
          })
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
      saveLaya: (values) => {
        this.saveLaya(values);
      },
      testNotification: () => {
        this.testNotification();
      },
      localize: (task, diff) => this.localize(task, diff),
      lastDiff: () => this.lastDiff()
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
      writing: this.writing
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
      }
      this.status = "ready";
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = "error";
    }
    this.publish();
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
  localize(task, diff) {
    return this.request("/laya/localize", {
      method: "POST",
      body: JSON.stringify({ task, diff })
    });
  }
  async lastDiff() {
    const data = await this.request("/laya/last-diff");
    return data.diff;
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
  async saveLaya(values) {
    const snapshot = this.form.getSnapshot();
    const fields = [
      "layaPassThreshold",
      "layaReviewBand",
      "layaVetoThreshold",
      "layaConfidenceFloor",
      "layaCalibrationFile",
      "layaMaxRetries",
      "layaTimeoutMs",
      "layaStepChecks",
      "layaStepCadence",
      "layaStepMaxFeedback",
      "layaVerifyCommand",
      "layaVerifyExternal",
      "layaVerifyDisable",
      "layaModel",
      "layaQuestionsFile"
    ];
    this.writing = true;
    this.publish();
    const ok = await this.form.mutate(fields.map((field) => ({
      op: "set",
      path: [field],
      value: values[field]
    })), snapshot.revision);
    this.writing = false;
    this.notice = ok ? "Laya settings saved." : null;
    this.error = ok ? null : "The Host did not accept the Laya settings.";
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

// src/client/LayaSwitch.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var jsx_runtime3 = require("react/jsx-runtime");
var ROW = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  paddingInline: 2,
  whiteSpace: "nowrap"
};
var LABEL = {
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 500,
  color: "var(--dsw-alias-text-secondary, #9a9a9a)",
  userSelect: "none"
};
function LayaSwitch(props) {
  const state = props.useLayaSwitch((snapshot) => snapshot);
  const title = state.error !== null ? `Laya: ${state.error}` : state.enabled ? state.loaded ? "Laya decision engine is on" : "Laya decision engine is starting; the model is loading into VRAM…" : "Laya decision engine is off; the model is not loaded";
  return /* @__PURE__ */ jsx_runtime3.jsxs("span", {
    style: ROW,
    title,
    children: [
      /* @__PURE__ */ jsx_runtime3.jsxs("span", {
        style: { ...LABEL, ...state.error === null ? {} : { color: "var(--dsw-alias-text-error, #e5484d)" } },
        children: [
          "Laya",
          state.enabled && !state.loaded ? " · loading" : ""
        ]
      }),
      /* @__PURE__ */ jsx_runtime3.jsx(import_dsh_client_ui_primitives3.Switch, {
        checked: state.enabled,
        onChange: () => {
          props.toggle();
        },
        label: "Laya decision engine",
        disabled: state.busy,
        title
      })
    ]
  });
}

// src/client/laya-switch.ts
var import_dsh_client_store3 = require("@deepseek-ai/dsh-client-store");

class LayaSwitchController {
  form;
  ctx;
  store;
  unsubscribe;
  timer;
  disposed = false;
  constructor(form, ctx) {
    this.form = form;
    this.ctx = ctx;
    this.store = import_dsh_client_store3.createSnapshotStore({ enabled: false, healthy: false, loaded: false, busy: false, error: null });
    this.unsubscribe = form.subscribe(() => {
      this.publish();
    });
    this.timer = setInterval(() => {
      this.refresh();
    }, 5000);
    this.refresh();
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.unsubscribe();
  }
  inject() {
    return {
      hooks: { layaSwitch: this.store },
      toggle: () => {
        this.toggle();
      },
      refresh: () => {
        this.refresh();
      }
    };
  }
  token() {
    return this.form.getSnapshot().value?.apiToken?.trim() ?? "";
  }
  publish() {
    if (!this.disposed)
      this.store.set(this.store.getSnapshot());
  }
  update(patch) {
    if (this.disposed)
      return;
    this.store.set({ ...this.store.getSnapshot(), ...patch });
  }
  async request(path, method) {
    const token = this.token();
    if (token.length === 0)
      throw new Error("Set the assistant apiToken in the Totem plugin config first.");
    const response = await fetch(`/totem${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error ?? `request failed (${response.status})`);
    }
    return await response.json();
  }
  async refresh() {
    try {
      const status = await this.request("/laya/status", "GET");
      this.update({ enabled: status.enabled, healthy: status.healthy, loaded: status.loaded, error: null });
    } catch (error) {
      this.update({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  async toggle() {
    if (this.store.getSnapshot().busy)
      return;
    const next = !this.store.getSnapshot().enabled;
    this.update({ busy: true, enabled: next, loaded: false, error: null });
    try {
      const status = await this.request(next ? "/laya/enable" : "/laya/disable", "POST");
      this.update({ enabled: status.enabled, healthy: status.healthy, loaded: status.loaded, busy: false });
    } catch (error) {
      this.update({ busy: false, error: error instanceof Error ? error.message : String(error) });
      this.refresh();
    }
  }
}

// src/client/DecisionBadge.tsx
var import_react2 = require("react");
var jsx_runtime4 = require("react/jsx-runtime");
function DecisionBadge(props) {
  const [decision, setDecision] = import_react2.useState(null);
  import_react2.useEffect(() => {
    let active = true;
    let timer;
    let tries = 0;
    const tick = async () => {
      const found = await props.lookup(props.messageId);
      if (!active)
        return;
      if (found !== null) {
        setDecision(found);
        return;
      }
      if (tries++ < 10)
        timer = setTimeout(() => {
          tick();
        }, 1500);
    };
    tick();
    return () => {
      active = false;
      if (timer !== undefined)
        clearTimeout(timer);
    };
  }, [props.messageId]);
  if (decision === null)
    return null;
  const color = decision.verdict === "pass" ? "var(--dsw-alias-text-success, #46a758)" : decision.verdict === "fail" ? "var(--dsw-alias-text-error, #e5484d)" : "var(--dsw-alias-text-warning, #f5a524)";
  const score = decision.composite === null ? "" : ` ${decision.composite.toFixed(2)}`;
  return /* @__PURE__ */ jsx_runtime4.jsxs("span", {
    title: `Laya decision: ${decision.verdict}${score}`,
    style: { fontSize: 11, lineHeight: "16px", color, whiteSpace: "nowrap", userSelect: "none" },
    children: [
      "· Decision ",
      decision.verdict,
      score
    ]
  });
}

// src/client/decision-badge.ts
class DecisionBadgeController {
  form;
  constructor(form) {
    this.form = form;
  }
  lookup = async (messageId) => {
    const token = this.form.getSnapshot().value?.apiToken?.trim() ?? "";
    if (token.length === 0 || messageId.length === 0)
      return null;
    try {
      const response = await fetch(`/totem/decisions?message=${encodeURIComponent(messageId)}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok)
        return null;
      const data = await response.json();
      return data.decision ?? null;
    } catch {
      return null;
    }
  };
}

// src/client/LayaTurnCard.tsx
var import_react4 = require("react");

// src/client/laya-calls.ts
function selectTurnCalls(calls, turn) {
  const matching = calls.filter((call) => call.turn === turn);
  if (matching.length === 0)
    return [];
  const session = matching[matching.length - 1].session;
  return session === undefined ? matching : matching.filter((call) => call.session === session);
}
function callKindLabel(kind) {
  switch (kind) {
    case "answer":
    case "mutation":
      return "Turn judgement";
    case "step":
      return "Step check";
    case "advisory":
      return "Advisory judgement";
    default:
      return kind;
  }
}
function changedPaths(state) {
  if (typeof state !== "object" || state === null)
    return [];
  const changes = state.changes;
  if (!Array.isArray(changes))
    return [];
  const paths = changes.map((change) => typeof change === "object" && change !== null ? change.path : undefined).filter((path) => typeof path === "string" && path.length > 0);
  return [...new Set(paths)].slice(0, 8);
}
var CACHE_MS = 600;

class LayaCallsController {
  form;
  cache;
  inflight;
  detail = new Map;
  constructor(form) {
    this.form = form;
  }
  async fetchCalls(query) {
    const token = this.form.getSnapshot().value?.apiToken?.trim() ?? "";
    if (token.length === 0)
      return [];
    try {
      const response = await fetch(`/totem/laya/calls?${query}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok)
        return [];
      const data = await response.json();
      if (Array.isArray(data.calls))
        return data.calls;
      if (data.call !== undefined && data.call !== null)
        return [data.call];
      return [];
    } catch {
      return [];
    }
  }
  async all(force = false) {
    const now = Date.now();
    if (!force && this.cache !== undefined && now - this.cache.at < CACHE_MS)
      return this.cache.calls;
    if (this.inflight !== undefined)
      return this.inflight;
    this.inflight = this.fetchCalls("limit=300").then((calls) => {
      this.cache = { at: Date.now(), calls };
      return calls;
    }).finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }
  lookup = async (messageId) => {
    if (messageId.length === 0)
      return [];
    const all = await this.all();
    const matching = all.filter((call) => call.messageId === messageId);
    return matching.length > 0 ? matching : this.fetchCalls(`message=${encodeURIComponent(messageId)}&limit=50`);
  };
  lookupTurn = async (turn) => {
    if (!Number.isFinite(turn) || turn < 0)
      return [];
    return selectTurnCalls(await this.all(), turn);
  };
  lookupDetail = async (id) => {
    const cached = this.detail.get(id);
    if (cached !== undefined)
      return cached;
    const fromList = (await this.all()).find((call) => call.id === id);
    if (fromList !== undefined && fromList.state !== undefined) {
      this.detail.set(id, fromList);
      return fromList;
    }
    const [fetched] = await this.fetchCalls(`id=${id}`);
    if (fetched !== undefined && fetched.id === id) {
      this.detail.set(id, fetched);
      return fetched;
    }
    return fromList;
  };
}

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

// src/client/laya-ui.tsx
var import_react3 = require("react");
var jsx_runtime5 = require("react/jsx-runtime");
var LAYA_CSS = `
.laya-card{--laya-fill:var(--dsw-static-neutral-50);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);min-width:0;color:var(--dsw-alias-label-primary);flex-direction:column;margin-top:4px;display:flex;overflow:hidden}
body[data-ds-dark-theme] .laya-card{--laya-fill:var(--dsw-static-neutral-850)}
.laya-head{box-sizing:border-box;background:var(--laya-fill);width:100%;min-width:0;height:60px;color:inherit;font:inherit;text-align:left;border:0;align-items:center;gap:10px;margin:0;padding:8px 10px;display:flex;cursor:pointer;transition:background-color .12s}
.laya-head:hover{background:var(--dsw-static-neutral-100)}
body[data-ds-dark-theme] .laya-head:hover{background:var(--dsw-static-neutral-800)}
.laya-head:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}
.laya-head[data-static=true]{cursor:default}
.laya-head[data-static=true]:hover{background:var(--laya-fill)}
.laya-tile{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent);border-radius:10px;flex:none;place-items:center;width:40px;height:40px;display:grid}
body[data-ds-dark-theme] .laya-tile{background:color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent)}
.laya-titles{flex-direction:column;flex:1;min-width:0;display:flex}
.laya-title{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}
.laya-stat{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;display:inline-flex;align-items:center;gap:6px}
.laya-numbers{font-family:var(--ds-font-family-code);gap:6px;display:inline-flex}
.laya-hint{display:none}
.laya-head:hover .laya-numbers,.laya-head:focus-visible .laya-numbers{display:none}
.laya-head:hover .laya-hint,.laya-head:focus-visible .laya-hint{display:inline}
.laya-head[data-static=true] .laya-numbers{display:inline}
.laya-head[data-static=true] .laya-hint{display:none}
.laya-list{border-top:.5px solid var(--dsw-alias-border-l2);margin:0;padding:0;list-style:none}
.laya-row{box-sizing:border-box;width:100%;min-width:0;min-height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-family:var(--ds-font-family-code);text-align:left;background:0 0;border:0;justify-content:space-between;align-items:center;gap:10px;margin:0;padding:7px 18px 7px 14px;font-size:11px;line-height:18px;display:flex}
.laya-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.laya-row:focus-visible{outline:none;background:var(--dsw-alias-interactive-bg-hover)}
.laya-rowMain{align-items:center;gap:8px;min-width:0;display:flex;overflow:hidden}
.laya-kind{color:var(--dsw-alias-label-secondary);white-space:nowrap}
.laya-verdict{font-weight:600;white-space:nowrap}
.laya-verdict[data-v=pass]{color:var(--dsw-alias-state-success-primary)}
.laya-verdict[data-v=fail]{color:var(--dsw-alias-state-error-primary)}
.laya-verdict[data-v=needs_review]{color:var(--dsw-alias-state-warn-primary,#f5a524)}
.laya-counts{gap:8px;display:inline-flex;white-space:nowrap}
.laya-detail{padding:8px 14px 10px;display:flex;flex-direction:column;gap:8px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}
.laya-detailRow{display:flex;gap:8px;flex-wrap:wrap}
.laya-tag{border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 7px;white-space:nowrap}
.laya-tag[data-error=true]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.laya-pre{margin:0;padding:8px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2,transparent);font-family:var(--ds-font-family-code);font-size:10px;line-height:1.45;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word}
.laya-toggle{width:100%;min-height:26px;display:flex;align-items:center;justify-content:center;gap:4px;border:0;border-top:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer;padding:4px}
.laya-toggle:hover{background:var(--dsw-alias-interactive-bg-hover)}
.laya-empty{color:var(--dsw-alias-label-tertiary);font-size:11px}
.laya-prompt{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.laya-prompt b{color:var(--dsw-alias-label-tertiary);font-weight:600}
.laya-meter{display:flex;flex-direction:column;gap:3px}
.laya-meterHead{display:flex;justify-content:space-between;gap:8px;font-family:var(--ds-font-family-code);font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-meterTrack{position:relative;height:6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 18%,transparent);overflow:visible}
.laya-meterFill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--dsw-alias-state-success-primary)}
.laya-meterFill[data-v=fail]{background:var(--dsw-alias-state-error-primary)}
.laya-meterFill[data-v=needs_review]{background:var(--dsw-alias-state-warn-primary,#f5a524)}
.laya-meterMark{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--dsw-alias-label-secondary);border-radius:1px}
.laya-meterLegend{display:flex;justify-content:space-between;font-size:10px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code)}
.laya-answers{display:flex;flex-direction:column}
.laya-answer{padding:7px 0;border-top:.5px dashed var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:3px}
.laya-answer:first-child{border-top:0;padding-top:0}
.laya-answerHead{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.laya-answerName{font-size:11px;color:var(--dsw-alias-label-secondary)}
.laya-answerValue{font-family:var(--ds-font-family-code);font-size:11px;font-weight:600}
.laya-answerValue[data-tone=pass]{color:var(--dsw-alias-state-success-primary)}
.laya-answerValue[data-tone=fail]{color:var(--dsw-alias-state-error-primary)}
.laya-answerValue[data-tone=neutral]{color:var(--dsw-alias-label-primary)}
.laya-conf{font-family:var(--ds-font-family-code);font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-meaning{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-bars{display:flex;flex-direction:column;gap:2px;margin-top:1px}
.laya-barRow{display:grid;grid-template-columns:132px 1fr 40px;align-items:center;gap:8px;font-family:var(--ds-font-family-code);font-size:10px;color:var(--dsw-alias-label-tertiary)}
.laya-barLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.laya-barTrack{height:6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 16%,transparent);overflow:hidden;display:block}
/* The track is a grid item and therefore blockified; the fill inside it is not,
   so without an explicit display its width and height are ignored and the bar
   renders empty. */
.laya-barFill{display:block;height:100%;min-width:2px;border-radius:999px;background:var(--dsw-alias-label-secondary)}
.laya-barRow[data-selected=true] .laya-barLabel,.laya-barRow[data-selected=true] .laya-barValue{color:var(--dsw-alias-label-primary)}
.laya-barRow[data-selected=true] .laya-barFill{background:var(--dsw-alias-state-business-primary,#6ea8fe)}
.laya-barRow[data-risk=true] .laya-barFill{background:var(--dsw-alias-state-error-primary)}
.laya-barValue{text-align:right}
`;
var installed = false;
function installLayaStyles() {
  if (installed || typeof document === "undefined")
    return;
  installed = true;
  if (document.querySelector("style[data-dsh-totem-laya]") !== null)
    return;
  const tag = document.createElement("style");
  tag.dataset.dshTotemLaya = "";
  tag.textContent = LAYA_CSS;
  document.head.appendChild(tag);
}
function verdictColor(verdict) {
  if (verdict === "pass")
    return "var(--dsw-alias-state-success-primary)";
  if (verdict === "fail")
    return "var(--dsw-alias-state-error-primary)";
  return "var(--dsw-alias-state-warn-primary,#f5a524)";
}
function humanize(key) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/[_-]+/gu, " ").trim();
  if (spaced.length === 0)
    return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
function answerValue(answer) {
  if (answer.score !== undefined)
    return answer.score.toFixed(2);
  if (answer.choice !== undefined)
    return answer.choice;
  if (answer.noul !== undefined)
    return answer.noul >= 0.5 ? "yes" : "no";
  return "?";
}
function answerTone(answer) {
  if (answer.noul !== undefined)
    return answer.noul >= 0.5 ? "pass" : "fail";
  if (answer.score !== undefined)
    return answer.score >= 2 ? "fail" : answer.score >= 1 ? "neutral" : "pass";
  return "neutral";
}
function nearestLegend(answer) {
  const { legend, score } = answer;
  if (legend === undefined || score === undefined)
    return;
  const keys = Object.keys(legend).filter((key) => Number.isFinite(Number(key))).map(Number);
  if (keys.length === 0)
    return;
  const nearest = keys.reduce((best, key) => Math.abs(key - score) < Math.abs(best - score) ? key : best, keys[0]);
  return legend[String(nearest)];
}
function answerMeaning(name, answer) {
  const subject = humanize(name).toLowerCase();
  if (answer.noul !== undefined) {
    return answer.noul >= 0.5 ? `${subject} is satisfied` : `${subject} is not satisfied`;
  }
  if (answer.score !== undefined) {
    const legend = nearestLegend(answer);
    return legend === undefined ? "graded score" : `closest grade: ${legend}`;
  }
  if (answer.choice !== undefined) {
    return `chosen ${subject}: ${answer.choice}`;
  }
  return "no value";
}
function confidenceLabel(answer) {
  return answer.confidence === undefined ? "" : `confidence ${answer.confidence.toFixed(2)}`;
}
function nearestLegendKey(answer) {
  const { legend, score } = answer;
  if (legend === undefined || score === undefined)
    return;
  const keys = Object.keys(legend).filter((key) => Number.isFinite(Number(key)));
  if (keys.length === 0)
    return;
  return keys.reduce((best, key) => Math.abs(Number(key) - score) < Math.abs(Number(best) - score) ? key : best, keys[0]);
}
function probabilityEntries(answer, max = 5) {
  const probabilities = answer.probabilities ?? {};
  const numeric = Object.fromEntries(Object.entries(probabilities).filter(([, value]) => typeof value === "number"));
  if (answer.legend !== undefined) {
    return Object.keys(answer.legend).filter((key) => Number.isFinite(Number(key))).sort((left, right) => Number(left) - Number(right)).map((key) => ({ key, label: answer.legend?.[key] ?? key, value: numeric[key] ?? 0 }));
  }
  return Object.entries(numeric).map(([key, value]) => ({ key, label: key === "none" ? "none" : humanize(key), value })).sort((left, right) => right.value - left.value).slice(0, max);
}
function ProbabilityBars({ answer }) {
  const entries = probabilityEntries(answer);
  if (entries.length === 0)
    return null;
  const selected = answer.choice ?? nearestLegendKey(answer);
  return /* @__PURE__ */ jsx_runtime5.jsx("div", {
    className: "laya-bars",
    children: entries.map(({ key, label, value }) => {
      const isSelected = selected !== undefined && key === selected;
      const isRisk = answer.score !== undefined && Number(key) >= 2;
      return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        className: "laya-barRow",
        "data-selected": isSelected,
        "data-risk": isRisk && !isSelected,
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-barLabel",
            title: label,
            children: label
          }),
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-barTrack",
            children: /* @__PURE__ */ jsx_runtime5.jsx("span", {
              className: "laya-barFill",
              style: { width: `${Math.max(0, Math.min(1, value)) * 100}%` }
            })
          }),
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-barValue",
            children: value.toFixed(3)
          })
        ]
      }, key);
    })
  });
}
function AnswerRow({ name, answer }) {
  const confidence = confidenceLabel(answer);
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    className: "laya-answer",
    children: [
      /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        className: "laya-answerHead",
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-answerName",
            children: humanize(name)
          }),
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-answerValue",
            "data-tone": answerTone(answer),
            children: answerValue(answer)
          }),
          confidence.length === 0 ? null : /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-conf",
            children: confidence
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime5.jsx("span", {
        className: "laya-meaning",
        children: answerMeaning(name, answer)
      }),
      /* @__PURE__ */ jsx_runtime5.jsx(ProbabilityBars, {
        answer
      })
    ]
  });
}
function Answers({ answers }) {
  const entries = Object.entries(answers);
  if (entries.length === 0)
    return /* @__PURE__ */ jsx_runtime5.jsx("div", {
      className: "laya-empty",
      children: "The judge returned no answers."
    });
  return /* @__PURE__ */ jsx_runtime5.jsx("div", {
    className: "laya-answers",
    children: entries.map(([name, answer]) => /* @__PURE__ */ jsx_runtime5.jsx(AnswerRow, {
      name,
      answer
    }, name))
  });
}
function ScoreMeter({ value, threshold }) {
  if (typeof value !== "number" || !Number.isFinite(value))
    return null;
  const scale = Math.max(1, value, threshold ?? 0);
  const fill = Math.max(0, Math.min(1, value / scale));
  const mark = threshold === undefined ? undefined : Math.max(0, Math.min(1, threshold / scale));
  const tone = threshold === undefined ? undefined : value >= threshold ? "pass" : "fail";
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    className: "laya-meter",
    children: [
      /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        className: "laya-meterHead",
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            children: `composite ${value.toFixed(3)}`
          }),
          threshold === undefined ? null : /* @__PURE__ */ jsx_runtime5.jsx("span", {
            children: `threshold ${threshold.toFixed(2)}`
          }),
          threshold === undefined ? null : /* @__PURE__ */ jsx_runtime5.jsx("span", {
            children: value >= threshold ? `+${(value - threshold).toFixed(3)} above` : `${(threshold - value).toFixed(3)} below`
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        className: "laya-meterTrack",
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-meterFill",
            "data-v": tone,
            style: { width: `${fill * 100}%` }
          }),
          mark === undefined ? null : /* @__PURE__ */ jsx_runtime5.jsx("span", {
            className: "laya-meterMark",
            style: { left: `calc(${mark * 100}% - 1px)` }
          })
        ]
      }),
      /* @__PURE__ */ jsx_runtime5.jsxs("div", {
        className: "laya-meterLegend",
        children: [
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            children: "0"
          }),
          /* @__PURE__ */ jsx_runtime5.jsx("span", {
            children: "1"
          })
        ]
      })
    ]
  });
}
function PromptLine({ text }) {
  if (text.trim().length === 0)
    return null;
  return /* @__PURE__ */ jsx_runtime5.jsxs("div", {
    className: "laya-prompt",
    children: [
      /* @__PURE__ */ jsx_runtime5.jsx("b", {
        children: "Prompt: "
      }),
      text
    ]
  });
}
function latencyLabel(value) {
  if (!Number.isFinite(value) || value <= 0)
    return "";
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`;
}
function clockLabel(ts) {
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString();
}
var TOKEN = /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\btrue\b|\bfalse\b|\bnull\b)/g;
function JsonView({ value }) {
  const chunks = import_react3.useMemo(() => {
    const text = JSON.stringify(value, null, 2) ?? "null";
    return text.split(TOKEN).map((chunk, index) => {
      if (index % 2 === 0)
        return /* @__PURE__ */ jsx_runtime5.jsx("span", {
          children: chunk
        }, index);
      const color = chunk.trimEnd().endsWith(":") ? "var(--dsw-alias-state-business-primary,#6ea8fe)" : chunk.startsWith('"') ? "var(--dsw-alias-state-success-primary)" : /^\d/.test(chunk) ? "var(--dsw-alias-state-warn-primary,#e0b45c)" : "var(--dsw-alias-state-error-primary)";
      return /* @__PURE__ */ jsx_runtime5.jsx("span", {
        style: { color },
        children: chunk
      }, index);
    });
  }, [value]);
  return /* @__PURE__ */ jsx_runtime5.jsx("pre", {
    className: "laya-pre",
    children: chunks
  });
}
function LayaGlyph() {
  return /* @__PURE__ */ jsx_runtime5.jsxs("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": "true",
    color: "var(--dsw-alias-label-primary)",
    children: [
      /* @__PURE__ */ jsx_runtime5.jsx("path", {
        d: "M12 3.2 19 6v5.1c0 4.2-2.9 7.5-7 8.9-4.1-1.4-7-4.7-7-8.9V6l7-2.8Z",
        stroke: "currentColor",
        strokeWidth: "1.35"
      }),
      /* @__PURE__ */ jsx_runtime5.jsx("path", {
        d: "m8.8 11.8 2.2 2.2 4.2-4.3",
        stroke: "currentColor",
        strokeWidth: "1.35"
      })
    ]
  });
}

// src/client/LayaTurnCard.tsx
var jsx_runtime6 = require("react/jsx-runtime");
function CallRow({ call, defaultOpen, loadDetail }) {
  const [open, setOpen] = import_react4.useState(defaultOpen === true);
  const [detail, setDetail] = import_react4.useState(undefined);
  import_react4.useEffect(() => {
    if (!open || detail !== undefined)
      return;
    let active = true;
    loadDetail(call.id).then((loaded) => {
      if (active && loaded !== undefined)
        setDetail(loaded);
    });
    return () => {
      active = false;
    };
  }, [open, detail, call.id, loadDetail]);
  const full = detail ?? call;
  const composite = call.composite === null ? "n/a" : call.composite.toFixed(3);
  const margin = call.margin === null ? "" : `margin ${call.margin >= 0 ? "+" : ""}${call.margin.toFixed(3)}`;
  const elapsed = latencyLabel(call.ms);
  const paths = changedPaths(call.state);
  return /* @__PURE__ */ jsx_runtime6.jsxs("li", {
    children: [
      /* @__PURE__ */ jsx_runtime6.jsxs("button", {
        type: "button",
        className: "laya-row",
        "aria-expanded": open,
        onClick: () => {
          setOpen((value) => !value);
        },
        children: [
          /* @__PURE__ */ jsx_runtime6.jsxs("span", {
            className: "laya-rowMain",
            children: [
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-kind",
                children: callKindLabel(call.kind)
              }),
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-verdict",
                "data-v": call.verdict,
                children: call.verdict
              }),
              call.error === undefined ? null : /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-kind",
                style: { color: "var(--dsw-alias-state-error-primary)" },
                children: "error"
              }),
              call.vetoes.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-kind",
                children: call.vetoes.join(", ")
              }),
              call.reviewOnly === true ? /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-kind",
                children: "review only"
              }) : null
            ]
          }),
          /* @__PURE__ */ jsx_runtime6.jsxs("span", {
            className: "laya-counts",
            children: [
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                children: composite
              }),
              margin.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsx("span", {
                children: margin
              }),
              elapsed.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsx("span", {
                children: elapsed
              }),
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                children: clockLabel(call.ts)
              })
            ]
          })
        ]
      }),
      open ? /* @__PURE__ */ jsx_runtime6.jsxs("div", {
        className: "laya-detail",
        children: [
          call.error === undefined ? null : /* @__PURE__ */ jsx_runtime6.jsx("div", {
            style: { color: "var(--dsw-alias-state-error-primary)" },
            children: call.error
          }),
          /* @__PURE__ */ jsx_runtime6.jsx(PromptLine, {
            text: call.task
          }),
          paths.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsxs("div", {
            children: [
              "Checked after ",
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-conf",
                children: paths.join(" · ")
              })
            ]
          }),
          /* @__PURE__ */ jsx_runtime6.jsx(ScoreMeter, {
            value: call.composite,
            threshold: call.threshold
          }),
          call.vetoes.length > 0 && Object.keys(call.answers).length === 0 ? /* @__PURE__ */ jsx_runtime6.jsx("div", {
            className: "laya-meaning",
            children: "The deterministic verify lane blocked this before the judge was asked."
          }) : /* @__PURE__ */ jsx_runtime6.jsx(Answers, {
            answers: call.answers
          }),
          call.missing.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsxs("div", {
            children: [
              "Missing criteria: ",
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-conf",
                children: call.missing.join(", ")
              })
            ]
          }),
          call.vetoes.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsxs("div", {
            children: [
              "Vetoes: ",
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-conf",
                children: call.vetoes.join(", ")
              })
            ]
          }),
          call.reviewOnly === true ? /* @__PURE__ */ jsx_runtime6.jsxs("div", {
            className: "laya-meaning",
            children: [
              "No corrective message was sent: this review is marginal or below the confidence floor, so it is advisory. Set ",
              /* @__PURE__ */ jsx_runtime6.jsx("code", {
                children: "layaSteerOnReview"
              }),
              " to enforce it."
            ]
          }) : null,
          call.usage === undefined ? null : /* @__PURE__ */ jsx_runtime6.jsxs("div", {
            children: [
              "Tokens:",
              " ",
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-conf",
                children: [
                  call.usage.input_tokens === undefined ? "" : `in ${call.usage.input_tokens}`,
                  call.usage.output_tokens === undefined ? "" : `out ${call.usage.output_tokens}`
                ].filter(Boolean).join(" · ")
              })
            ]
          }),
          call.findings.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsx("div", {
            className: "laya-detailRow",
            children: call.findings.map((finding, index) => /* @__PURE__ */ jsx_runtime6.jsxs("span", {
              className: "laya-tag",
              "data-error": finding.severity === "high",
              children: [
                finding.rule,
                finding.path === undefined ? "" : ` · ${finding.path}`
              ]
            }, index))
          }),
          /* @__PURE__ */ jsx_runtime6.jsxs("details", {
            children: [
              /* @__PURE__ */ jsx_runtime6.jsx("summary", {
                style: { cursor: "pointer" },
                children: "Request / response"
              }),
              /* @__PURE__ */ jsx_runtime6.jsxs("div", {
                style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 6 },
                children: [
                  full.state === undefined && full.questions === undefined ? /* @__PURE__ */ jsx_runtime6.jsx("div", {
                    className: "laya-meaning",
                    children: "Request state is loading…"
                  }) : /* @__PURE__ */ jsx_runtime6.jsx(JsonView, {
                    value: { state: full.state, questions: full.questions }
                  }),
                  /* @__PURE__ */ jsx_runtime6.jsx(JsonView, {
                    value: {
                      answers: call.answers,
                      verdict: call.verdict,
                      composite: call.composite,
                      margin: call.margin,
                      missing: call.missing,
                      usage: call.usage
                    }
                  })
                ]
              })
            ]
          })
        ]
      }) : null
    ]
  });
}
function LayaTurnCard(props) {
  const [calls, setCalls] = import_react4.useState([]);
  const [open, setOpen] = import_react4.useState(true);
  const [showAll, setShowAll] = import_react4.useState(false);
  import_react4.useEffect(() => {
    installLayaStyles();
  }, []);
  const turn = turnNumberOf(props.turn);
  const turnOpen = turnStatusOf(props.turn) === "open";
  const maxTries = turnOpen ? 3 : 0;
  import_react4.useEffect(() => {
    let active = true;
    let timer;
    let tries = 0;
    const tick = async () => {
      const found = turn === undefined ? [] : await props.lookupTurn(turn);
      if (!active)
        return;
      if (found.length > 0)
        setCalls(found);
      const settled = found.some((call) => call.authoritative);
      if (!settled && tries < maxTries) {
        tries += 1;
        timer = setTimeout(() => {
          tick();
        }, 800);
      }
    };
    tick();
    return () => {
      active = false;
      if (timer !== undefined)
        clearTimeout(timer);
    };
  }, [turn, maxTries, props.lookupTurn]);
  if (turn === undefined || calls.length === 0)
    return null;
  const decision = [...calls].reverse().find((call) => call.authoritative) ?? calls[calls.length - 1];
  const advisoryOnly = calls.every((call) => !call.authoritative);
  const composite = decision.composite === null ? "n/a" : decision.composite.toFixed(3);
  const margin = decision.margin === null ? "" : `${decision.margin >= 0 ? "+" : ""}${decision.margin.toFixed(3)}`;
  const visible = showAll ? calls : calls.slice(0, 3);
  const hidden = calls.length - visible.length;
  const title = calls.length === 1 ? "Laya judged this turn" : `Laya judged this turn ${calls.length} times`;
  return /* @__PURE__ */ jsx_runtime6.jsxs("section", {
    className: "laya-card",
    "aria-label": "Laya judge results for this turn",
    children: [
      /* @__PURE__ */ jsx_runtime6.jsxs("button", {
        type: "button",
        className: "laya-head",
        "aria-expanded": open,
        "aria-label": open ? "Hide Laya judge results" : "Show Laya judge results",
        onClick: () => {
          setOpen((value) => !value);
        },
        children: [
          /* @__PURE__ */ jsx_runtime6.jsx("span", {
            className: "laya-tile",
            children: /* @__PURE__ */ jsx_runtime6.jsx(LayaGlyph, {})
          }),
          /* @__PURE__ */ jsx_runtime6.jsxs("span", {
            className: "laya-titles",
            children: [
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                className: "laya-title",
                children: title
              }),
              /* @__PURE__ */ jsx_runtime6.jsxs("span", {
                className: "laya-stat",
                children: [
                  /* @__PURE__ */ jsx_runtime6.jsxs("span", {
                    className: "laya-numbers",
                    children: [
                      advisoryOnly ? /* @__PURE__ */ jsx_runtime6.jsx("span", {
                        children: "advisory"
                      }) : null,
                      /* @__PURE__ */ jsx_runtime6.jsx("span", {
                        style: { color: verdictColor(decision.verdict), fontWeight: 600 },
                        children: decision.verdict
                      }),
                      /* @__PURE__ */ jsx_runtime6.jsx("span", {
                        children: `composite ${composite}`
                      }),
                      margin.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsxs("span", {
                        children: [
                          "margin ",
                          margin
                        ]
                      }),
                      decision.vetoes.length === 0 ? null : /* @__PURE__ */ jsx_runtime6.jsx("span", {
                        children: decision.vetoes.join(", ")
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime6.jsx("span", {
                    className: "laya-hint",
                    children: open ? "Hide details" : "Show details"
                  })
                ]
              })
            ]
          })
        ]
      }),
      open ? /* @__PURE__ */ jsx_runtime6.jsxs(jsx_runtime6.Fragment, {
        children: [
          /* @__PURE__ */ jsx_runtime6.jsx("ul", {
            className: "laya-list",
            children: visible.map((call) => /* @__PURE__ */ jsx_runtime6.jsx(CallRow, {
              call,
              defaultOpen: call.authoritative,
              loadDetail: props.lookupDetail
            }, call.id))
          }),
          hidden > 0 || showAll ? /* @__PURE__ */ jsx_runtime6.jsxs("button", {
            type: "button",
            className: "laya-toggle",
            onClick: () => {
              setShowAll((value) => !value);
            },
            children: [
              /* @__PURE__ */ jsx_runtime6.jsx("span", {
                children: showAll ? "Show fewer" : `All ${calls.length} calls`
              }),
              /* @__PURE__ */ jsx_runtime6.jsx("svg", {
                width: "14",
                height: "14",
                viewBox: "0 0 16 16",
                fill: "none",
                "aria-hidden": "true",
                children: /* @__PURE__ */ jsx_runtime6.jsx("path", {
                  d: showAll ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4",
                  stroke: "currentColor",
                  strokeWidth: "1.4",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                })
              })
            ]
          }) : null
        ]
      }) : null
    ]
  });
}

// src/client/LayaToolView.tsx
var import_react5 = require("react");
var jsx_runtime7 = require("react/jsx-runtime");
function resultText(content) {
  if (!Array.isArray(content))
    return "";
  return content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
}
function parseVerdict(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{"))
    return;
  try {
    const value = JSON.parse(trimmed);
    return typeof value === "object" && value !== null ? value : undefined;
  } catch {
    return;
  }
}
function taskOf(block) {
  const task = block.args?.task;
  if (typeof task === "string" && task.trim().length > 0)
    return task.trim();
  if (typeof block.argsRaw === "string") {
    try {
      const parsed = JSON.parse(block.argsRaw);
      if (typeof parsed.task === "string")
        return parsed.task.trim();
    } catch {}
  }
  return "";
}
function LayaToolView(props) {
  const [open, setOpen] = import_react5.useState(true);
  import_react5.useEffect(() => {
    installLayaStyles();
  }, []);
  const running = props.phase !== "result";
  const task = taskOf(props.block);
  if (running) {
    return /* @__PURE__ */ jsx_runtime7.jsx("section", {
      className: "laya-card",
      "aria-label": "Laya is judging this task",
      children: /* @__PURE__ */ jsx_runtime7.jsxs("div", {
        className: "laya-head",
        "data-static": "true",
        children: [
          /* @__PURE__ */ jsx_runtime7.jsx("span", {
            className: "laya-tile",
            children: /* @__PURE__ */ jsx_runtime7.jsx(LayaGlyph, {})
          }),
          /* @__PURE__ */ jsx_runtime7.jsxs("span", {
            className: "laya-titles",
            children: [
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-title",
                children: "Laya is judging…"
              }),
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-stat",
                children: /* @__PURE__ */ jsx_runtime7.jsx("span", {
                  className: "laya-numbers",
                  children: /* @__PURE__ */ jsx_runtime7.jsx("span", {
                    children: task.length > 0 ? task.slice(0, 140) : "advisory judge"
                  })
                })
              })
            ]
          })
        ]
      })
    });
  }
  const failed = props.block.isError === true;
  const text = resultText(props.block.content);
  const verdict = failed ? undefined : parseVerdict(text);
  const answers = verdict?.answers ?? {};
  const answerCount = Object.keys(answers).length;
  const label = verdict?.verdict ?? (failed ? "error" : "unknown");
  const composite = typeof verdict?.composite === "number" ? verdict.composite : undefined;
  const margin = typeof verdict?.margin === "number" ? `${verdict.margin >= 0 ? "+" : ""}${verdict.margin.toFixed(3)}` : "";
  const elapsed = typeof props.block.time === "number" && typeof props.block.callTime === "number" ? latencyLabel(props.block.time - props.block.callTime) : "";
  const vetoes = verdict?.vetoes ?? [];
  const missing = verdict?.missing ?? [];
  const findings = verdict?.findings ?? [];
  const paths = verdict?.paths ?? [];
  return /* @__PURE__ */ jsx_runtime7.jsxs("section", {
    className: "laya-card",
    "aria-label": "Laya judge result",
    children: [
      /* @__PURE__ */ jsx_runtime7.jsxs("button", {
        type: "button",
        className: "laya-head",
        "aria-expanded": open,
        "aria-label": open ? "Hide the judge result" : "Show the judge result",
        onClick: () => {
          setOpen((value) => !value);
        },
        children: [
          /* @__PURE__ */ jsx_runtime7.jsx("span", {
            className: "laya-tile",
            children: /* @__PURE__ */ jsx_runtime7.jsx(LayaGlyph, {})
          }),
          /* @__PURE__ */ jsx_runtime7.jsxs("span", {
            className: "laya-titles",
            children: [
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-title",
                children: failed ? "Laya judge failed" : verdict === undefined ? "Laya judge result" : "Advisory judgement"
              }),
              /* @__PURE__ */ jsx_runtime7.jsxs("span", {
                className: "laya-stat",
                children: [
                  /* @__PURE__ */ jsx_runtime7.jsxs("span", {
                    className: "laya-numbers",
                    children: [
                      verdict?.authoritative === false ? /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: "advisory"
                      }) : null,
                      /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        style: { color: verdictColor(label), fontWeight: 600 },
                        children: label
                      }),
                      composite === undefined ? null : /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: `composite ${composite.toFixed(3)}`
                      }),
                      margin.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsxs("span", {
                        children: [
                          "margin ",
                          margin
                        ]
                      }),
                      answerCount === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: `${answerCount} answers`
                      }),
                      vetoes.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: vetoes.join(", ")
                      }),
                      verdict?.reviewOnly === true ? /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: "review only"
                      }) : null,
                      elapsed.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: elapsed
                      }),
                      /* @__PURE__ */ jsx_runtime7.jsx("span", {
                        children: clockLabel(new Date(typeof props.block.time === "number" ? props.block.time : Date.now()).toISOString())
                      })
                    ]
                  }),
                  /* @__PURE__ */ jsx_runtime7.jsx("span", {
                    className: "laya-hint",
                    children: open ? "Hide details" : "Show details"
                  })
                ]
              })
            ]
          })
        ]
      }),
      open ? /* @__PURE__ */ jsx_runtime7.jsxs("div", {
        className: "laya-detail",
        children: [
          failed ? /* @__PURE__ */ jsx_runtime7.jsx("div", {
            style: { color: "var(--dsw-alias-state-error-primary)" },
            children: props.block.error?.message ?? (text.slice(0, 400) || "the judge call failed")
          }) : null,
          /* @__PURE__ */ jsx_runtime7.jsx(PromptLine, {
            text: task
          }),
          failed ? null : /* @__PURE__ */ jsx_runtime7.jsx(ScoreMeter, {
            value: composite,
            threshold: verdict?.threshold
          }),
          failed ? null : vetoes.length > 0 && answerCount === 0 ? /* @__PURE__ */ jsx_runtime7.jsx("div", {
            className: "laya-meaning",
            children: "The deterministic verify lane blocked this before the judge was asked."
          }) : /* @__PURE__ */ jsx_runtime7.jsx(Answers, {
            answers
          }),
          missing.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsxs("div", {
            children: [
              "Missing criteria: ",
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-conf",
                children: missing.join(", ")
              })
            ]
          }),
          (verdict?.failures ?? []).length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsxs("div", {
            children: [
              "Failed criteria:",
              " ",
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-conf",
                children: (verdict?.failures ?? []).map((failure) => failure.key ?? failure.message ?? "?").join(", ")
              })
            ]
          }),
          vetoes.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsxs("div", {
            children: [
              "Vetoes: ",
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-conf",
                children: vetoes.join(", ")
              })
            ]
          }),
          findings.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsx("div", {
            className: "laya-detailRow",
            children: findings.map((finding, index) => /* @__PURE__ */ jsx_runtime7.jsxs("span", {
              className: "laya-tag",
              "data-error": finding.severity === "high",
              children: [
                finding.rule ?? "finding",
                finding.path === undefined ? "" : ` · ${finding.path}`
              ]
            }, index))
          }),
          paths.length === 0 ? null : /* @__PURE__ */ jsx_runtime7.jsxs("div", {
            children: [
              "Files judged: ",
              /* @__PURE__ */ jsx_runtime7.jsx("span", {
                className: "laya-conf",
                children: paths.slice(0, 8).join(" · ")
              })
            ]
          }),
          verdict?.reviewOnly === true ? /* @__PURE__ */ jsx_runtime7.jsxs("div", {
            className: "laya-meaning",
            children: [
              "No corrective message was sent: the judge reached this without evidence of a real problem (marginal margin or answers under the confidence floor). Set",
              /* @__PURE__ */ jsx_runtime7.jsx("code", {
                children: " layaSteerOnReview "
              }),
              " to enforce it."
            ]
          }) : null,
          verdict?.note === undefined ? null : /* @__PURE__ */ jsx_runtime7.jsx("div", {
            className: "laya-meaning",
            children: verdict.note
          }),
          /* @__PURE__ */ jsx_runtime7.jsxs("details", {
            children: [
              /* @__PURE__ */ jsx_runtime7.jsx("summary", {
                style: { cursor: "pointer" },
                children: "Raw response"
              }),
              /* @__PURE__ */ jsx_runtime7.jsx("div", {
                style: { marginTop: 6 },
                children: /* @__PURE__ */ jsx_runtime7.jsx(JsonView, {
                  value: verdict ?? { result: text.slice(0, 2000) }
                })
              })
            ]
          })
        ]
      }) : null,
      /* @__PURE__ */ jsx_runtime7.jsxs("button", {
        type: "button",
        className: "laya-toggle",
        onClick: () => {
          setOpen((value) => !value);
        },
        children: [
          /* @__PURE__ */ jsx_runtime7.jsx("span", {
            children: open ? "Hide details" : `Show what Laya returned${answerCount > 0 ? ` (${answerCount} answers)` : ""}`
          }),
          /* @__PURE__ */ jsx_runtime7.jsx("svg", {
            width: "14",
            height: "14",
            viewBox: "0 0 16 16",
            fill: "none",
            "aria-hidden": "true",
            children: /* @__PURE__ */ jsx_runtime7.jsx("path", {
              d: open ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4",
              stroke: "currentColor",
              strokeWidth: "1.4",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            })
          })
        ]
      })
    ]
  });
}

// src/client/SessionUnreadAction.tsx
var jsx_runtime8 = require("react/jsx-runtime");
var CSS_ID = "dsh-totem-session-unread-css";
function installSessionUnreadStyles() {
  if (typeof document === "undefined")
    return;
  if (document.getElementById(CSS_ID) !== null)
    return;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = `
.totem-unread-action{display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.totem-unread-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.totem-unread-action:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-focus-ring-color)}
`;
  document.head.append(style);
}
function noStatus() {
  return;
}
function SessionUnreadAction(props) {
  const { sessionId, markUnread } = props;
  const useStatus = props.useSessionStatus ?? noStatus;
  const status = useStatus((statuses) => sessionId === undefined ? undefined : statuses.get(sessionId));
  if (sessionId === undefined || markUnread === undefined)
    return null;
  if (props.isCurrent?.(sessionId) === true)
    return null;
  if (status?.running === true)
    return null;
  if (status?.completionUnread === true)
    return null;
  return /* @__PURE__ */ jsx_runtime8.jsx("button", {
    type: "button",
    className: "totem-unread-action",
    title: "Mark as unread",
    "aria-label": "Mark as unread",
    onClick: (event) => {
      event.preventDefault?.();
      event.stopPropagation?.();
      markUnread(sessionId);
    },
    children: /* @__PURE__ */ jsx_runtime8.jsxs("svg", {
      width: "14",
      height: "14",
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx_runtime8.jsx("circle", {
          cx: "8",
          cy: "8",
          r: "5.2",
          stroke: "currentColor",
          strokeWidth: "1.4"
        }),
        /* @__PURE__ */ jsx_runtime8.jsx("circle", {
          cx: "8",
          cy: "8",
          r: "2.2",
          fill: "currentColor"
        })
      ]
    })
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

// src/client/OverviewPage.tsx
var import_react6 = require("react");
var jsx_runtime9 = require("react/jsx-runtime");
var PAGE = {
  height: "100%",
  overflowY: "auto",
  padding: "28px 32px 40px",
  display: "flex",
  justifyContent: "center"
};
var INNER = { width: "100%", maxWidth: 1040, display: "flex", flexDirection: "column", gap: 22 };
var MUTED2 = { color: "var(--dsw-alias-text-secondary, #9a9a9a)", fontSize: 12 };
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
  const weeks = import_react6.useMemo(() => buildWeeks(days, mode), [days, mode]);
  const labels = import_react6.useMemo(() => {
    let previous = "";
    return weeks.map((column) => {
      const month = column[0].date.slice(0, 7);
      if (month === previous)
        return "";
      previous = month;
      return new Date(`${column[0].date}T12:00:00`).toLocaleDateString(undefined, { month: "short" });
    });
  }, [weeks]);
  return /* @__PURE__ */ jsx_runtime9.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 6, overflowX: "auto" },
    children: [
      /* @__PURE__ */ jsx_runtime9.jsx("div", {
        style: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "13px", gap: 2, minWidth: 53 * 15 },
        children: labels.map((label, index) => /* @__PURE__ */ jsx_runtime9.jsx("span", {
          style: { ...MUTED2, fontSize: 10, whiteSpace: "nowrap" },
          children: label
        }, index))
      }),
      /* @__PURE__ */ jsx_runtime9.jsx("div", {
        style: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "13px", gap: 2, minWidth: 53 * 15 },
        children: weeks.map((column, index) => /* @__PURE__ */ jsx_runtime9.jsx("div", {
          style: { display: "grid", gridTemplateRows: "repeat(7, 13px)", gap: 2 },
          children: column.map((cell) => /* @__PURE__ */ jsx_runtime9.jsx("div", {
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
      /* @__PURE__ */ jsx_runtime9.jsxs("div", {
        style: { display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" },
        children: [
          /* @__PURE__ */ jsx_runtime9.jsx("span", {
            style: { ...MUTED2, fontSize: 10 },
            children: "Less"
          }),
          COLORS.map((color, index) => /* @__PURE__ */ jsx_runtime9.jsx("span", {
            style: { width: 11, height: 11, borderRadius: 2, background: color }
          }, index)),
          /* @__PURE__ */ jsx_runtime9.jsx("span", {
            style: { ...MUTED2, fontSize: 10 },
            children: "More"
          })
        ]
      })
    ]
  });
}
function Stat({ label, value }) {
  return /* @__PURE__ */ jsx_runtime9.jsxs("div", {
    style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 108 },
    children: [
      /* @__PURE__ */ jsx_runtime9.jsx("span", {
        style: { fontSize: 15, fontWeight: 600 },
        children: value
      }),
      /* @__PURE__ */ jsx_runtime9.jsx("span", {
        style: { ...MUTED2, fontSize: 11 },
        children: label
      })
    ]
  });
}
function Failure({ reason, status }) {
  const text = reason === "unauthorized" ? "Set the Totem `apiToken` in Plugins, then reload this page." : reason === "missing-route" ? "The Host has not loaded the Overview endpoint (404). Restart `dsh-totem` and reload." : reason === "offline" ? "Cannot reach the Host. Check that the app is running." : `The Host returned an error${status === undefined ? "" : ` (${status})`}.`;
  return /* @__PURE__ */ jsx_runtime9.jsx("div", {
    style: { ...PAGE, alignItems: "center", justifyContent: "center" },
    children: /* @__PURE__ */ jsx_runtime9.jsxs("div", {
      style: { ...CARD2, maxWidth: 480, textAlign: "center" },
      children: [
        /* @__PURE__ */ jsx_runtime9.jsx("div", {
          style: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
          children: "Overview unavailable"
        }),
        /* @__PURE__ */ jsx_runtime9.jsx("div", {
          style: MUTED2,
          children: text
        })
      ]
    })
  });
}
function OverviewPage(props) {
  const [source, setSource] = import_react6.useState("all");
  const [result, setResult] = import_react6.useState(null);
  const [mode, setMode] = import_react6.useState("daily");
  const [importing, setImporting] = import_react6.useState(false);
  import_react6.useEffect(() => {
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
    return /* @__PURE__ */ jsx_runtime9.jsx("div", {
      style: { ...PAGE, alignItems: "center", justifyContent: "center" },
      children: /* @__PURE__ */ jsx_runtime9.jsx("span", {
        style: MUTED2,
        children: "Loading usage…"
      })
    });
  }
  if (!result.ok)
    return /* @__PURE__ */ jsx_runtime9.jsx(Failure, {
      reason: result.reason,
      status: result.status
    });
  const data = result.data;
  const total = compact(data.totals.tokens);
  const unit = /[A-Za-z]$/u.exec(total)?.[0] ?? "";
  const digits = unit === "" ? total : total.slice(0, -1);
  const importedAt = data.import.importedAt;
  return /* @__PURE__ */ jsx_runtime9.jsx("div", {
    style: PAGE,
    children: /* @__PURE__ */ jsx_runtime9.jsxs("div", {
      style: INNER,
      children: [
        /* @__PURE__ */ jsx_runtime9.jsxs("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
          children: [
            /* @__PURE__ */ jsx_runtime9.jsx("div", {
              style: { display: "flex", gap: 2 },
              children: SOURCES.map((option) => /* @__PURE__ */ jsx_runtime9.jsx("button", {
                type: "button",
                onClick: () => {
                  setSource(option.id);
                },
                style: { ...CHIP, ...source === option.id ? { background: "var(--dsw-alias-bg-tertiary, #222)", color: "inherit" } : {} },
                children: option.label
              }, option.id))
            }),
            /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: { display: "flex", alignItems: "center", gap: 8 },
              children: [
                importedAt === null ? null : /* @__PURE__ */ jsx_runtime9.jsxs("span", {
                  style: { ...MUTED2, fontSize: 11 },
                  children: [
                    "Imported ",
                    new Date(importedAt).toLocaleString()
                  ]
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
                  type: "button",
                  style: CHIP,
                  onClick: () => {
                    props.load(source).then(setResult);
                  },
                  children: "Refresh"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("button", {
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
        data.totals.tokens === 0 ? /* @__PURE__ */ jsx_runtime9.jsxs("div", {
          style: { ...CARD2, textAlign: "center", padding: "40px 18px" },
          children: [
            /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: { fontSize: 14, fontWeight: 600, marginBottom: 6 },
              children: [
                "No usage for ",
                source
              ]
            }),
            /* @__PURE__ */ jsx_runtime9.jsx("div", {
              style: MUTED2,
              children: "Run a turn, or import the opencode/encoder history. Importing scans the message tables once and caches daily totals."
            })
          ]
        }) : /* @__PURE__ */ jsx_runtime9.jsxs(jsx_runtime9.Fragment, {
          children: [
            /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 8 },
              children: [
                /* @__PURE__ */ jsx_runtime9.jsxs("div", {
                  style: { display: "flex", alignItems: "baseline", gap: 6 },
                  children: [
                    /* @__PURE__ */ jsx_runtime9.jsx("span", {
                      style: { fontSize: 56, lineHeight: 1, fontWeight: 650, letterSpacing: "-0.03em" },
                      children: digits
                    }),
                    unit === "" ? null : /* @__PURE__ */ jsx_runtime9.jsx("span", {
                      style: { fontSize: 26, fontWeight: 600, color: "var(--dsw-alias-text-secondary, #9a9a9a)" },
                      children: unit
                    })
                  ]
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("span", {
                  style: { ...MUTED2, fontSize: 12 },
                  children: "Lifetime tokens"
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: { ...CARD2, display: "flex", flexWrap: "wrap", gap: "16px 28px", justifyContent: "space-between" },
              children: [
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Lifetime tokens",
                  value: integer(data.totals.tokens)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Peak day",
                  value: compact(data.stats.peak.tokens)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Longest streak",
                  value: `${data.stats.longestStreak} days`
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Current streak",
                  value: `${data.stats.currentStreak} days`
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Active days",
                  value: integer(data.totals.activeDays)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Sessions",
                  value: integer(data.totals.sessions)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Avg tokens/day",
                  value: compact(data.stats.avgTokensPerDay)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Avg prompts/day",
                  value: String(data.stats.avgPromptsPerDay)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Avg tokens/prompt",
                  value: compact(data.stats.avgTokensPerPrompt)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Avg session tokens",
                  value: compact(data.stats.avgSessionTokens)
                }),
                /* @__PURE__ */ jsx_runtime9.jsx(Stat, {
                  label: "Cached tokens",
                  value: compact(data.totals.cacheRead)
                })
              ]
            }),
            /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: CARD2,
              children: [
                /* @__PURE__ */ jsx_runtime9.jsxs("div", {
                  style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
                  children: [
                    /* @__PURE__ */ jsx_runtime9.jsxs("div", {
                      style: { display: "flex", flexDirection: "column", gap: 2 },
                      children: [
                        /* @__PURE__ */ jsx_runtime9.jsx("span", {
                          style: { fontSize: 13, fontWeight: 600 },
                          children: "Token activity"
                        }),
                        /* @__PURE__ */ jsx_runtime9.jsxs("span", {
                          style: { ...MUTED2, fontSize: 11 },
                          children: [
                            data.totals.prompts.toLocaleString(),
                            " prompts · peak ",
                            shortDate(data.stats.peak.date)
                          ]
                        })
                      ]
                    }),
                    /* @__PURE__ */ jsx_runtime9.jsx("div", {
                      style: { display: "flex", gap: 2 },
                      children: ["daily", "cumulative"].map((option) => /* @__PURE__ */ jsx_runtime9.jsx("button", {
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
                /* @__PURE__ */ jsx_runtime9.jsx(Heatmap, {
                  days: data.days,
                  mode
                })
              ]
            }),
            data.models.length > 0 ? /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: CARD2,
              children: [
                /* @__PURE__ */ jsx_runtime9.jsx("div", {
                  style: { fontSize: 13, fontWeight: 600, marginBottom: 10 },
                  children: "Top models"
                }),
                /* @__PURE__ */ jsx_runtime9.jsx("div", {
                  style: { display: "flex", flexDirection: "column", gap: 7 },
                  children: data.models.map((model) => {
                    const share = data.totals.tokens === 0 ? 0 : model.tokens / data.totals.tokens;
                    return /* @__PURE__ */ jsx_runtime9.jsxs("div", {
                      style: { display: "flex", alignItems: "center", gap: 10 },
                      children: [
                        /* @__PURE__ */ jsx_runtime9.jsx("span", {
                          style: { width: 190, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
                          children: model.model.length > 0 ? model.model : model.provider
                        }),
                        /* @__PURE__ */ jsx_runtime9.jsx("div", {
                          style: { flex: 1, height: 7, borderRadius: 4, background: "var(--dsw-alias-bg-tertiary, #222)", overflow: "hidden" },
                          children: /* @__PURE__ */ jsx_runtime9.jsx("div", {
                            style: { width: `${Math.max(2, Math.round(share * 100))}%`, height: "100%", background: "#1d8cf8" }
                          })
                        }),
                        /* @__PURE__ */ jsx_runtime9.jsx("span", {
                          style: { ...MUTED2, fontVariantNumeric: "tabular-nums", width: 70, textAlign: "right" },
                          children: compact(model.tokens)
                        }),
                        /* @__PURE__ */ jsx_runtime9.jsxs("span", {
                          style: { ...MUTED2, fontSize: 11, width: 42, textAlign: "right" },
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
            /* @__PURE__ */ jsx_runtime9.jsxs("div", {
              style: { ...MUTED2, fontSize: 11, textAlign: "center", paddingBottom: 8 },
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
var jsx_runtime10 = require("react/jsx-runtime");
function OverviewIcon({ size = 18 }) {
  return /* @__PURE__ */ jsx_runtime10.jsxs("svg", {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsx_runtime10.jsx("rect", {
        x: "1.5",
        y: "9.5",
        width: "2.6",
        height: "5",
        rx: "1",
        fill: "currentColor",
        opacity: "0.65"
      }),
      /* @__PURE__ */ jsx_runtime10.jsx("rect", {
        x: "6.7",
        y: "5.5",
        width: "2.6",
        height: "9",
        rx: "1",
        fill: "currentColor",
        opacity: "0.85"
      }),
      /* @__PURE__ */ jsx_runtime10.jsx("rect", {
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
  const layaSwitch = new LayaSwitchController(ctx.configForms.get("totem"), ctx);
  ctx.effect(() => () => {
    layaSwitch.dispose();
  }, "dsh-totem: laya switch lifetime");
  ctx.effect(() => ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
    name: "conversation.input.left",
    id: "laya",
    order: 10,
    inject: () => layaSwitch.inject()
  }, LayaSwitch)), "dsh-totem: laya switch");
  const decisionBadge = new DecisionBadgeController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
    name: "conversation.chat.assistant-actions",
    id: "laya-decision",
    order: 20,
    inject: () => ({ lookup: decisionBadge.lookup })
  }, DecisionBadge)), "dsh-totem: decision badge");
  const layaCalls = new LayaCallsController(ctx.configForms.get("totem"));
  ctx.effect(() => ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
    name: "conversation.chat.turnTail",
    id: "laya-turn",
    order: 10,
    inject: () => ({ lookupTurn: layaCalls.lookupTurn, lookupDetail: layaCalls.lookupDetail })
  }, LayaTurnCard)), "dsh-totem: laya turn card");
  ctx.effect(() => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
    name: "tool.call.toolview",
    key: "decision_ask"
  }, LayaToolView)), "dsh-totem: laya tool view");
  const overview = new OverviewController(ctx.configForms.get("totem"));
  installSessionUnreadStyles();
  let unread;
  const markUnread = (sessionId) => {
    unread?.mark(sessionId);
  };
  ctx.inject?.(["uiSession"], (inner) => {
    const session = inner.uiSession;
    if (session?.completionUnread === undefined)
      return;
    unread = new SessionUnreadController(session);
    unread.restore();
    ctx.effect(() => unread?.watch() ?? (() => {}), "dsh-totem: unread mark expiry");
  });
  ctx.effect(() => ctx.slots.inject("sidebar.workspaces.session.row.action", () => ctx.slots.register({
    name: "sidebar.workspaces.session.row.action",
    id: "totem-unread",
    order: 150,
    inject: () => ({ markUnread, isCurrent: (id) => unread?.isCurrent(id) ?? false })
  }, SessionUnreadAction)), "dsh-totem: mark session unread");
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
