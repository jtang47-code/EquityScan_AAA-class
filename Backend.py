import os
import time
import json
import re
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from googlesearch import search as google_search
except Exception:
    google_search = None


PORT = int(os.environ.get("PORT", "8000"))
BASE_DIR = Path(__file__).resolve().parent
STOCK_CACHE_TTL_SECONDS = 900
BENCHMARK_CACHE_TTL_SECONDS = 3600
WEBSEARCH_CACHE_TTL_SECONDS = 21600
STOCK_PAYLOAD_CACHE = {}
BENCHMARK_HISTORY_CACHE = {"timestamp": 0.0, "data": []}
WEBSEARCH_CACHE = {}


def get_cors_origins():
    raw = str(os.environ.get("CORS_ALLOW_ORIGINS", "")).strip()
    if not raw:
        return ["*"]
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or ["*"]


app = FastAPI(title="EquityScan Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/llm_shell", StaticFiles(directory=BASE_DIR / "llm_shell"), name="llm_shell")
app.mount("/TMT", StaticFiles(directory=BASE_DIR / "TMT"), name="tmt")
app.mount("/home", StaticFiles(directory=BASE_DIR / "home"), name="home")


class WebSearchRequest(BaseModel):
    query: str
    context: str | None = None
    numResults: int | None = 5


class GlossaryEntryPayload(BaseModel):
    acronym: str
    meaning: str
    practicalExplanation: str


class GlossarySaveRequest(BaseModel):
    industryKey: str
    fileName: str
    dataVarName: str
    entry: GlossaryEntryPayload | None = None
    entries: list[GlossaryEntryPayload] | None = None


def now_ts():
    return time.time()


def is_rate_limited_error(err):
    msg = str(err or "").lower()
    return "too many requests" in msg or "rate limit" in msg or "429" in msg


def get_cached_stock_payload(ticker_symbol):
    cached = STOCK_PAYLOAD_CACHE.get(ticker_symbol)
    if not cached:
        return None
    if now_ts() - cached["timestamp"] > STOCK_CACHE_TTL_SECONDS:
        return None
    return cached["data"]


def set_cached_stock_payload(ticker_symbol, payload):
    STOCK_PAYLOAD_CACHE[ticker_symbol] = {
        "timestamp": now_ts(),
        "data": payload,
    }


def get_cached_websearch(cache_key):
    cached = WEBSEARCH_CACHE.get(cache_key)
    if not cached:
        return None
    if now_ts() - cached["timestamp"] > WEBSEARCH_CACHE_TTL_SECONDS:
        return None
    return cached["data"]


def set_cached_websearch(cache_key, payload):
    WEBSEARCH_CACHE[cache_key] = {
        "timestamp": now_ts(),
        "data": payload,
    }


def safe_get_history(ticker_obj, period="2y"):
    try:
        return ticker_obj.history(period=period)
    except Exception as exc:
        print(f"History fetch failed: {exc}")
        return pd.DataFrame()


def safe_get_info(stock):
    info = {}
    try:
        raw = stock.info
        if isinstance(raw, dict):
            info = raw
    except Exception as exc:
        print(f"stock.info failed: {exc}")

    try:
        fast = stock.fast_info
    except Exception as exc:
        print(f"stock.fast_info failed: {exc}")
        fast = {}

    if fast:
        info.setdefault("currentPrice", fast.get("lastPrice") or fast.get("regularMarketPrice"))
        info.setdefault("currency", fast.get("currency"))
        info.setdefault("shortName", fast.get("shortName"))
    return info


def get_cached_benchmark_history():
    if now_ts() - BENCHMARK_HISTORY_CACHE["timestamp"] <= BENCHMARK_CACHE_TTL_SECONDS:
        return BENCHMARK_HISTORY_CACHE["data"]
    benchmark = yf.Ticker("^IXIC")
    bench_hist = format_history(safe_get_history(benchmark, period="2y"))
    if bench_hist:
        BENCHMARK_HISTORY_CACHE["timestamp"] = now_ts()
        BENCHMARK_HISTORY_CACHE["data"] = bench_hist
    return BENCHMARK_HISTORY_CACHE["data"]


def get_finviz_growth_estimate(ticker):
    try:
        url = f"https://finviz.com/quote.ashx?t={ticker}"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
        response = requests.get(url, headers=headers, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")
        td = soup.find("td", string="EPS next 5Y")
        if td:
            val_td = td.find_next_sibling("td")
            if val_td:
                val_text = val_td.text.strip().replace("%", "")
                if val_text != "-":
                    return float(val_text)
    except Exception as exc:
        print(f"Finviz scrape failed for {ticker}: {exc}")
    return None


def perform_web_search(query, context="", num_results=5):
    if google_search is None:
        raise RuntimeError("googlesearch-python is not installed on the backend.")

    normalized_query = str(query or "").strip()
    normalized_context = str(context or "").strip()
    if not normalized_query:
        raise ValueError("No search query provided")

    limit = max(1, min(int(num_results or 5), 8))
    search_query = normalized_query
    if normalized_context:
        search_query = f"{normalized_query} {normalized_context}"

    cache_key = f"{search_query.lower()}::{limit}"
    cached = get_cached_websearch(cache_key)
    if cached is not None:
        return cached

    results = []
    for item in google_search(
        search_query,
        advanced=True,
        num_results=limit,
        sleep_interval=0,
        timeout=10,
        lang="en",
    ):
        title = str(getattr(item, "title", "") or "").strip()
        description = str(getattr(item, "description", "") or "").strip()
        url = str(getattr(item, "url", "") or "").strip()
        if not (title or description or url):
            continue
        results.append({
            "title": title,
            "snippet": description,
            "url": url,
        })

    payload = {
        "query": normalized_query,
        "context": normalized_context,
        "searchQuery": search_query,
        "results": results,
    }
    set_cached_websearch(cache_key, payload)
    return payload


def resolve_glossary_file_path(industry_key, file_name):
    safe_industry = str(industry_key or "").strip()
    safe_file = str(file_name or "").strip()
    if not safe_industry or not safe_file:
        raise ValueError("Missing industry key or glossary file name")
    if any(part in safe_file for part in ("..", "/", "\\")):
        raise ValueError("Invalid glossary file name")

    candidate_dirs = [
        BASE_DIR / safe_industry.upper(),
        BASE_DIR / safe_industry,
    ]
    for candidate_dir in candidate_dirs:
        candidate_path = (candidate_dir / safe_file).resolve()
        if BASE_DIR.resolve() not in candidate_path.parents:
            continue
        if candidate_path.exists():
            return candidate_path

    fallback = (candidate_dirs[0] / safe_file).resolve()
    if BASE_DIR.resolve() not in fallback.parents:
        raise ValueError("Resolved glossary file is outside the workspace")
    return fallback


def build_glossary_js_content(data_var_name, entries):
    lines = []
    for entry in entries:
        lines.append(
            "  { acronym: %s, meaning: %s, practicalExplanation: %s },"
            % (
                json.dumps(entry["acronym"], ensure_ascii=False),
                json.dumps(entry["meaning"], ensure_ascii=False),
                json.dumps(entry["practicalExplanation"], ensure_ascii=False),
            )
        )
    return f"window.{data_var_name} = [\n" + "\n".join(lines) + "\n];\n"


def parse_glossary_js_content(content):
    pattern = re.compile(
        r'\{\s*acronym:\s*("(?:(?:\\.)|[^"])*")\s*,\s*meaning:\s*("(?:(?:\\.)|[^"])*")\s*,\s*practicalExplanation:\s*("(?:(?:\\.)|[^"])*")\s*\}',
        re.DOTALL,
    )
    entries = []
    for match in pattern.finditer(str(content or "")):
        try:
            entries.append({
                "acronym": json.loads(match.group(1)),
                "meaning": json.loads(match.group(2)),
                "practicalExplanation": json.loads(match.group(3)),
            })
        except Exception:
            continue
    return entries


def normalize_glossary_entries(raw_entries):
    normalized_entries = []
    seen = set()
    for item in raw_entries or []:
        if isinstance(item, dict):
            acronym = item.get("acronym", "")
            meaning = item.get("meaning", "")
            practical_explanation = item.get("practicalExplanation", "")
        else:
            acronym = getattr(item, "acronym", "")
            meaning = getattr(item, "meaning", "")
            practical_explanation = getattr(item, "practicalExplanation", "")
        entry = {
            "acronym": str(acronym or "").strip(),
            "meaning": str(meaning or "").strip(),
            "practicalExplanation": str(practical_explanation or "").strip(),
        }
        if not entry["acronym"] or not entry["meaning"] or not entry["practicalExplanation"]:
            continue
        dedupe_key = (
            entry["acronym"].upper(),
            entry["meaning"],
            entry["practicalExplanation"],
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized_entries.append(entry)

    normalized_entries.sort(key=lambda item: (item["acronym"].upper(), item["meaning"]))
    return normalized_entries


def format_history(df):
    if df.empty:
        return []
    df = df.reset_index()
    return [
        {"date": row["Date"].strftime("%Y-%m-%d"), "close": row["Close"]}
        for _, row in df.iterrows()
    ]


def get_financials(stock, is_quarterly=True):
    try:
        if is_quarterly:
            inc = stock.quarterly_income_stmt
            cf = stock.quarterly_cashflow
        else:
            inc = stock.income_stmt
            cf = stock.cashflow
    except Exception as exc:
        print(f"Financials fetch failed: {exc}")
        return []

    if inc is None or inc.empty:
        return []

    inc_t = inc.T
    cf_t = cf.T if cf is not None and not cf.empty else pd.DataFrame()

    def get_val(df, date, keys):
        if df.empty or date not in df.index:
            return None
        row = df.loc[date]
        for key in keys:
            if key in row.index and pd.notnull(row[key]):
                return float(row[key])
        lower_keys = [k.lower() for k in keys]
        for col in row.index:
            if str(col).lower() in lower_keys and pd.notnull(row[col]):
                return float(row[col])
        return None

    combined_data = []
    dates = sorted(inc_t.index, reverse=True)
    for date in dates:
        capex = get_val(cf_t, date, ["Capital Expenditure", "Capital Expenditures"])
        if capex and capex < 0:
            capex = abs(capex)
        combined_data.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "revenue": get_val(inc_t, date, ["Total Revenue", "Revenue", "TotalRevenue"]),
                "cost_of_revenue": get_val(inc_t, date, ["Cost Of Revenue", "Cost Of Goods Sold"]),
                "gross_profit": get_val(inc_t, date, ["Gross Profit"]),
                "operating_expenses": get_val(inc_t, date, ["Total Operating Expenses", "Operating Expense"]),
                "operating_income": get_val(inc_t, date, ["Operating Income"]),
                "net_income": get_val(inc_t, date, ["Net Income", "Net Income Common Stockholders"]),
                "rnd": get_val(inc_t, date, ["Research And Development"]),
                "capex": capex,
            }
        )
    return combined_data


def fetch_stock_payload(ticker_symbol):
    cached_payload = get_cached_stock_payload(ticker_symbol)
    if cached_payload:
        return cached_payload

    stock = yf.Ticker(ticker_symbol)
    hist = safe_get_history(stock, period="2y")
    info = safe_get_info(stock)
    curr_price = info.get("currentPrice") or info.get("regularMarketPrice")
    if curr_price is None and not hist.empty:
        try:
            curr_price = float(hist["Close"].iloc[-1])
        except Exception:
            curr_price = None

    implied_growth_5y = get_finviz_growth_estimate(ticker_symbol)
    peg_5y = info.get("pegRatio")

    if implied_growth_5y is None and peg_5y and peg_5y != 0:
        pe_fwd_1y_approx = info.get("forwardPE")
        if not pe_fwd_1y_approx and curr_price and info.get("forwardEps"):
            pe_fwd_1y_approx = curr_price / info.get("forwardEps")
        if pe_fwd_1y_approx:
            implied_growth_5y = pe_fwd_1y_approx / peg_5y

    eps_curr_year = info.get("epsCurrentYear") or info.get("forwardEps")
    eps_next_year = info.get("epsForward")
    if eps_next_year is None and eps_curr_year is not None:
        growth_rate = (implied_growth_5y / 100.0) if implied_growth_5y else 0.0
        eps_next_year = eps_curr_year * (1 + growth_rate)

    current_month = datetime.now().month
    current_year = datetime.now().year
    next_year = current_year + 1

    if current_month <= 3:
        w_curr, w_next, q_str = 1.0, 0.0, f"{current_year} Q1-Q4"
    elif current_month <= 6:
        w_curr, w_next, q_str = 0.75, 0.25, f"{current_year} Q2-Q4 + {next_year} Q1"
    elif current_month <= 9:
        w_curr, w_next, q_str = 0.50, 0.50, f"{current_year} Q3-Q4 + {next_year} Q1-Q2"
    else:
        w_curr, w_next, q_str = 0.25, 0.75, f"{current_year} Q4 + {next_year} Q1-Q3"

    eps_weighted = None
    pe_weighted = None
    if eps_curr_year is not None and eps_next_year is not None:
        eps_weighted = (eps_curr_year * w_curr) + (eps_next_year * w_next)
        if eps_weighted > 0 and curr_price:
            pe_weighted = curr_price / eps_weighted

    peg_5y_display = peg_5y
    if pe_weighted and implied_growth_5y and implied_growth_5y > 0:
        peg_5y_display = pe_weighted / implied_growth_5y

    eps_fwd_5y = None
    pe_fwd_5y = None
    if implied_growth_5y:
        trailing_eps = info.get("trailingEps")
        base_eps = trailing_eps if trailing_eps and trailing_eps > 0 else eps_weighted
        years_to_project = 5 if base_eps == trailing_eps else 4
        if base_eps and base_eps > 0:
            try:
                eps_fwd_5y = base_eps * ((1 + (implied_growth_5y / 100)) ** years_to_project)
                if eps_fwd_5y > 0 and curr_price:
                    pe_fwd_5y = curr_price / eps_fwd_5y
            except Exception:
                pass

    payload = {
        "info": {
            "symbol": ticker_symbol,
            "name": info.get("shortName", ticker_symbol),
            "currency": info.get("currency", "USD"),
            "price": curr_price,
            "metrics_1y": {
                "eps": eps_weighted,
                "pe": pe_weighted,
                "q_str": q_str,
                "w_curr": w_curr,
                "w_next": w_next,
            },
            "metrics_5y": {
                "eps": eps_fwd_5y,
                "pe": pe_fwd_5y,
                "peg": peg_5y_display,
                "growth": implied_growth_5y,
            },
        },
        "price_history": format_history(hist),
        "benchmark_history": get_cached_benchmark_history(),
        "financials": {
            "quarterly": get_financials(stock, is_quarterly=True),
            "annual": get_financials(stock, is_quarterly=False),
        },
    }
    set_cached_stock_payload(ticker_symbol, payload)
    return payload


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/")
def frontend_root():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/index.html")
def frontend_index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/app-config.js")
def frontend_app_config():
    return FileResponse(BASE_DIR / "app-config.js", media_type="application/javascript")


@app.get("/api/stock")
def stock_lookup(ticker: str):
    ticker_symbol = str(ticker or "").strip().upper()
    if not ticker_symbol:
        raise HTTPException(status_code=400, detail="No ticker provided")
    try:
        return fetch_stock_payload(ticker_symbol)
    except Exception as exc:
        print(f"Error fetching stock for {ticker_symbol}: {exc}")
        cached_payload = get_cached_stock_payload(ticker_symbol)
        if cached_payload:
            return cached_payload
        if is_rate_limited_error(exc):
            raise HTTPException(status_code=429, detail="Upstream market data provider is rate limited. Try again in a minute.")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/websearch")
def websearch(payload: WebSearchRequest):
    query = str(payload.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="No search query provided")

    try:
        return perform_web_search(
            query=query,
            context=payload.context or "",
            num_results=payload.numResults or 5,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/glossary/save")
def glossary_save(payload: GlossarySaveRequest):
    try:
        data_var_name = str(payload.dataVarName or "").strip()
        if not data_var_name:
            raise ValueError("Missing glossary data variable name")
        target_path = resolve_glossary_file_path(payload.industryKey, payload.fileName)
        existing_entries = parse_glossary_js_content(target_path.read_text(encoding="utf-8")) if target_path.exists() else []
        incoming_entries = normalize_glossary_entries(payload.entries or [])
        incoming_single = normalize_glossary_entries([payload.entry] if payload.entry else [])

        merged_entries = existing_entries
        target_entry = None
        did_add_entry = False
        if incoming_single:
            target_entry = incoming_single[0]
            merged_entries = normalize_glossary_entries([*existing_entries, target_entry])
            did_add_entry = len(merged_entries) > len(normalize_glossary_entries(existing_entries))
        elif incoming_entries:
            merged_entries = normalize_glossary_entries(incoming_entries)
            did_add_entry = True
        else:
            raise ValueError("No glossary entry provided to save")

        target_path.write_text(
            build_glossary_js_content(data_var_name, merged_entries),
            encoding="utf-8",
        )
        if target_entry:
            saved = any(
                item["acronym"].upper() == target_entry["acronym"].upper()
                and item["meaning"] == target_entry["meaning"]
                and item["practicalExplanation"] == target_entry["practicalExplanation"]
                for item in merged_entries
            )
            if not saved:
                raise ValueError("Glossary entry was not persisted")
            if not did_add_entry:
                return {
                    "saved": False,
                    "count": len(merged_entries),
                    "path": str(target_path),
                    "reason": "Entry already exists in the glossary database."
                }
        return {"saved": True, "count": len(merged_entries), "path": str(target_path)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


if __name__ == "__main__":
    import uvicorn

    print(f"Server running on http://0.0.0.0:{PORT}")
    print(f"CORS origins: {', '.join(get_cors_origins())}")
    uvicorn.run("Backend:app", host="0.0.0.0", port=PORT, reload=False)
