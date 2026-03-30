(function () {
  window.IndustryModules = window.IndustryModules || {};
  const moduleRef = window.IndustryModules.TMT || { key: "TMT", label: "TMT" };
  window.IndustryModules.TMT = moduleRef;

  const state = {
    requestToken: 0,
    llmCache: new Map(),
    fileHandles: new Map(),
    saveStatus: ""
  };

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

  function buildDataFileContent(industryKey, entries) {
    const cfg = getGlossaryConfig(industryKey);
    const lines = entries.map((entry) => {
      return `  { acronym: ${JSON.stringify(entry.acronym)}, meaning: ${JSON.stringify(entry.meaning)}, practicalExplanation: ${JSON.stringify(entry.practicalExplanation)} },`;
    });
    return `window.${cfg.dataVarName} = [\n${lines.join("\n")}\n];\n`;
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

  async function fetchLLMGlossaryEntry(query, industryKey) {
    const key = `${industryKey}::${normalizeSearch(query)}`;
    if (state.llmCache.has(key)) return state.llmCache.get(key);

    const industryContext = getIndustryPromptContext(industryKey);
    let response;
    try {
      if (typeof window.lookupGlossaryEntryWithLLM !== "function") {
        throw new Error("llm-config.js is missing or does not expose lookupGlossaryEntryWithLLM().");
      }
      response = await window.lookupGlossaryEntryWithLLM({
        acronym: query,
        industryKey,
        industryLabel: industryContext.label,
        industryContext: industryContext.glossaryContext,
        sidebarTitle: industryContext.sidebarTitle
      });
    } catch (err) {
      response = { ok: false, error: String(err && err.message ? err.message : err) };
    }

    if (!response.ok) {
      const failure = { ok: false, error: response.error || "LLM glossary lookup failed." };
      state.llmCache.set(key, failure);
      return failure;
    }

    const result = {
      acronym: String(response.entry?.acronym || query).trim(),
      meaning: String(response.entry?.meaning || "").trim(),
      practicalExplanation: String(response.entry?.practicalExplanation || "").trim()
    };
    if (!result.acronym || !result.meaning || !result.practicalExplanation) {
      const failure = { ok: false, error: "LLM returned an incomplete glossary entry." };
      state.llmCache.set(key, failure);
      return failure;
    }

    const success = { ok: true, entry: result };
    state.llmCache.set(key, success);
    return success;
  }

  async function saveGlossaryEntry(industryKey, entry) {
    if (!window.showOpenFilePicker) {
      throw new Error("This browser does not support direct file saving. Use Chromium on localhost.");
    }
    const cfg = getGlossaryConfig(industryKey);
    let handle = state.fileHandles.get(industryKey);
    if (!handle) {
      const handles = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
        excludeAcceptAllOption: false
      });
      handle = handles && handles[0];
      if (!handle) throw new Error(`Select ${cfg.fileName} to save the new glossary entry.`);
      state.fileHandles.set(industryKey, handle);
    }

    const currentEntries = getGlossaryEntries(industryKey);
    const exists = currentEntries.some((item) => {
      return normalizeSearch(item.acronym) === normalizeSearch(entry.acronym)
        && String(item.meaning).trim() === String(entry.meaning).trim()
        && String(item.practicalExplanation).trim() === String(entry.practicalExplanation).trim();
    });
    if (exists) return { saved: false, reason: "Entry already exists in the glossary database." };

    const updatedEntries = [...currentEntries, entry].sort((a, b) => a.acronym.localeCompare(b.acronym));
    const writable = await handle.createWritable();
    await writable.write(buildDataFileContent(industryKey, updatedEntries));
    await writable.close();
    setGlossaryEntries(industryKey, updatedEntries);
    return { saved: true };
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
      .glossary-llm-panel { border: 1px solid rgba(91, 140, 255, 0.18); background: linear-gradient(180deg, rgba(91, 140, 255, 0.08), rgba(91, 140, 255, 0.03)); padding: 16px; margin-bottom: 20px; }
      .glossary-llm-status { color: #94a3b8; font-size: 11px; margin-top: 10px; }
      @media (max-width: 900px) {
        .glossary-shell { padding: 20px; }
        .glossary-hero, .glossary-search-row, .glossary-results-header { flex-direction: column; align-items: stretch; }
        .glossary-meta { min-width: 0; }
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
            <div class="glossary-subtitle">Search the local glossary first. If an acronym is missing, the page will call the browser-side LLM config in llm-config.js and use the active industry context before showing a draft entry.</div>
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
          <div class="glossary-search-hint">Missing acronym -> automatic LLM draft. Save will prompt you once to choose the corresponding glossary data file, then overwrite that file with the updated database.</div>
        </div>
        <div id="tmtGlossaryLlmPanel"></div>
        <div class="glossary-results-header">
          <div class="glossary-results-title">Database Results</div>
          <div id="tmtGlossaryResultsCount" class="glossary-results-count"></div>
        </div>
        <div id="tmtGlossaryResults" class="glossary-results-grid"></div>
      </section>
    `;

    const inputEl = document.getElementById("tmtGlossarySearchInput");
    const clearBtn = document.getElementById("tmtGlossaryClearBtn");
    const resultsEl = document.getElementById("tmtGlossaryResults");
    const countEl = document.getElementById("tmtGlossaryResultsCount");
    const metaValueEl = document.getElementById("tmtGlossaryMetaValue");
    const llmPanelEl = document.getElementById("tmtGlossaryLlmPanel");

    async function renderResults() {
      const glossaryEntries = getGlossaryEntries(industryKey);
      const groupedAll = groupEntries(glossaryEntries).sort((a, b) => a.acronym.localeCompare(b.acronym));
      metaValueEl.textContent = String(groupedAll.length);

      const query = normalizeSearch(inputEl.value);
      const filtered = groupedAll.filter((entry) => {
        if (!query) return true;
        const haystack = `${entry.acronym} ${entry.meaning} ${entry.explanations.join(" ")}`.toUpperCase();
        return haystack.includes(query);
      });
      const exactMatches = filtered.filter((entry) => normalizeSearch(entry.acronym) === query);
      const partialMatches = filtered.filter((entry) => normalizeSearch(entry.acronym) !== query);
      const ordered = query ? [...exactMatches, ...partialMatches] : filtered.slice(0, 24);

      countEl.textContent = query
        ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"} in database`
        : `Showing ${ordered.length} of ${groupedAll.length}`;

      if (!ordered.length) {
        resultsEl.innerHTML = query
          ? `<div class="glossary-empty">No database match for <strong>${escapeHtml(inputEl.value)}</strong>.</div>`
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

      llmPanelEl.innerHTML = "";
      if (!query || exactMatches.length || partialMatches.length) return;

      const cacheKey = `${industryKey}::${query}`;
      const cached = state.llmCache.get(cacheKey);
      if (!cached) {
        llmPanelEl.innerHTML = `<div class="glossary-loading">Consulting the configured LLM for <strong>${escapeHtml(inputEl.value)}</strong>...</div>`;
        const token = ++state.requestToken;
        const result = await fetchLLMGlossaryEntry(query, industryKey);
        if (token !== state.requestToken) return;
        void result;
        await renderResults();
        return;
      }

      if (!cached.ok) {
          llmPanelEl.innerHTML = `<div class="glossary-error">LLM lookup failed for <strong>${escapeHtml(inputEl.value)}</strong>.<br>${escapeHtml(cached.error || "Unknown error.")}</div>`;
        return;
      }

      const entry = cached.entry;
      llmPanelEl.innerHTML = `
        <article class="glossary-llm-panel">
          <div class="glossary-card-top">
            <div class="glossary-acronym">${escapeHtml(entry.acronym)}</div>
            <div class="glossary-badge">LLM Draft</div>
          </div>
          <div class="glossary-meaning">${escapeHtml(entry.meaning)}</div>
          <div class="glossary-explanation-list">
            <div class="glossary-explanation">${escapeHtml(entry.practicalExplanation)}</div>
          </div>
          <div class="glossary-search-row" style="margin-top:14px;">
            <button id="tmtGlossarySaveBtn" class="glossary-save-btn" type="button">Save To ${escapeHtml(industryKey)} Glossary</button>
            <div id="tmtGlossarySaveStatus" class="glossary-llm-status">${escapeHtml(state.saveStatus)}</div>
          </div>
        </article>
      `;

      const saveBtn = document.getElementById("tmtGlossarySaveBtn");
      const saveStatusEl = document.getElementById("tmtGlossarySaveStatus");
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        saveStatusEl.textContent = "Saving...";
        try {
          const result = await saveGlossaryEntry(industryKey, entry);
          state.saveStatus = result.saved ? "Saved to glossary data file." : (result.reason || "No changes written.");
        } catch (err) {
          state.saveStatus = String(err && err.message ? err.message : err);
        }
        saveBtn.disabled = false;
        await renderResults();
      });
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

    void renderResults();
  };
})();
