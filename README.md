# EquityScan AAA Class

This folder is a deployment-oriented copy of the EquityScan app.

It is intended for this setup:

- Frontend hosted publicly on GitHub Pages
- Backend run locally on your machine
- Local backend exposed to the public frontend through Cloudflare Tunnel

## What This Version Contains

- `index.html`: main single-page app shell
- `Backend.py`: local FastAPI backend
- `app-config.js`: frontend runtime config, including the backend public URL
- `llm_shell/`: browser-side LLM helpers and workflows
- `home/`: home page module
- `TMT/`: TMT sector data and modules

## How This Version Works

The frontend is static and can be hosted on GitHub Pages.

The backend is not hosted on GitHub Pages. It runs on your own machine, usually at:

`http://localhost:8000`

Because GitHub Pages cannot call `localhost` on your machine, Cloudflare Tunnel is used to create a public URL that forwards requests to your local backend.

Example:

- Frontend: `https://jtang47-code.github.io/EquityScan_AAA-class/`
- Local backend: `http://localhost:8000`
- Public backend through Cloudflare: `https://abc-def-ghi.trycloudflare.com`

In that example, the frontend calls the Cloudflare URL, and Cloudflare forwards traffic to your local backend.

## Important Files

### `app-config.js`

This file controls where the frontend sends API requests.

Set:

```js
apiBaseUrl: "https://your-public-backend-url"
```

Examples:

```js
apiBaseUrl: "https://abc-def-ghi.trycloudflare.com"
```

or, if you later buy a domain and configure a permanent hostname:

```js
apiBaseUrl: "https://api.yourdomain.com"
```

### `Backend.py`

This backend now supports an environment variable for CORS:

`CORS_ALLOW_ORIGINS`

For this GitHub Pages deployment, use:

```powershell
$env:CORS_ALLOW_ORIGINS="https://jtang47-code.github.io"
```

Then start the backend:

```powershell
python .\Backend.py
```

## Temporary vs Permanent Backend URL

### Temporary

If you do not own a domain, use a temporary Cloudflare tunnel:

```powershell
cloudflared tunnel --url http://localhost:8000
```

Cloudflare will print a public URL ending in `.trycloudflare.com`.

That URL becomes your `apiBaseUrl`.

Important:

- This URL changes when the tunnel is restarted
- You must update `app-config.js` each time it changes

### Permanent

For a permanent backend URL, you need a domain name that you own and manage in Cloudflare.

Example:

- Owned domain: `yourdomain.com`
- Backend hostname: `api.yourdomain.com`

That means:

```js
apiBaseUrl: "https://api.yourdomain.com"
```

If you do not already own a domain, you must purchase one first to get a permanent hostname.

## Local Run Flow

1. Start the backend locally:

```powershell
cd "c:\Users\tangj\Desktop\Trading\Quant Trading\Text analysis&Dashboard\Dashboards\For AA class"
$env:CORS_ALLOW_ORIGINS="https://jtang47-code.github.io"
python .\Backend.py
```

2. Start Cloudflare Tunnel in another terminal:

```powershell
cloudflared tunnel --url http://localhost:8000
```

3. Copy the public URL Cloudflare prints.

4. Paste it into `app-config.js` as `apiBaseUrl`.

5. Publish the frontend files to GitHub Pages.


## Summary

This folder is the GitHub-Pages-plus-local-backend version of the app.

Use it when:

- the frontend should be publicly hosted
- the backend should stay on your own machine
- Cloudflare Tunnel should bridge the two

If you want a permanent backend URL, you need a real domain name. If you do not have one, use a temporary `.trycloudflare.com` tunnel URL first.
