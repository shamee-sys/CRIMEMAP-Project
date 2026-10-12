from flask import Flask, render_template, request, jsonify, Response
from pathlib import Path
from datetime import datetime, timedelta
import csv
import io
import json
from collections import Counter, defaultdict

app = Flask(__name__)

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "incidents.csv"


# ------------------------------------------
# LOAD INCIDENT DATA
# ------------------------------------------

def load_incidents():
    rows = []

    if not DATA_FILE.exists():
        app.logger.error("Incident CSV not found: %s", DATA_FILE)
        return rows

    with DATA_FILE.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            try:
                row["latitude"] = float(row.get("latitude") or 0)
                row["longitude"] = float(row.get("longitude") or 0)
            except (ValueError, TypeError):
                row["latitude"] = 0.0
                row["longitude"] = 0.0

            rows.append(row)

    return rows


# ------------------------------------------
# FILTER INCIDENTS
# ------------------------------------------

def filtered_incidents(category="", area="", start="", end="", q=""):
    rows = load_incidents()

    if category and category != "All Categories":
        rows = [
            r for r in rows
            if r.get("category", "") == category
        ]

    if area and area != "All Areas":
        rows = [
            r for r in rows
            if r.get("area", "") == area
        ]

    if start:
        rows = [
            r for r in rows
            if r.get("date", "") >= start
        ]

    if end:
        rows = [
            r for r in rows
            if r.get("date", "") <= end
        ]

    if q:
        needle = q.lower()
        rows = [
            r for r in rows
            if needle in " ".join(str(v) for v in r.values()).lower()
        ]

    return sorted(
        rows,
        key=lambda r: (r.get("date", ""), r.get("time", "")),
        reverse=True
    )


# ------------------------------------------
# SUMMARY STATISTICS
# ------------------------------------------

def summary(rows):
    categories = Counter(
        r.get("category", "Other") for r in rows
    )

    areas = Counter(
        r.get("area", "Unknown") for r in rows
    )

    dates = Counter(
        r.get("date", "") for r in rows if r.get("date")
    )

    return {
        "total": len(rows),
        "categories": dict(categories),
        "areas": dict(areas),
        "dates": dict(sorted(dates.items())),
        "top_areas": [
            {"area": area, "count": count}
            for area, count in areas.most_common(5)
        ]
    }


# ------------------------------------------
# SHARED TEMPLATE CONTEXT
# ------------------------------------------

@app.context_processor
def common_context():
    rows = load_incidents()

    return {
        "nav_total": len(rows),
        "categories": sorted({
            r.get("category", "") for r in rows
            if r.get("category", "")
        }),
        "areas": sorted({
            r.get("area", "") for r in rows
            if r.get("area", "")
        })
    }


# ------------------------------------------
# OVERVIEW
# ------------------------------------------

@app.route("/")
def overview():
    rows = filtered_incidents()
    stats = summary(rows)

    return render_template(
        "overview.html",
        title="Overview",
        stats=stats,
        recent=rows[:6],
        incidents=rows
    )


# ------------------------------------------
# NIGHT VISION MAP
# ------------------------------------------

@app.route("/map")
def crime_map():
    rows = filtered_incidents()

    return render_template(
        "map.html",
        title="Night Vision Map",
        incidents=rows
    )


# ------------------------------------------
# ANALYTICS & TRENDS
# FIX: PASS INCIDENTS TO THE TEMPLATE
# ------------------------------------------

@app.route("/analytics")
def analytics():
    rows = filtered_incidents()
    stats = summary(rows)

    return render_template(
        "analytics.html",
        title="Analytics & Trends",
        stats=stats,
        incidents=rows
    )


# ------------------------------------------
# INCIDENT EXPLORER
# ------------------------------------------

@app.route("/explorer")
def explorer():
    category = request.args.get("category", "")
    area = request.args.get("area", "")
    q = request.args.get("q", "")

    rows = filtered_incidents(
        category=category,
        area=area,
        q=q
    )

    page = max(1, request.args.get("page", 1, type=int))
    per_page = 10

    total_pages = max(
        1,
        (len(rows) + per_page - 1) // per_page
    )

    page = min(page, total_pages)

    start_index = (page - 1) * per_page

    return render_template(
        "explorer.html",
        title="Incident Explorer",
        incidents=rows[start_index:start_index + per_page],
        all_count=len(rows),
        page=page,
        total_pages=total_pages,
        selected_category=category,
        selected_area=area,
        search_q=q
    )


# ------------------------------------------
# HOTSPOT INTELLIGENCE
# ------------------------------------------

@app.route("/hotspots")
def hotspots():
    stats = summary(filtered_incidents())
    top = stats["top_areas"]
    total = max(1, stats["total"])

    for item in top:
        item["percent"] = round(
            item["count"] / total * 100,
            1
        )

    return render_template(
        "hotspots.html",
        title="Hotspot Intelligence",
        top_areas=top,
        stats=stats
    )


# ------------------------------------------
# REPORTS
# ------------------------------------------

@app.route("/reports")
def reports():
    start = request.args.get("start", "")
    end = request.args.get("end", "")

    rows = filtered_incidents(
        start=start,
        end=end
    )

    return render_template(
        "reports.html",
        title="Reports",
        stats=summary(rows),
        incidents=rows,
        start_date=start,
        end_date=end
    )


# ------------------------------------------
# ABOUT
# ------------------------------------------

@app.route("/about")
def about():
    return render_template(
        "about.html",
        title="About / Methodology"
    )


# ------------------------------------------
# INCIDENTS API
# ------------------------------------------

@app.route("/api/incidents")
def api_incidents():
    rows = filtered_incidents(
        category=request.args.get("category", ""),
        area=request.args.get("area", ""),
        start=request.args.get("start", ""),
        end=request.args.get("end", ""),
        q=request.args.get("q", "")
    )

    return jsonify(rows)


# ------------------------------------------
# SUMMARY API
# ------------------------------------------

@app.route("/api/summary")
def api_summary():
    return jsonify(summary(filtered_incidents()))


# ------------------------------------------
# CSV REPORT DOWNLOAD
# ------------------------------------------

@app.route("/reports.csv")
def download_csv():
    start = request.args.get("start", "")
    end = request.args.get("end", "")

    rows = filtered_incidents(
        start=start,
        end=end
    )

    output = io.StringIO()

    fields = [
        "id",
        "date",
        "time",
        "category",
        "area",
        "description",
        "latitude",
        "longitude",
        "status"
    ]

    writer = csv.DictWriter(
        output,
        fieldnames=fields,
        extrasaction="ignore"
    )

    writer.writeheader()

    writer.writerows([
        {key: row.get(key, "") for key in fields}
        for row in rows
    ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                "attachment; filename=crimemap_demo_report.csv"
        }
    )


# ------------------------------------------
# RUN FLASK APP
# ------------------------------------------

if __name__ == "__main__":
    app.run(debug=True)