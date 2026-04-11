window.APP_CONFIG = window.APP_CONFIG || {
  // Public backend URL exposed through Cloudflare Tunnel. Update everytime restart Cloudflare
  // Example: "https://api.yourdomain.com"
  apiBaseUrl: "https://dover-engineering-considered-procurement.trycloudflare.com",



  // Optional browser-direct LLM config.
  // Do not put private API keys here if this site is hosted publicly on GitHub Pages.
  llmDirectConfig: {
    baseUrl: "https://api.deepseek.com",
    apiToken: "sk-6245d4a4a89b4bae9db311fd3d83d17c",
    model: "deepseek-chat",
    apiStyle: "openai-chat",
    apiPath: "/chat/completions",
    maxTokens: 600,
    temperature: 0.2
  }
};
