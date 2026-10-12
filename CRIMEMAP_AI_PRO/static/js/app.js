"use strict";

/* ==========================================
   CRIMEMAP AI - COMPLETE APP.JS
========================================== */

const crimeChartColors = [
    "#38bdf8", "#fb7185", "#fbbf24", "#a78bfa",
    "#34d399", "#f97316", "#60a5fa", "#e879f9"
];

/* ---------- SHARED HELPERS ---------- */

function readJSON(value, fallback = []) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return value;

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function getIncidentCategory(item) {
    return String(
        item.category ?? item.crime_type ??
        item.incident_type ?? item.type ?? "Other"
    );
}

function getIncidentArea(item) {
    return String(
        item.area ?? item.location ??
        item.neighborhood ?? item.zone ?? "Unknown"
    );
}

function getIncidentDate(item) {
    const raw =
        item.date ??
        item.incident_date ??
        item.reported_at ??
        item.timestamp ??
        item.datetime ??
        item.Date ??
        "";

    if (!raw) return "";

    const value = String(raw).trim();

    // ISO date: YYYY-MM-DD
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];

    // Other parseable date formats
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return "";

    return [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, "0"),
        String(parsed.getDate()).padStart(2, "0")
    ].join("-");
}

function getIncidentId(item) {
    return String(
        item.id ?? item.incident_id ?? item.record_id ?? ""
    );
}

function getIncidentCoordinates(item) {
    const lat = Number(item.latitude ?? item.lat);
    const lng = Number(item.longitude ?? item.lng ?? item.lon);

    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0)
    ) {
        return [lat, lng];
    }

    return null;
}

function escapeMapText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function drawCrimeChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.warn("Chart canvas not found:", canvasId);
        return;
    }

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
    }

    canvas._chartInstance = new Chart(canvas, config);
}

/* ---------- SHARED CHART OPTIONS ---------- */

function crimeChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: "#cbd5e1",
                    padding: 12
                }
            }
        }
    };
}

/* ---------- OVERVIEW PAGE ---------- */

function initOverview(incidents = []) {
    incidents = readJSON(incidents, []);

    if (!Array.isArray(incidents)) incidents = [];

    const categoryCounts = {};
    const areaCounts = {};

    incidents.forEach(item => {
        const category = getIncidentCategory(item);
        const area = getIncidentArea(item);

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        areaCounts[area] = (areaCounts[area] || 0) + 1;
    });

    /* Category Distribution */

    drawCrimeChart("categoryChart", {
        type: "doughnut",
        data: {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: Object.keys(categoryCounts).map(
                    (_, i) => crimeChartColors[i % crimeChartColors.length]
                ),
                borderColor: "#111827",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });

    /* Category Legend */

    const legend = document.getElementById("categoryLegend");

    if (legend) {
        legend.replaceChildren();

        Object.entries(categoryCounts).forEach(([name, count], i) => {
            const row = document.createElement("div");
            row.className = "legend-item";

            const dot = document.createElement("span");
            dot.className = "legend-dot";
            dot.style.backgroundColor =
                crimeChartColors[i % crimeChartColors.length];

            const label = document.createElement("span");
            label.textContent = name;

            const value = document.createElement("b");
            value.textContent = count;

            row.append(dot, label, value);
            legend.appendChild(row);
        });
    }

    /* Incident Activity
       Uses the latest 14 dates present in the dataset.
       Does not depend on today's date.
    */

    const dailyCounts = {};

    incidents.forEach(item => {
        const date = getIncidentDate(item);

        if (!date) return;

        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    const sortedDates = Object.keys(dailyCounts).sort();
    const activityDates = sortedDates.slice(-14);

    drawCrimeChart("trendChart", {
        type: "line",
        data: {
            labels: activityDates.length
                ? activityDates
                : ["No valid date data"],
            datasets: [{
                label: "Incidents",
                data: activityDates.length
                    ? activityDates.map(date => dailyCounts[date])
                    : [0],
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56,189,248,0.15)",
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            ...crimeChartOptions(),
            scales: {
                x: {
                    ticks: { color: "#cbd5e1" },
                    grid: {
                        color: "rgba(148,163,184,0.10)"
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#cbd5e1",
                        precision: 0
                    },
                    grid: {
                        color: "rgba(148,163,184,0.10)"
                    }
                }
            }
        }
    });

    /* Overview Map */

    const mapElement = document.getElementById("overviewMap");

    if (
        mapElement &&
        typeof L !== "undefined" &&
        !mapElement._leaflet_id
    ) {
        const map = L.map(mapElement).setView([11.9416, 79.8083], 12);

        L.tileLayer(
            "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
            {
                attribution: "&copy; OpenStreetMap contributors",
                maxZoom: 19
            }
        ).addTo(map);

        const groups = {};

        incidents.forEach(item => {
            const coordinates = getIncidentCoordinates(item);

            if (!coordinates) return;

            const area = getIncidentArea(item);

            if (!groups[area]) {
                groups[area] = {
                    points: [],
                    count: 0
                };
            }

            groups[area].points.push(coordinates);
            groups[area].count++;
        });

        Object.entries(groups).forEach(([area, group]) => {
            const lat = group.points.reduce(
                (sum, point) => sum + point[0], 0
            ) / group.points.length;

            const lng = group.points.reduce(
                (sum, point) => sum + point[1], 0
            ) / group.points.length;

            const color = group.count >= 10
                ? "#fb7185"
                : group.count >= 5
                    ? "#fbbf24"
                    : "#34d399";

            L.circleMarker([lat, lng], {
                radius: Math.min(18, 5 + group.count),
                color,
                fillColor: color,
                fillOpacity: 0.65
            })
            .bindPopup(
                "<b>" + escapeMapText(area) +
                "</b><br>Records: " + group.count
            )
            .addTo(map);
        });

        setTimeout(() => map.invalidateSize(), 250);
    }

    console.log("Overview initialized:", incidents.length, "records");
}

/* ---------- NIGHT VISION MAP ---------- */

function initCrimeMap(incidents = []) {
    incidents = readJSON(incidents, []);

    if (!Array.isArray(incidents)) incidents = [];

    const element = document.getElementById("crimeMap");

    if (!element) return;

    if (typeof L === "undefined") {
        console.error("Leaflet is missing. Check base.html.");
        return;
    }

    if (element._leaflet_id) return;

    const map = L.map(element).setView([11.9416, 79.8083], 12);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19
        }
    ).addTo(map);

    const markers = L.layerGroup().addTo(map);

    const categoryInput = document.getElementById("mapCategory");
    const areaInput = document.getElementById("mapArea");
    const startInput = document.getElementById("mapStart");
    const endInput = document.getElementById("mapEnd");
    const searchInput = document.getElementById("mapSearch");
    const countElement = document.getElementById("mapCount");

    function renderMap() {
        markers.clearLayers();

        const category = categoryInput?.value || "All Categories";
        const area = areaInput?.value || "All Areas";
        const start = startInput?.value || "";
        const end = endInput?.value || "";
        const search = (searchInput?.value || "").toLowerCase().trim();

        const filtered = incidents.filter(item => {
            const itemCategory = getIncidentCategory(item);
            const itemArea = getIncidentArea(item);
            const date = getIncidentDate(item);

            if (
                category !== "All Categories" &&
                category !== itemCategory
            ) return false;

            if (
                area !== "All Areas" &&
                area !== itemArea
            ) return false;

            if (start && date && date < start) return false;
            if (end && date && date > end) return false;

            const searchable = [
                getIncidentId(item),
                itemCategory,
                itemArea,
                item.description ?? ""
            ].join(" ").toLowerCase();

            return !search || searchable.includes(search);
        });

        filtered.forEach(item => {
            const coordinates = getIncidentCoordinates(item);

            if (!coordinates) return;

            L.marker(coordinates)
                .bindPopup(
                    "<b>" + escapeMapText(getIncidentCategory(item)) +
                    "</b><br>Area: " + escapeMapText(getIncidentArea(item)) +
                    "<br>ID: " + escapeMapText(getIncidentId(item)) +
                    "<br>Date: " + escapeMapText(getIncidentDate(item))
                )
                .addTo(markers);
        });

        if (countElement) {
            countElement.textContent = filtered.length;
        }

        const bounds = markers.getBounds();

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [25, 25],
                maxZoom: 14
            });
        } else {
            map.setView([11.9416, 79.8083], 12);
        }
    }

    function resetFilters() {
        if (categoryInput) categoryInput.selectedIndex = 0;
        if (areaInput) areaInput.selectedIndex = 0;
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";
        if (searchInput) searchInput.value = "";

        renderMap();
    }

    document.getElementById("applyMapFilters")
        ?.addEventListener("click", renderMap);

    document.getElementById("resetMapFilters")
        ?.addEventListener("click", resetFilters);

    searchInput?.addEventListener("keydown", event => {
        if (event.key === "Enter") renderMap();
    });

    renderMap();

    setTimeout(() => map.invalidateSize(), 250);
}

/* ---------- ANALYTICS & TRENDS PAGE ---------- */

function initAnalytics(stats = {}, incidents = []) {
    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded. Check base.html.");
        return;
    }

    incidents = readJSON(incidents, []);

    if (!Array.isArray(incidents)) incidents = [];

    const categoryCounts = {};
    const areaCounts = {};

    incidents.forEach(item => {
        const category = getIncidentCategory(item);
        const area = getIncidentArea(item);

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        areaCounts[area] = (areaCounts[area] || 0) + 1;
    });

    /* Category Distribution */

    drawCrimeChart("analyticsCategory", {
        type: "doughnut",
        data: {
            labels: Object.keys(categoryCounts),
            datasets: [{
                label: "Incident records",
                data: Object.values(categoryCounts),
                backgroundColor: Object.keys(categoryCounts).map(
                    (_, i) => crimeChartColors[i % crimeChartColors.length]
                ),
                borderColor: "#111827",
                borderWidth: 2
            }]
        },
        options: {
            ...crimeChartOptions(),
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#cbd5e1",
                        padding: 12
                    }
                }
            }
        }
    });

    /* Incident Trend: latest 14 dates in the dataset */

    const dailyCounts = {};

    incidents.forEach(item => {
        const date = getIncidentDate(item);

        if (!date) return;

        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    const sortedDates = Object.keys(dailyCounts).sort();
    const trendDates = sortedDates.slice(-14);

    drawCrimeChart("analyticsTrend", {
        type: "line",
        data: {
            labels: trendDates.length
                ? trendDates
                : ["No valid date data"],
            datasets: [{
                label: "Daily incidents",
                data: trendDates.length
                    ? trendDates.map(date => dailyCounts[date])
                    : [0],
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56,189,248,0.15)",
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            ...crimeChartOptions(),
            scales: {
                x: {
                    ticks: { color: "#cbd5e1" },
                    grid: {
                        color: "rgba(148,163,184,0.10)"
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#cbd5e1",
                        precision: 0
                    },
                    grid: {
                        color: "rgba(148,163,184,0.10)"
                    }
                }
            }
        }
    });

    /* Area Comparison */

    const sortedAreas = Object.entries(areaCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    drawCrimeChart("areaChart", {
        type: "bar",
        data: {
            labels: sortedAreas.map(item => item[0]),
            datasets: [{
                label: "Incident records",
                data: sortedAreas.map(item => item[1]),
                backgroundColor: sortedAreas.map(
                    (_, i) => crimeChartColors[i % crimeChartColors.length]
                ),
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: "#cbd5e1",
                        precision: 0
                    },
                    grid: {
                        color: "rgba(148,163,184,0.10)"
                    }
                },
                y: {
                    ticks: { color: "#cbd5e1" },
                    grid: { display: false }
                }
            }
        }
    });

    console.log(
        "Analytics initialized. Incident records:",
        incidents.length
    );
}