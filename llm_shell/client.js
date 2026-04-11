(function () {
  const shell = window.LLMShell = window.LLMShell || {};

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
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
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

  function buildUrl(base, path) {
    const trimmedBase = String(base || "").replace(/\/+$/, "");
    const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
    if (/\/v\d+$/.test(trimmedBase) && normalizedPath.startsWith("/v")) {
      return `${trimmedBase}${normalizedPath.replace(/^\/v\d+/, "")}`;
    }
    return `${trimmedBase}${normalizedPath}`;
  }

  function buildAttempt(style, base, path, cfg, systemPrompt, userPrompt) {
    if (style === "anthropic-messages") {
      return {
        url: buildUrl(base, path || "/v1/messages"),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiToken,
          "anthropic-version": cfg.anthropicVersion || "2023-06-01"
        },
        body: {
          model: cfg.model,
          max_tokens: cfg.maxTokens || 600,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        }
      };
    }

    if (style === "openai-responses") {
      return {
        url: buildUrl(base, path || "/v1/responses"),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiToken}`
        },
        body: {
          model: cfg.model,
          temperature: cfg.temperature ?? 0.2,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        }
      };
    }

    return {
      url: buildUrl(base, path || "/v1/chat/completions"),
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
    };
  }

  async function executeAttempt(attempt) {
    const response = await fetch(attempt.url, {
      method: "POST",
      headers: attempt.headers,
      body: JSON.stringify(attempt.body)
    });
    const raw = await response.text();
    if (raw.toLowerCase().includes("<html")) {
      return {
        ok: false,
        error: `Gateway returned HTML instead of API JSON at ${attempt.url}`
      };
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = { error: { message: raw } };
    }
    const reply = extractDirectText(data);
    if (response.ok && reply) return { ok: true, reply };
    return { ok: false, error: `${reply || `HTTP ${response.status}`} at ${attempt.url}` };
  }

  async function requestText(systemPrompt, userPrompt, overrideConfig = {}) {
    const cfg = { ...(window.LLM_DIRECT_CONFIG || {}), ...(overrideConfig || {}) };
    if (!cfg.baseUrl || !cfg.apiToken || !cfg.model) {
      return {
        ok: false,
        error: "LLM_DIRECT_CONFIG is incomplete. Set baseUrl, apiToken, and model in llm_shell/config.js."
      };
    }

    const base = String(cfg.baseUrl).replace(/\/+$/, "");
    const attempts = [];
    if (cfg.apiStyle || cfg.apiPath) {
      attempts.push(buildAttempt(cfg.apiStyle || "openai-chat", base, cfg.apiPath, cfg, systemPrompt, userPrompt));
    }
    attempts.push(buildAttempt("openai-chat", base, "/v1/chat/completions", cfg, systemPrompt, userPrompt));
    attempts.push(buildAttempt("openai-chat", base, "/chat/completions", cfg, systemPrompt, userPrompt));
    attempts.push(buildAttempt("openai-responses", base, "/v1/responses", cfg, systemPrompt, userPrompt));
    attempts.push(buildAttempt("anthropic-messages", base, "/v1/messages", cfg, systemPrompt, userPrompt));

    let lastError = "Direct request failed.";
    const attemptErrors = [];
    for (const attempt of attempts) {
      try {
        const result = await executeAttempt(attempt);
        if (result.ok) return result;
        lastError = result.error || `Request failed at ${attempt.url}`;
        attemptErrors.push(lastError);
      } catch (err) {
        lastError = `${String(err?.message || err)} at ${attempt.url}`;
        attemptErrors.push(lastError);
      }
    }

    return { ok: false, error: attemptErrors.join(" | ") || lastError };
  }

  shell.extractDirectText = extractDirectText;
  shell.extractJsonObjectFromText = extractJsonObjectFromText;
  shell.requestText = requestText;
})();
