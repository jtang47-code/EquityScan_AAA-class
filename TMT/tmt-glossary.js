(function () {
  window.IndustryModules = window.IndustryModules || {};
  const moduleRef = window.IndustryModules.TMT || { key: "TMT", label: "TMT" };
  window.IndustryModules.TMT = moduleRef;

  const state = {
    requestToken: 0,
    llmCache: new Map(),
    saveStatus: "",
    chatOpen: false,
    chatBusy: false,
    chatMessages: [],
    chatPendingEntry: null,
    lastLookupTerm: "",
    lastWebResults: [],
    lastResolvedAssistantResponse: "",
    chatDrag: {
      pointerId: null,
      source: "",
      startX: 0,
      startY: 0,
      originLeft: 0,
      originTop: 0,
      didMove: false,
      skipLauncherClick: false
    }
  };
  function getApiBaseUrl() {
    const appBase = String(window.APP_CONFIG?.getApiBaseUrl?.() || window.APP_CONFIG?.apiBaseUrl || "").trim();
    if (appBase) return appBase.replace(/\/+$/, "");
    return window.location.protocol === "file:" ? "http://localhost:8000" : "";
  }
  const CHAT_VIEWPORT_PADDING = 8;
  const CHAT_DEFAULT_RIGHT = 28;
  const CHAT_DEFAULT_BOTTOM = 24;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeSearch(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function isNonSpecificReferenceTerm(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return false;
    if (raw === raw.toUpperCase() && /[A-Z]/.test(raw)) return false;
    return new Set(["it", "that", "this", "they", "them", "one", "something"]).has(raw.toLowerCase());
  }

  function isRetryInstruction(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) return false;
    return [
      /^try again[.!?]*$/,
      /^retry[.!?]*$/,
      /^do that again[.!?]*$/,
      /^search again[.!?]*$/,
      /^look again[.!?]*$/,
      /^again[.!?]*$/
    ].some((pattern) => pattern.test(text));
  }

  function isSaveConfirmationMessage(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) return false;
    const directPatterns = [
      /^yes[.!?]*$/,
      /^save[.!?]*$/,
      /^save it[.!?]*$/,
      /^save that[.!?]*$/,
      /^add it[.!?]*$/,
      /^add that[.!?]*$/,
      /^do it[.!?]*$/,
      /^please save[.!?]*$/
    ];
    if (directPatterns.some((pattern) => pattern.test(text))) return true;

    return (
      /\bsave\b/.test(text)
      && (/\b(it|that|this)\b/.test(text) || /\bglossary\b/.test(text) || /\bdataset\b/.test(text) || /\bdefinition\b/.test(text))
    );
  }

  function getGlossaryConfig(industryKey) {
    const mod = window.IndustryModules?.[industryKey] || {};
    return mod.glossary || {
      dataVarName: `${industryKey}GlossaryData`,
      fileName: `${String(industryKey || "industry").toLowerCase()}-glossary-data.js`
    };
  }

  function getIndustryPromptContext(industryKey) {
    const mod = window.IndustryModules?.[industryKey] || {};
    const label = String(mod.label || industryKey || "Industry");
    const sidebarTitle = String(mod.sidebar?.title || "");
    const glossaryContext = String(mod.glossary?.llmContext || "");
    return {
      label,
      sidebarTitle,
      glossaryContext
    };
  }

  function getGlossaryEntries(industryKey) {
    const cfg = getGlossaryConfig(industryKey);
    return Array.isArray(window[cfg.dataVarName]) ? window[cfg.dataVarName].slice() : [];
  }

  function setGlossaryEntries(industryKey, entries) {
    const cfg = getGlossaryConfig(industryKey);
    window[cfg.dataVarName] = entries;
  }

  function groupEntries(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
      const key = `${entry.acronym}__${entry.meaning}`;
      if (!groups.has(key)) {
        groups.set(key, { acronym: entry.acronym, meaning: entry.meaning, explanations: [] });
      }
      const group = groups.get(key);
      if (!group.explanations.includes(entry.practicalExplanation)) {
        group.explanations.push(entry.practicalExplanation);
      }
    });
    return [...groups.values()];
  }

  function findGlossaryMatches(industryKey, rawQuery) {
    const query = normalizeSearch(rawQuery);
    const groupedAll = groupEntries(getGlossaryEntries(industryKey)).sort((a, b) => a.acronym.localeCompare(b.acronym));
    const exact = groupedAll.filter((entry) => normalizeSearch(entry.acronym) === query);
    const partial = groupedAll.filter((entry) => {
      if (!query) return false;
      if (normalizeSearch(entry.acronym) === query) return false;
      const haystack = `${entry.acronym} ${entry.meaning} ${entry.explanations.join(" ")}`.toUpperCase();
      return haystack.includes(query);
    });
    return { exact, partial, groupedAll };
  }

  function extractExplicitLookupTerm(message) {
    const text = String(message || "").trim();
    if (!text) return "";

    const quoted = text.match(/["']([^"']+)["']/);
    if (quoted?.[1] && !isNonSpecificReferenceTerm(quoted[1])) return quoted[1].trim();

    const patterns = [
      /what does\s+([a-z0-9/+&.-]+)\s+mean/i,
      /meaning of\s+([a-z0-9/+&.-]+)/i,
      /define\s+([a-z0-9/+&.-]+)/i,
      /explain\s+([a-z0-9/+&.-]+)/i,
      /what is\s+([a-z0-9/+&.-]+)/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] && !isNonSpecificReferenceTerm(match[1])) return match[1].trim();
    }

    const directSearchPatterns = [
      /(?:search|look up|lookup|check)\s+([a-z0-9/+&.-]{2,})/i,
      /(?:what about|how about)\s+([a-z0-9/+&.-]{2,})/i
    ];
    for (const pattern of directSearchPatterns) {
      const match = text.match(pattern);
      if (match?.[1] && !isNonSpecificReferenceTerm(match[1])) return match[1].trim();
    }

    const upperToken = text.match(/\b[A-Z0-9/+&.-]{2,}\b/);
    if (upperToken?.[0]) return upperToken[0].trim();

    const shortStandalone = text.match(/^\s*([a-z0-9/+&.-]{2,12})\s*[?.!]*\s*$/i);
    if (shortStandalone?.[1] && !isNonSpecificReferenceTerm(shortStandalone[1])) return shortStandalone[1].trim();

    return "";
  }

  function inferLookupTerm(message) {
    const explicit = extractExplicitLookupTerm(message);
    if (explicit) return explicit;

    const text = String(message || "").trim();
    if (!text) return "";

    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length <= 4) return text;
    return tokens[tokens.length - 1];
  }

  function isLikelySpecificGlossaryTerm(value) {
    const text = String(value || "").trim();
    if (!text) return false;
    if (text.length <= 16 && /[A-Z]/.test(text) && !/\s/.test(text)) return true;
    if (/^[A-Z][a-z]?[A-Z]?[a-z]?(?:[0-9/+&.-]+)?$/.test(text)) return true;
    return false;
  }

  function isContextRefinementMessage(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) return false;

    const refinementPatterns = [
      /\b(it|that|this)\b/,
      /\bmore specifically\b/,
      /\bwithin\b/,
      /\bin the context of\b/,
      /\bcontext\b/,
      /\brelated to\b/,
      /\bi think\b/,
      /\bprobably\b/,
      /\bmaybe\b/,
      /\bagain\b/,
      /\bsearch again\b/,
      /\brefine\b/,
      /\bnarrow\b/,
      /\bmore likely\b/,
      /\bmaterials\b/,
      /\bchemicals\b/,
      /\bchips\b/,
      /\bsemiconductor\b/,
      /\btelecom\b/,
      /\bnetwork\b/
    ];

    return refinementPatterns.some((pattern) => pattern.test(text));
  }

  function isExplicitResearchRefresh(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) return false;

    const refreshPatterns = [
      /\bsearch again\b/,
      /\bsearch the web\b/,
      /\bweb search\b/,
      /\blook it up\b/,
      /\blookup again\b/,
      /\bcheck online\b/,
      /\bresearch again\b/,
      /\btry another search\b/,
      /\bfind more sources\b/
    ];

    return refreshPatterns.some((pattern) => pattern.test(text));
  }

  function isMetaConversationMessage(message) {
    const text = String(message || "").trim().toLowerCase();
    if (!text) return false;

    const metaPatterns = [
      /\bwhat did i ask before\b/,
      /\bwhat did we talk about\b/,
      /\bwhat were we talking about\b/,
      /\bwhat did you say\b/,
      /\bremind me\b/,
      /\bsummarize\b/,
      /\brecap\b/,
      /\brepeat that\b/,
      /\bwhat do you remember\b/,
      /\bdo you remember\b/
    ];

    return metaPatterns.some((pattern) => pattern.test(text));
  }

  function resolveChatLookupTerm(message) {
    if (state.lastLookupTerm && isRetryInstruction(message)) {
      return { lookupTerm: state.lastLookupTerm, explicit: false };
    }

    const explicit = extractExplicitLookupTerm(message);
    if (explicit) {
      return { lookupTerm: explicit, explicit: true };
    }

    if (state.lastLookupTerm && isContextRefinementMessage(message)) {
      return { lookupTerm: state.lastLookupTerm, explicit: false };
    }

    if (state.lastLookupTerm) {
      return { lookupTerm: state.lastLookupTerm, explicit: false };
    }

    return { lookupTerm: inferLookupTerm(message), explicit: false };
  }

  function formatCandidateHtml(entry, index, sourceLabel = "Result") {
    return `
      <div class="glossary-chat-candidate">
        <div class="glossary-chat-candidate-top">
          <div class="glossary-chat-candidate-title">${escapeHtml(entry.acronym)}</div>
          <div class="glossary-badge">${escapeHtml(`${sourceLabel} ${index + 1}`)}</div>
        </div>
        <div class="glossary-chat-candidate-meaning">${escapeHtml(entry.meaning)}</div>
        <div class="glossary-chat-candidate-text">${escapeHtml(entry.practicalExplanation)}</div>
      </div>
    `;
  }

  function renderChatMessages(host) {
    host.innerHTML = state.chatMessages.map((message) => {
      return `
        <div class="glossary-chat-message ${message.role === "user" ? "user" : "assistant"}">
          <div class="glossary-chat-bubble ${message.working ? "working" : ""}">${message.html}</div>
        </div>
      `;
    }).join("");
    host.scrollTop = host.scrollHeight;
    requestAnimationFrame(() => {
      if (typeof window.__tmtGlossaryClampChatPosition === "function") {
        window.__tmtGlossaryClampChatPosition();
      }
    });
  }

  function pushChatMessage(role, html) {
    const plain = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    state.chatMessages.push({ role, html, text: plain });
  }

  function pushWorkingMessage() {
    state.chatMessages.push({
      role: "assistant",
      html: '<div class="glossary-chat-working"><span class="glossary-chat-working-spinner"></span><span>Agent G is working hard</span><span class="glossary-chat-working-dots"><span></span><span></span><span></span></span></div>',
      text: "Agent G is working hard",
      working: true
    });
  }

  function removeWorkingMessage() {
    const index = state.chatMessages.findIndex((message) => message.working);
    if (index >= 0) state.chatMessages.splice(index, 1);
  }

  function buildWebSearchContext(industryKey, query) {
    const ctx = getIndustryPromptContext(industryKey);
    return [
      ctx.label,
      ctx.sidebarTitle,
      ctx.glossaryContext,
      `${String(query || "").trim()} acronym meaning practical explanation`
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function fetchGlossaryWebResearch(query, industryKey) {
    const response = await fetch(`${getApiBaseUrl()}/api/websearch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${String(query || "").trim()} acronym`,
        context: buildWebSearchContext(industryKey, query),
        numResults: 5
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.detail || `HTTP ${response.status}`));
    }
    return Array.isArray(data?.results) ? data.results : [];
  }

  async function fetchAgentGResponse(userMessage, industryKey) {
    const history = state.chatMessages
      .map((message) => ({ role: message.role, content: String(message.text || "").trim() }))
      .filter((item) => item.content);

    const industryContext = getIndustryPromptContext(industryKey);
    try {
      if (!window.LLMShell || typeof window.LLMShell.planGlossaryAgentTurn !== "function" || typeof window.LLMShell.answerGlossaryAgentTurn !== "function") {
        return { ok: false, error: "Agent G shell is not loaded. Check llm_shell/client.js and llm_shell/workflows.js." };
      }

      const planner = await window.LLMShell.planGlossaryAgentTurn({
        agentName: "Agent G",
        userMessage,
        industryKey,
        industryLabel: industryContext.label,
        industryContext: industryContext.glossaryContext,
        sidebarTitle: industryContext.sidebarTitle,
        conversationHistory: history,
        lastResolvedTerm: state.lastLookupTerm,
        pendingCandidateEntry: state.chatPendingEntry
      });
      if (!planner.ok) {
        return { ok: false, error: planner.error || "Agent G planner failed." };
      }

      if (planner.mode === "save_pending") {
        return {
          ok: true,
          action: "save_pending",
          assistantResponse: planner.assistantResponse || "",
          suggestedLookupTerm: state.lastLookupTerm || ""
        };
      }

      if (planner.mode === "reply" && !planner.lookupTerm) {
        return {
          ok: true,
          action: "reply",
          assistantResponse: planner.assistantResponse || "",
          suggestedLookupTerm: state.lastLookupTerm || "",
          lookupTermUsed: state.lastLookupTerm || ""
        };
      }

      const lookupTerm = String(planner.lookupTerm || state.lastLookupTerm || "").trim();
      if (!lookupTerm) {
        return {
          ok: true,
          action: "reply",
          assistantResponse: planner.assistantResponse || "Tell me which acronym or term you want me to check.",
          suggestedLookupTerm: state.lastLookupTerm || "",
          lookupTermUsed: state.lastLookupTerm || ""
        };
      }

      const localMatches = findGlossaryMatches(industryKey, lookupTerm);
      const datasetExactMatches = localMatches.exact.map((entry) => ({
        acronym: entry.acronym,
        meaning: entry.meaning,
        practicalExplanation: entry.explanations.join(" ")
      }));
      const datasetPartialMatches = localMatches.partial.map((entry) => ({
        acronym: entry.acronym,
        meaning: entry.meaning,
        practicalExplanation: entry.explanations.join(" ")
      }));

      const shouldSearchWeb = Boolean(planner.useWebResearch && lookupTerm);
      const webResults = shouldSearchWeb
        ? await fetchGlossaryWebResearch(planner.searchQuery || `${lookupTerm} ${String(userMessage || "").trim()}`, industryKey).catch(() => [])
        : [];

      const answer = await window.LLMShell.answerGlossaryAgentTurn({
        agentName: "Agent G",
        userMessage,
        lookupTerm,
        industryKey,
        industryLabel: industryContext.label,
        industryContext: industryContext.glossaryContext,
        sidebarTitle: industryContext.sidebarTitle,
        conversationHistory: history,
        lastResolvedTerm: state.lastLookupTerm,
        datasetExactMatches,
        datasetPartialMatches,
        webResults
      });
      if (!answer.ok) {
        return { ok: false, error: answer.error || "Agent G could not answer." };
      }

      return {
        ok: true,
        action: "resolve_term",
        assistantResponse: String(answer.assistantResponse || "").trim(),
        candidateEntry: answer.candidateEntry || null,
        offerSave: Boolean(answer.offerSave && answer.candidateEntry),
        suggestedLookupTerm: String(answer.suggestedLookupTerm || lookupTerm).trim(),
        lookupTermUsed: lookupTerm,
        webResultsUsed: webResults
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  }

  async function saveGlossaryEntry(industryKey, entry) {
    const cfg = getGlossaryConfig(industryKey);
    const currentEntries = getGlossaryEntries(industryKey);
    const exists = currentEntries.some((item) => {
      return normalizeSearch(item.acronym) === normalizeSearch(entry.acronym)
        && String(item.meaning).trim() === String(entry.meaning).trim()
        && String(item.practicalExplanation).trim() === String(entry.practicalExplanation).trim();
    });
    if (exists) return { saved: false, reason: "Entry already exists in the glossary database." };

    const response = await fetch(`${getApiBaseUrl()}/api/glossary/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        industryKey,
        fileName: cfg.fileName,
        dataVarName: cfg.dataVarName,
        entry
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String(data?.detail || `HTTP ${response.status}`));
    }

    if (!data?.saved) {
      return { saved: false, reason: String(data?.reason || "No changes written.") };
    }

    const updatedEntries = [...currentEntries, entry].sort((a, b) => a.acronym.localeCompare(b.acronym));
    setGlossaryEntries(industryKey, updatedEntries);
    return { saved: true };
  }

  async function buildPendingGlossaryEntry(industryKey, lookupTerm, assistantResponse = "") {
    const term = String(lookupTerm || "").trim();
    if (!term || !window.LLMShell || typeof window.LLMShell.synthesizeGlossaryCandidate !== "function") {
      return null;
    }

    const currentEntries = getGlossaryEntries(industryKey);
    const industryContext = getIndustryPromptContext(industryKey);
    const history = state.chatMessages
      .map((message) => ({ role: message.role, content: String(message.text || "").trim() }))
      .filter((item) => item.content);
    const result = await window.LLMShell.synthesizeGlossaryCandidate({
      lookupTerm: term,
      industryKey,
      industryLabel: industryContext.label,
      industryContext: industryContext.glossaryContext,
      assistantResponse,
      conversationHistory: history
    });
    if (!result?.ok || !result.entry) {
      return null;
    }
    const entry = result.entry;
    const alreadyExists = currentEntries.some((item) => {
      return normalizeSearch(item.acronym) === normalizeSearch(entry.acronym)
        && String(item.meaning).trim() === String(entry.meaning).trim()
        && String(item.practicalExplanation).trim() === String(entry.practicalExplanation).trim();
    });
    return alreadyExists ? null : entry;
  }

  function ensureGlossaryStyles() {
    if (document.getElementById("tmt-glossary-style")) return;
    const styleEl = document.createElement("style");
    styleEl.id = "tmt-glossary-style";
    styleEl.textContent = `
      .glossary-shell { padding: 32px; }
      .glossary-hero { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 24px; }
      .glossary-kicker { color: #8b949e; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 10px; }
      .glossary-title { color: #f3f4f6; font-size: 30px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.05; margin: 0; }
      .glossary-subtitle { color: #94a3b8; font-size: 13px; line-height: 1.7; margin-top: 10px; max-width: 640px; }
      .glossary-meta { border: 1px solid var(--panel-border); background: rgba(255,255,255,0.02); color: #94a3b8; border-radius: 2px; padding: 12px 14px; min-width: 170px; }
      .glossary-meta-value { color: #f8fafc; font-size: 22px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
      .glossary-meta-label { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
      .glossary-search-panel { border: 1px solid var(--panel-border); background: rgba(255,255,255,0.015); padding: 16px; margin-bottom: 22px; }
      .glossary-search-row { display: flex; gap: 14px; align-items: center; }
      .glossary-search-box { position: relative; flex: 1; }
      .glossary-search-box i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 12px; }
      .glossary-search-input { width: 100%; background: #0f131b; border: 1px solid var(--panel-border); color: #f8fafc; padding: 13px 14px 13px 38px; font-size: 13px; outline: none; border-radius: 2px; transition: border-color 0.2s ease, box-shadow 0.2s ease; }
      .glossary-search-input:focus { border-color: rgba(91, 140, 255, 0.55); box-shadow: 0 0 0 1px rgba(91, 140, 255, 0.25); }
      .glossary-clear-btn, .glossary-save-btn { border: 1px solid var(--panel-border); background: rgba(255,255,255,0.02); color: #cbd5e1; padding: 12px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; border-radius: 2px; }
      .glossary-save-btn { color: #dbe6ff; border-color: rgba(91, 140, 255, 0.24); background: rgba(91, 140, 255, 0.08); }
      .glossary-save-btn[disabled] { opacity: 0.6; cursor: wait; }
      .glossary-search-hint { margin-top: 10px; color: #64748b; font-size: 11px; letter-spacing: 0.03em; }
      .glossary-results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .glossary-results-title { color: #f3f4f6; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
      .glossary-results-count { color: #94a3b8; font-size: 11px; }
      .glossary-results-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
      .glossary-card { border: 1px solid var(--panel-border); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)); padding: 18px 18px 16px; min-height: 180px; }
      .glossary-card-top { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 10px; }
      .glossary-acronym { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 0.02em; line-height: 1; }
      .glossary-badge { border: 1px solid rgba(91, 140, 255, 0.28); color: #9bb6ff; background: rgba(91, 140, 255, 0.08); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 7px; border-radius: 999px; white-space: nowrap; }
      .glossary-meaning { color: #cbd5e1; font-size: 14px; font-weight: 700; line-height: 1.5; margin-bottom: 12px; }
      .glossary-explanation-list { display: flex; flex-direction: column; gap: 10px; }
      .glossary-explanation { color: #94a3b8; font-size: 12px; line-height: 1.65; padding-left: 12px; border-left: 2px solid rgba(91, 140, 255, 0.22); }
      .glossary-empty, .glossary-loading, .glossary-error { border: 1px dashed var(--panel-border); color: #94a3b8; padding: 42px 18px; text-align: center; font-size: 13px; line-height: 1.7; }
      .glossary-error { color: #fca5a5; }
      .glossary-chatbox {
        position: fixed;
        right: 28px;
        bottom: 24px;
        width: min(420px, calc(100vw - 40px));
        border: 1px solid rgba(91, 140, 255, 0.36);
        background:
          linear-gradient(180deg, rgba(22, 28, 39, 0.97), rgba(12, 17, 25, 0.985)),
          radial-gradient(circle at top right, rgba(91, 140, 255, 0.12), transparent 46%);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.48), 0 0 0 1px rgba(91, 140, 255, 0.08);
        backdrop-filter: blur(10px);
        z-index: 40;
        transform-origin: bottom right;
        transition: opacity 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease;
      }
      .glossary-chatbox.collapsed { opacity: 0; transform: translateY(16px) scale(0.96); pointer-events: none; box-shadow: 0 12px 28px rgba(0,0,0,0.24); }
      .glossary-chat-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: grab; user-select: none; }
      .glossary-chat-header.dragging { cursor: grabbing; }
      .glossary-chat-title { color: #f8fafc; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
      .glossary-chat-toggle { border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #cbd5e1; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease; }
      .glossary-chat-toggle:hover { background: rgba(91, 140, 255, 0.12); border-color: rgba(91, 140, 255, 0.28); color: #eef4ff; }
      .glossary-chat-messages { max-height: min(380px, 52vh); overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
      .glossary-chat-message { display: flex; }
      .glossary-chat-message.user { justify-content: flex-end; }
      .glossary-chat-message.assistant { justify-content: flex-start; }
      .glossary-chat-bubble { max-width: 92%; padding: 12px 14px; font-size: 12px; line-height: 1.65; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
      .glossary-chat-message.user .glossary-chat-bubble { background: rgba(91, 140, 255, 0.14); border: 1px solid rgba(91, 140, 255, 0.22); color: #dbe6ff; }
      .glossary-chat-message.assistant .glossary-chat-bubble { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); color: #cbd5e1; }
      .glossary-chat-message.assistant .glossary-chat-bubble.working { border-color: rgba(91, 140, 255, 0.22); background: rgba(91, 140, 255, 0.08); color: #dbe6ff; }
      .glossary-chat-working { display: inline-flex; align-items: center; gap: 10px; }
      .glossary-chat-working-spinner { width: 14px; height: 14px; border-radius: 999px; border: 2px solid rgba(91, 140, 255, 0.18); border-top-color: #7ea0ff; animation: glossary-spin 0.75s linear infinite; }
      .glossary-chat-working-dots { display: inline-flex; align-items: center; gap: 4px; }
      .glossary-chat-working-dots span { width: 5px; height: 5px; border-radius: 999px; background: #9bb6ff; opacity: 0.3; animation: glossary-dot-pulse 1.1s infinite ease-in-out; }
      .glossary-chat-working-dots span:nth-child(2) { animation-delay: 0.12s; }
      .glossary-chat-working-dots span:nth-child(3) { animation-delay: 0.24s; }
      .glossary-chat-candidate + .glossary-chat-candidate { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
      .glossary-chat-candidate-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
      .glossary-chat-candidate-title { color: #ffffff; font-size: 17px; font-weight: 800; }
      .glossary-chat-candidate-meaning { color: #d9e2f2; font-size: 13px; font-weight: 700; margin-bottom: 8px; }
      .glossary-chat-candidate-text { color: #9fb0c9; font-size: 12px; }
      .glossary-chat-actions { margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap; }
      .glossary-chat-action-btn { border: 1px solid rgba(91, 140, 255, 0.24); background: rgba(91, 140, 255, 0.08); color: #dbe6ff; padding: 10px 12px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
      .glossary-chat-input-row { border-top: 1px solid rgba(255,255,255,0.06); padding: 12px 16px 16px; }
      .glossary-chat-input-wrap { display: flex; gap: 10px; align-items: flex-end; }
      .glossary-chat-input { flex: 1; min-height: 42px; max-height: 132px; resize: none; overflow-y: auto; background: #0f131b; border: 1px solid rgba(255,255,255,0.08); color: #f8fafc; padding: 11px 14px; font-size: 12px; line-height: 1.5; outline: none; font-family: inherit; }
      .glossary-chat-send { border: 1px solid rgba(91, 140, 255, 0.24); background: rgba(91, 140, 255, 0.1); color: #e5edff; height: 42px; padding: 0 14px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; flex: 0 0 auto; }
      .glossary-chat-launcher { position: fixed; right: 28px; bottom: 24px; width: 58px; height: 58px; border-radius: 999px; border: 1px solid rgba(91, 140, 255, 0.38); background: radial-gradient(circle at 30% 30%, rgba(91, 140, 255, 0.18), rgba(15, 19, 27, 0.98)); color: #eef4ff; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 18px 42px rgba(0,0,0,0.42), 0 0 0 1px rgba(91, 140, 255, 0.12); z-index: 39; transition: opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease; cursor: grab; }
      .glossary-chat-launcher:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 22px 50px rgba(0,0,0,0.48), 0 0 0 1px rgba(91, 140, 255, 0.16); }
      .glossary-chat-launcher.hidden { opacity: 0; pointer-events: none; transform: translateY(10px) scale(0.9); }
      @keyframes glossary-spin { to { transform: rotate(360deg); } }
      @keyframes glossary-dot-pulse { 0%, 80%, 100% { opacity: 0.28; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
      @media (max-width: 900px) {
        .glossary-shell { padding: 20px; }
        .glossary-hero, .glossary-search-row, .glossary-results-header { flex-direction: column; align-items: stretch; }
        .glossary-meta { min-width: 0; }
        .glossary-chatbox { right: 12px; bottom: 12px; width: calc(100vw - 24px); }
        .glossary-chat-launcher { right: 12px; bottom: 12px; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  moduleRef.renderGlossaryView = function renderGlossaryView(opts) {
    ensureGlossaryStyles();
    const host = document.getElementById(opts.containerId);
    const industryKey = String(opts.industryKey || moduleRef.key || "TMT");
    if (!host) return;

    host.innerHTML = `
      <section class="glossary-shell">
        <div class="glossary-hero">
          <div>
            <div class="glossary-kicker">${escapeHtml(industryKey)} Glossary</div>
            <h1 class="glossary-title">Acronym Reference</h1>
            <div class="glossary-subtitle">The search box below only checks the saved glossary dataset. Use Agent G to ask naturally, refine the context, and save a likely new definition back into the dataset.</div>
          </div>
          <div class="glossary-meta">
            <div id="tmtGlossaryMetaValue" class="glossary-meta-value">0</div>
            <div class="glossary-meta-label">Searchable Terms</div>
          </div>
        </div>
        <div class="glossary-search-panel">
          <div class="glossary-search-row">
            <div class="glossary-search-box">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input id="tmtGlossarySearchInput" class="glossary-search-input" type="text" placeholder="Type an acronym, e.g. GPU, HBM, CSP, OSS/BSS">
            </div>
            <button id="tmtGlossaryClearBtn" class="glossary-clear-btn" type="button">Clear</button>
          </div>
          <div class="glossary-search-hint">Dataset search only. No automatic LLM lookup here.</div>
        </div>
        <div class="glossary-results-header">
          <div class="glossary-results-title">Database Results</div>
          <div id="tmtGlossaryResultsCount" class="glossary-results-count"></div>
        </div>
        <div id="tmtGlossaryResults" class="glossary-results-grid"></div>
        <button id="tmtGlossaryChatLauncher" class="glossary-chat-launcher hidden" type="button" aria-label="Open Agent G">
          <i class="fa-solid fa-comment-dots"></i>
        </button>
        <aside id="tmtGlossaryChatbox" class="glossary-chatbox">
          <div class="glossary-chat-header">
            <div>
              <div class="glossary-chat-title">Agent G</div>
            </div>
            <button id="tmtGlossaryChatToggle" class="glossary-chat-toggle" type="button" aria-label="Minimize Agent G">
              <i class="fa-solid fa-minus"></i>
            </button>
          </div>
          <div id="tmtGlossaryChatMessages" class="glossary-chat-messages"></div>
          <div class="glossary-chat-input-row">
            <div class="glossary-chat-input-wrap">
              <textarea id="tmtGlossaryChatInput" class="glossary-chat-input" rows="1" placeholder='Ask "what does INP mean?" or "search again but in telecom context"'></textarea>
              <button id="tmtGlossaryChatSend" class="glossary-chat-send" type="button">Send</button>
            </div>
          </div>
        </aside>
      </section>
    `;

    const inputEl = document.getElementById("tmtGlossarySearchInput");
    const clearBtn = document.getElementById("tmtGlossaryClearBtn");
    const resultsEl = document.getElementById("tmtGlossaryResults");
    const countEl = document.getElementById("tmtGlossaryResultsCount");
    const metaValueEl = document.getElementById("tmtGlossaryMetaValue");
    const chatboxEl = document.getElementById("tmtGlossaryChatbox");
    const chatLauncherEl = document.getElementById("tmtGlossaryChatLauncher");
    const chatMessagesEl = document.getElementById("tmtGlossaryChatMessages");
    const chatInputEl = document.getElementById("tmtGlossaryChatInput");
    const chatSendEl = document.getElementById("tmtGlossaryChatSend");
    const chatToggleEl = document.getElementById("tmtGlossaryChatToggle");
    const chatHeaderEl = chatboxEl.querySelector(".glossary-chat-header");

    function setChatOpen(open) {
      state.chatOpen = !!open;
      clampChatPosition();
      chatboxEl.classList.toggle("collapsed", !state.chatOpen);
      chatLauncherEl.classList.toggle("hidden", state.chatOpen);
      chatToggleEl.innerHTML = state.chatOpen
        ? '<i class="fa-solid fa-minus"></i>'
        : '<i class="fa-solid fa-up-right-and-down-left-from-center"></i>';
      if (!state.chatOpen) {
        chatHeaderEl.classList.remove("dragging");
      }
    }

    function getChatPosition() {
      const left = Number.parseFloat(chatboxEl.style.left);
      const top = Number.parseFloat(chatboxEl.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        return { left, top };
      }

      const width = chatboxEl.offsetWidth || 420;
      const height = chatboxEl.offsetHeight || 520;
      return {
        left: Math.max(CHAT_VIEWPORT_PADDING, window.innerWidth - width - CHAT_DEFAULT_RIGHT),
        top: Math.max(CHAT_VIEWPORT_PADDING, window.innerHeight - height - CHAT_DEFAULT_BOTTOM)
      };
    }

    function applyChatPosition(left, top) {
      chatboxEl.style.left = `${left}px`;
      chatboxEl.style.top = `${top}px`;
      chatboxEl.style.right = "auto";
      chatboxEl.style.bottom = "auto";

      const launcherLeft = left + chatboxEl.offsetWidth - chatLauncherEl.offsetWidth;
      const launcherTop = top + chatboxEl.offsetHeight - chatLauncherEl.offsetHeight;
      chatLauncherEl.style.left = `${launcherLeft}px`;
      chatLauncherEl.style.top = `${launcherTop}px`;
      chatLauncherEl.style.right = "auto";
      chatLauncherEl.style.bottom = "auto";
    }

    function clampChatPosition() {
      const width = chatboxEl.offsetWidth || 420;
      const height = chatboxEl.offsetHeight || 520;
      const position = getChatPosition();
      const maxLeft = Math.max(CHAT_VIEWPORT_PADDING, window.innerWidth - width - CHAT_VIEWPORT_PADDING);
      const maxTop = Math.max(CHAT_VIEWPORT_PADDING, window.innerHeight - height - CHAT_VIEWPORT_PADDING);
      const clampedLeft = Math.max(CHAT_VIEWPORT_PADDING, Math.min(maxLeft, position.left));
      const clampedTop = Math.max(CHAT_VIEWPORT_PADDING, Math.min(maxTop, position.top));
      applyChatPosition(clampedLeft, clampedTop);
    }
    window.__tmtGlossaryClampChatPosition = clampChatPosition;

    function resizeChatInput() {
      chatInputEl.style.height = "auto";
      const nextHeight = Math.max(42, Math.min(chatInputEl.scrollHeight, 132));
      chatInputEl.style.height = `${nextHeight}px`;
      requestAnimationFrame(clampChatPosition);
    }

    function initializeChatPosition() {
      const width = chatboxEl.offsetWidth || 420;
      const height = chatboxEl.offsetHeight || 520;
      const left = Math.max(CHAT_VIEWPORT_PADDING, window.innerWidth - width - CHAT_DEFAULT_RIGHT);
      const top = Math.max(CHAT_VIEWPORT_PADDING, window.innerHeight - height - CHAT_DEFAULT_BOTTOM);
      applyChatPosition(left, top);
    }

    function beginDrag(event, source = "box") {
      if (source === "box" && event.target.closest("button")) return;
      event.preventDefault();
      clampChatPosition();
      const position = getChatPosition();

      state.chatDrag.pointerId = "mouse";
      state.chatDrag.source = source;
      state.chatDrag.startX = event.clientX;
      state.chatDrag.startY = event.clientY;
      state.chatDrag.originLeft = position.left;
      state.chatDrag.originTop = position.top;
      state.chatDrag.didMove = false;
      chatHeaderEl.classList.add("dragging");
      document.addEventListener("mousemove", handleDragMove);
      document.addEventListener("mouseup", endDrag);
    }

    function handleDragMove(event) {
      if (!state.chatDrag.pointerId) return;
      if (Math.abs(event.clientX - state.chatDrag.startX) > 2 || Math.abs(event.clientY - state.chatDrag.startY) > 2) {
        state.chatDrag.didMove = true;
      }
      const maxLeft = Math.max(CHAT_VIEWPORT_PADDING, window.innerWidth - chatboxEl.offsetWidth - CHAT_VIEWPORT_PADDING);
      const maxTop = Math.max(CHAT_VIEWPORT_PADDING, window.innerHeight - chatboxEl.offsetHeight - CHAT_VIEWPORT_PADDING);
      const nextLeft = Math.max(CHAT_VIEWPORT_PADDING, Math.min(maxLeft, state.chatDrag.originLeft + (event.clientX - state.chatDrag.startX)));
      const nextTop = Math.max(CHAT_VIEWPORT_PADDING, Math.min(maxTop, state.chatDrag.originTop + (event.clientY - state.chatDrag.startY)));
      applyChatPosition(nextLeft, nextTop);
    }

    function endDrag() {
      if (state.chatDrag.didMove) {
      state.chatDrag.skipLauncherClick = true;
      }
      state.chatDrag.pointerId = null;
      state.chatDrag.source = "";
      state.chatDrag.didMove = false;
      chatHeaderEl.classList.remove("dragging");
      document.removeEventListener("mousemove", handleDragMove);
      document.removeEventListener("mouseup", endDrag);
    }

    async function handleChatQuery() {
      const rawMessage = String(chatInputEl.value || "").trim();
      if (!rawMessage || state.chatBusy) return;

      pushChatMessage("user", escapeHtml(rawMessage));
      renderChatMessages(chatMessagesEl);
      chatInputEl.value = "";
      resizeChatInput();
      state.chatBusy = true;
      state.saveStatus = "";

      if (isSaveConfirmationMessage(rawMessage) && (state.chatPendingEntry || state.lastLookupTerm)) {
        let entry = state.chatPendingEntry;
        if (!entry && state.lastLookupTerm) {
          entry = await buildPendingGlossaryEntry(industryKey, state.lastLookupTerm, state.lastResolvedAssistantResponse);
          state.chatPendingEntry = entry;
        }

        if (!entry) {
          pushChatMessage("assistant", "There is no pending definition to save right now.");
        } else {
          try {
            const result = await saveGlossaryEntry(industryKey, entry);
            pushChatMessage("assistant", result.saved ? `Saved <strong>${escapeHtml(entry.acronym)}</strong> into the ${escapeHtml(industryKey)} glossary.` : escapeHtml(result.reason || "No changes written."));
            if (result.saved) state.chatPendingEntry = null;
          } catch (err) {
            pushChatMessage("assistant", `Save failed.<br>${escapeHtml(String(err && err.message ? err.message : err))}`);
          }
        }

        renderChatMessages(chatMessagesEl);
        state.chatBusy = false;
        void renderResults();
        return;
      }

      pushWorkingMessage();
      renderChatMessages(chatMessagesEl);
      try {
        const priorPendingEntry = state.chatPendingEntry;
        const priorLookupTerm = state.lastLookupTerm;
        const response = await fetchAgentGResponse(rawMessage, industryKey);

        if (!response.ok) {
          removeWorkingMessage();
          const target = state.lastLookupTerm ? ` <strong>${escapeHtml(state.lastLookupTerm)}</strong>` : "";
          pushChatMessage("assistant", `Agent G could not resolve${target}.<br>${escapeHtml(response.error || "Unknown error.")}`);
        } else {
          removeWorkingMessage();
            if (response.action === "save_pending") {
            let entry = state.chatPendingEntry;
            if (!entry && state.lastLookupTerm) {
              entry = await buildPendingGlossaryEntry(industryKey, state.lastLookupTerm, state.lastResolvedAssistantResponse);
              state.chatPendingEntry = entry;
            }
            if (!entry) {
              pushChatMessage("assistant", response.assistantResponse || "There is no pending definition to save right now.");
            } else {
              try {
                const result = await saveGlossaryEntry(industryKey, entry);
                pushChatMessage("assistant", result.saved ? `Saved <strong>${escapeHtml(entry.acronym)}</strong> into the ${escapeHtml(industryKey)} glossary.` : escapeHtml(result.reason || "No changes written."));
                state.chatPendingEntry = null;
              } catch (err) {
                pushChatMessage("assistant", `Save failed.<br>${escapeHtml(String(err && err.message ? err.message : err))}`);
              }
              void renderResults();
            }
          } else {
            const nextLookupTerm = response.lookupTermUsed || priorLookupTerm || response.suggestedLookupTerm || "";
            if (nextLookupTerm) state.lastLookupTerm = nextLookupTerm;
            state.lastResolvedAssistantResponse = String(response.assistantResponse || "").trim();
            state.lastWebResults = Array.isArray(response.webResultsUsed) ? response.webResultsUsed : [];
            if (response.candidateEntry) {
              state.chatPendingEntry = response.candidateEntry;
            } else {
              const asksToSave = /would you like me to save|want me to save|save (?:this|that) (?:definition|to the glossary)/i.test(String(response.assistantResponse || ""));
              if (asksToSave && nextLookupTerm) {
                state.chatPendingEntry = await buildPendingGlossaryEntry(industryKey, nextLookupTerm, response.assistantResponse);
              }
              if (!state.chatPendingEntry) {
              const changedTerm = priorLookupTerm
                && nextLookupTerm
                && normalizeSearch(priorLookupTerm) !== normalizeSearch(nextLookupTerm);
                state.chatPendingEntry = changedTerm ? null : priorPendingEntry;
              }
            }
            pushChatMessage("assistant", `${escapeHtml(response.assistantResponse || "")}${response.candidateEntry ? formatCandidateHtml(response.candidateEntry, 0, "Candidate") : ""}${response.offerSave ? '<div class="glossary-chat-actions"><button class="glossary-chat-action-btn" type="button" data-chat-save-pending="1">Save This Definition</button></div>' : ''}`);
          }
        }
      } catch (err) {
        removeWorkingMessage();
        const target = state.lastLookupTerm ? ` <strong>${escapeHtml(state.lastLookupTerm)}</strong>` : "";
        pushChatMessage("assistant", `Agent G could not resolve${target}.<br>${escapeHtml(String(err && err.message ? err.message : err))}`);
      }

      renderChatMessages(chatMessagesEl);
      chatMessagesEl.querySelectorAll("[data-chat-save-pending]").forEach((buttonEl) => {
        buttonEl.addEventListener("click", async () => {
          const entry = state.chatPendingEntry;
          if (!entry) return;
          buttonEl.disabled = true;
          try {
            const result = await saveGlossaryEntry(industryKey, entry);
            pushChatMessage("assistant", result.saved ? `Saved <strong>${escapeHtml(entry.acronym)}</strong> into the ${escapeHtml(industryKey)} glossary.` : escapeHtml(result.reason || "No changes written."));
            state.chatPendingEntry = null;
          } catch (err) {
            pushChatMessage("assistant", `Save failed.<br>${escapeHtml(String(err && err.message ? err.message : err))}`);
          }
          renderChatMessages(chatMessagesEl);
          void renderResults();
        });
      });

      state.chatBusy = false;
    }

    async function renderResults() {
      const { groupedAll, exact, partial } = findGlossaryMatches(industryKey, inputEl.value);
      metaValueEl.textContent = String(groupedAll.length);

      const query = normalizeSearch(inputEl.value);
      const ordered = query ? [...exact, ...partial] : groupedAll.slice(0, 24);

      countEl.textContent = query
        ? `${ordered.length} ${ordered.length === 1 ? "match" : "matches"} in database`
        : `Showing ${ordered.length} of ${groupedAll.length}`;

      if (!ordered.length) {
        resultsEl.innerHTML = query
          ? `<div class="glossary-empty">No dataset match for <strong>${escapeHtml(inputEl.value)}</strong>. Use Agent G to ask for the most likely meaning and save it into the database.</div>`
          : "";
      } else {
        resultsEl.innerHTML = ordered.map((entry) => {
          const label = entry.explanations.length > 1 ? `${entry.explanations.length} contexts` : "1 context";
          return `
            <article class="glossary-card">
              <div class="glossary-card-top">
                <div class="glossary-acronym">${escapeHtml(entry.acronym)}</div>
                <div class="glossary-badge">${escapeHtml(label)}</div>
              </div>
              <div class="glossary-meaning">${escapeHtml(entry.meaning)}</div>
              <div class="glossary-explanation-list">
                ${entry.explanations.map((text) => `<div class="glossary-explanation">${escapeHtml(text)}</div>`).join("")}
              </div>
            </article>
          `;
        }).join("");
      }
    }

    inputEl.addEventListener("input", () => {
      state.requestToken += 1;
      state.saveStatus = "";
      void renderResults();
    });
    clearBtn.addEventListener("click", () => {
      inputEl.value = "";
      state.requestToken += 1;
      state.saveStatus = "";
      void renderResults();
      inputEl.focus();
    });
    chatHeaderEl.addEventListener("mousedown", (event) => beginDrag(event, "box"));
    chatToggleEl.addEventListener("click", () => setChatOpen(false));
    chatLauncherEl.addEventListener("mousedown", (event) => beginDrag(event, "launcher"));
    chatLauncherEl.addEventListener("click", () => {
      if (state.chatDrag.skipLauncherClick) {
        state.chatDrag.skipLauncherClick = false;
        return;
      }
      setChatOpen(true);
    });
    window.addEventListener("resize", clampChatPosition);
    chatSendEl.addEventListener("click", () => void handleChatQuery());
    chatInputEl.addEventListener("input", resizeChatInput);
    chatInputEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      void handleChatQuery();
    });

    initializeChatPosition();
    resizeChatInput();
    pushChatMessage("assistant", "I’m Agent G. Ask me what an acronym means, or refine the context naturally. I check the saved glossary first, then search the web only when needed. If I find a likely new definition, I’ll ask whether you want me to save it.");
    renderChatMessages(chatMessagesEl);
    setChatOpen(false);

    void renderResults();
  };
})();
