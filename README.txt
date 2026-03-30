
This is a Pure frontend package for AAA class because the financial data scrapping methods on the backend don't work on Web host

To show the dashboard for a ticker:
Run:
   python generate_stock_data.py locally with updated ticker list
The script writes stock-data.js in this folder. 

Files:
- index.html: main dashboard shell
- stock-data.js: local stock payload database consumed directly by the dashboard
- llm-config.js: browser-side LLM config
- generate_stock_data.py: builds stock-data.js from live ticker pulls
- home/: home page module
- TMT/: TMT industry scripts and data


Notes:
- This package has no backend dependency.
- Stock lookup only works for tickers already present in stock-data.js.
- Direct browser-side LLM calls require the provider to allow CORS.
