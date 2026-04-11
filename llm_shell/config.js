(function () {
  const appConfig = window.APP_CONFIG || {};
  const appLlmConfig = appConfig.llmDirectConfig || {};
  let storedApiToken = "";

  try {
    storedApiToken = window.localStorage.getItem("equityscan.llmApiToken") || "";
  } catch (_) {
    storedApiToken = "";
  }

  window.LLM_DIRECT_CONFIG = window.LLM_DIRECT_CONFIG || {
    baseUrl: appLlmConfig.baseUrl || "https://api.deepseek.com",
    apiToken: appLlmConfig.apiToken || storedApiToken || "",
    model: appLlmConfig.model || "deepseek-chat",
    apiStyle: appLlmConfig.apiStyle || "openai-chat",
    apiPath: appLlmConfig.apiPath || "/chat/completions",
    maxTokens: Number(appLlmConfig.maxTokens || 600),
    temperature: Number(appLlmConfig.temperature ?? 0.2)
  };
})();
