(function () {
  window.LLM_DIRECT_CONFIG = window.LLM_DIRECT_CONFIG || {
    baseUrl: "https://api.kunkunout.cn",
    apiToken: "sk-Xl1UQsRFi8DaHllUxnfs20PgnnFqzrKPBTJhg1HIDFz0j2S8",
    model: "claude-sonnet-4-6",
    maxTokens: 600,
    temperature: 0.2
  };

  function extractDirectText(data) {
    if (!data || typeof data !== "object") return "";
    if (Array.isArray(data.content)) {
      const text = data.content
        .filter((item) => item && item.type === "text")
        .map((item) => String(item.text || ""))
        .join("\n")
        .trim();
      if (text) return text;
    }
    if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
      return String(data.choices[0].message.content).trim();
    }
    if (data.error?.message) {
      return String(data.error.message).trim();
    }
    return "";
  }

  function extractJsonObjectFromText(text) {
    const raw = String(text || "").trim();
    let cleaned = raw;
    if (cleaned.toLowerCase().startsWith("```json")) cleaned = cleaned.slice(7).trim();
    else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3).trim();
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3).trim();

    if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
      try { return JSON.parse(cleaned); } catch (_) {}
    }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
    }
    return null;
  }

  async function requestDirectLLM(systemPrompt, userPrompt) {
    const cfg = window.LLM_DIRECT_CONFIG || {};
    if (!cfg.baseUrl || !cfg.apiToken || !cfg.model) {
      return {
        ok: false,
        error: "LLM_DIRECT_CONFIG is incomplete. Set baseUrl, apiToken, and model in llm-config.js."
      };
    }

    const base = String(cfg.baseUrl).replace(/\/+$/, "");
    const attempts = [
      {
        url: `${base}/v1/messages`,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiToken,
          "anthropic-version": "2023-06-01"
        },
        body: {
          model: cfg.model,
          max_tokens: cfg.maxTokens || 600,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        }
      },
      {
        url: `${base}/v1/chat/completions`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiToken}`
        },
        body: {
          model: cfg.model,
          temperature: cfg.temperature ?? 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        }
      },
      {
        url: `${base}/chat/completions`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiToken}`
        },
        body: {
          model: cfg.model,
          temperature: cfg.temperature ?? 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        }
      }
    ];

    let lastError = "Direct request failed.";
    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, {
          method: "POST",
          headers: attempt.headers,
          body: JSON.stringify(attempt.body)
        });
        const raw = await response.text();
        if (raw.toLowerCase().includes("<html")) {
          lastError = "Gateway returned HTML instead of JSON.";
          continue;
        }
        let data;
        try { data = JSON.parse(raw); } catch (_) { data = { error: { message: raw } }; }
        const reply = extractDirectText(data);
        if (response.ok && reply) return { ok: true, reply };
        lastError = reply || `HTTP ${response.status}`;
      } catch (err) {
        lastError = String(err?.message || err);
      }
    }
    return { ok: false, error: lastError };
  }

  window.lookupGlossaryEntryWithLLM = async function lookupGlossaryEntryWithLLM(payload) {
    const acronym = String(payload?.acronym || "").trim().toUpperCase();
    const industryKey = String(payload?.industryKey || "Industry").trim();
    const industryLabel = String(payload?.industryLabel || industryKey).trim();
    const industryContext = String(payload?.industryContext || "").trim();
    const sidebarTitle = String(payload?.sidebarTitle || "").trim();

    const systemParts = [
      "You generate glossary entries for a professional industry dashboard.",
      `The active industry context is ${industryLabel}.`,
      `Industry key: ${industryKey}.`,
      sidebarTitle ? `Industry title: ${sidebarTitle}.` : "",
      industryContext ? `Interpret acronyms within this context: ${industryContext}` : "",
      "Return exactly one JSON object with keys: acronym, meaning, practicalExplanation.",
      "Keep the format aligned with a glossary database.",
      "If the acronym is ambiguous, choose the most relevant meaning for the active industry and mention the ambiguity briefly in practicalExplanation.",
      "Do not include markdown, commentary, or code fences."
    ].filter(Boolean);

    const userPrompt = [
      `Industry key: ${industryKey}`,
      `Industry label: ${industryLabel}`,
      `Acronym to explain: ${acronym}`,
      "Return JSON only."
    ].join("\n");

    const result = await requestDirectLLM(systemParts.join(" "), userPrompt);
    if (!result.ok) return result;

    const parsed = extractJsonObjectFromText(result.reply);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "LLM response was not valid JSON." };
    }

    const entry = {
      acronym: String(parsed.acronym || acronym).trim(),
      meaning: String(parsed.meaning || "").trim(),
      practicalExplanation: String(parsed.practicalExplanation || "").trim()
    };
    if (!entry.acronym || !entry.meaning || !entry.practicalExplanation) {
      return { ok: false, error: "LLM returned an incomplete glossary entry." };
    }
    return { ok: true, entry };
  };
})();
