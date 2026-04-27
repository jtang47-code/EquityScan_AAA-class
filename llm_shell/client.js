(function () {
  const shell = window.LLMShell = window.LLMShell || {};

  function extractDirectText(data) {
    if (!data || typeof data !== "object") return "";
    if (typeof data.reply === "string" && data.reply.trim()) {
      return data.reply.trim();
    }
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

  function getBackendBaseUrl() {
    const appBase = String(window.APP_CONFIG?.getApiBaseUrl?.() || window.APP_CONFIG?.apiBaseUrl || "").trim();
    if (appBase) return appBase.replace(/\/+$/, "");
    if (window.location.protocol === "file:") return "http://localhost:8000";
    return "";
  }

  async function requestText(systemPrompt, userPrompt, overrideConfig = {}) {
    const base = getBackendBaseUrl();
    if (!base) {
      return {
        ok: false,
        error: "APP_CONFIG.apiBaseUrl is missing. Set the backend URL in app-config.js."
      };
    }

    let response;
    try {
      response = await fetch(`${base}/api/llm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: String(systemPrompt || ""),
          userPrompt: String(userPrompt || ""),
          overrideConfig: overrideConfig && typeof overrideConfig === "object" ? overrideConfig : {}
        })
      });
    } catch (err) {
      return {
        ok: false,
        error: `${String(err?.message || err)} while calling ${base}/api/llm`
      };
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      data = {};
    }

    const reply = extractDirectText(data);
    if (response.ok && reply) {
      return { ok: true, reply };
    }

    const errorText = String(data?.detail || data?.error || reply || `HTTP ${response.status}`).trim();
    return {
      ok: false,
      error: `${errorText} while calling ${base}/api/llm`
    };
  }

  shell.extractDirectText = extractDirectText;
  shell.extractJsonObjectFromText = extractJsonObjectFromText;
  shell.requestText = requestText;
})();
