import argparse
import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf
from bs4 import BeautifulSoup


OUTPUT_FILE = Path(__file__).resolve().parent / "stock-data.js"

# ------------------------------
# Setup
# Edit these before running if you want a fixed local pull list.
# CLI tickers still override this list.
# Example:
# DEFAULT_TICKERS = ["NVDA", "AAPL", "MSFT"]
# ------------------------------
DEFAULT_TICKERS = [
    "NVDA","TSLA","AMD"
]


def get_finviz_growth_estimate(ticker):
    try:
        response = requests.get(
            f"https://finviz.com/quote.ashx?t={ticker}",
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            },
            timeout=10,
        )
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


def safe_history(ticker_obj, period="2y"):
    try:
        return ticker_obj.history(period=period)
    except Exception as exc:
        print(f"History fetch failed: {exc}")
        return pd.DataFrame()


def safe_info(stock):
    info = {}
    try:
        raw = stock.info
        if isinstance(raw, dict):
            info = raw
    except Exception as exc:
        print(f"stock.info failed: {exc}")
    try:
        fast = stock.fast_info
    except Exception:
        fast = {}
    if fast:
        info.setdefault("currentPrice", fast.get("lastPrice") or fast.get("regularMarketPrice"))
        info.setdefault("currency", fast.get("currency"))
        info.setdefault("shortName", fast.get("shortName"))
    return info


def format_history(df):
    if df is None or df.empty:
        return []
    df = df.reset_index()
    return [
        {"date": row["Date"].strftime("%Y-%m-%d"), "close": float(row["Close"])}
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

    combined = []
    for date in sorted(inc_t.index, reverse=True):
        capex = get_val(cf_t, date, ["Capital Expenditure", "Capital Expenditures"])
        if capex and capex < 0:
            capex = abs(capex)
        combined.append(
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
    return combined


def fetch_stock_payload(ticker_symbol, benchmark_history):
    stock = yf.Ticker(ticker_symbol)
    hist = safe_history(stock, period="2y")
    info = safe_info(stock)
    curr_price = info.get("currentPrice") or info.get("regularMarketPrice")
    if curr_price is None and not hist.empty:
        curr_price = float(hist["Close"].iloc[-1])

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
            eps_fwd_5y = base_eps * ((1 + (implied_growth_5y / 100)) ** years_to_project)
            if eps_fwd_5y > 0 and curr_price:
                pe_fwd_5y = curr_price / eps_fwd_5y

    return {
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
        "benchmark_history": benchmark_history,
        "financials": {
            "quarterly": get_financials(stock, is_quarterly=True),
            "annual": get_financials(stock, is_quarterly=False),
        },
    }


def build_output_payload(tickers):
    benchmark = yf.Ticker("^IXIC")
    benchmark_history = format_history(safe_history(benchmark, period="2y"))
    payload = {}
    for ticker in tickers:
        upper = ticker.upper()
        print(f"Fetching {upper}...")
        payload[upper] = fetch_stock_payload(upper, benchmark_history)
    return payload


def write_js_file(payload, output_path):
    js = "window.StockDashboardData = " + json.dumps(payload, indent=2) + ";\n"
    output_path.write_text(js, encoding="utf-8")
    print(f"Wrote {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate stock-data.js for the pure frontend dashboard.")
    parser.add_argument("tickers", nargs="*", help="Tickers to fetch, e.g. NVDA AAPL MSFT")
    parser.add_argument("--output", default=str(OUTPUT_FILE), help="Output JS file path")
    args = parser.parse_args()

    tickers = [ticker.strip().upper() for ticker in args.tickers if ticker.strip()]
    if not tickers:
        tickers = [ticker.strip().upper() for ticker in DEFAULT_TICKERS if ticker.strip()]

    if not tickers:
        raw = input("Enter tickers separated by commas: ").strip()
        tickers = [part.strip().upper() for part in raw.split(",") if part.strip()]

    if not tickers:
        raise SystemExit("No tickers provided. Add them to DEFAULT_TICKERS or pass them on the command line.")

    payload = build_output_payload(tickers)
    write_js_file(payload, Path(args.output))


if __name__ == "__main__":
    main()
