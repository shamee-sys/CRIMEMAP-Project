CRIMEMAP AI — QUICK START (Windows)

1. Extract CRIMEMAP_AI_PRO.zip to your Documents folder.
2. Open the extracted CRIMEMAP_AI_PRO folder.
3. Click the folder address bar, type cmd, and press Enter.
4. Run these commands:

   py -m venv .venv
   .venv\\Scripts\\activate
   py -m pip install -r requirements.txt
   py app.py

5. Open this address in Chrome:
   http://127.0.0.1:5000

To stop the website, click the CMD window and press Ctrl+C.

PAGES
- Overview: /
- Night Vision Map: /map
- Analytics & Trends: /analytics
- Incident Explorer: /explorer
- Hotspot Intelligence: /hotspots
- Reports: /reports
- About / Methodology: /about

IMPORTANT
- All records are fictional demo data.
- No official Puducherry police statistics are included.
- The map uses online CARTO dark map tiles and needs internet.
- Charts use Chart.js from a CDN and need internet.
- Area rankings are simple counts, not validated AI predictions.
