window.APP_CONFIG = window.APP_CONFIG || {
  // Paste the current Cloudflare backend URL here when it changes.
  // Example: "https://abc-def-ghi.trycloudflare.com"
  apiBaseUrl: ""
};

(function () {
  const STORAGE_KEY = "equityscan.apiBaseUrl";
  const config = window.APP_CONFIG = window.APP_CONFIG || {};
  const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

  function readStoredBaseUrl() {
    try {
      return normalizeBaseUrl(window.localStorage.getItem(STORAGE_KEY) || "");
    } catch (_) {
      return "";
    }
  }

  function writeStoredBaseUrl(value) {
    try {
      if (value) window.localStorage.setItem(STORAGE_KEY, value);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  const params = new URLSearchParams(window.location.search);
  const queryBaseUrl = normalizeBaseUrl(params.get("apiBaseUrl") || params.get("backend"));
  const fileBaseUrl = normalizeBaseUrl(config.apiBaseUrl || "");
  const storedBaseUrl = readStoredBaseUrl();

  config.storageKey = STORAGE_KEY;
  config.defaultApiBaseUrl = fileBaseUrl;
  config.getApiBaseUrl = function getApiBaseUrl() {
    const currentStored = readStoredBaseUrl();
    const configured = normalizeBaseUrl(currentStored || config.apiBaseUrl || config.defaultApiBaseUrl);
    if (configured) return configured;
    return window.location.protocol === "file:" ? "http://localhost:8000" : "";
  };
  config.setApiBaseUrl = function setApiBaseUrl(value) {
    const normalized = normalizeBaseUrl(value);
    config.apiBaseUrl = normalized;
    writeStoredBaseUrl(normalized);
    return normalized;
  };
  config.clearApiBaseUrlOverride = function clearApiBaseUrlOverride() {
    writeStoredBaseUrl("");
    config.apiBaseUrl = config.defaultApiBaseUrl;
    return config.getApiBaseUrl();
  };

  if (queryBaseUrl) config.setApiBaseUrl(queryBaseUrl);
  else if (storedBaseUrl) config.apiBaseUrl = storedBaseUrl;
  else config.apiBaseUrl = fileBaseUrl;
})();
