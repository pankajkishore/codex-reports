import {
  chargers,
  constraints,
  days,
  locations,
  roadSegments,
  vehicle,
} from "./route-data.mjs";
import {
  optimizeItinerary,
  rejectionReasons,
} from "./route-optimizer.mjs";

const results = Object.fromEntries(
  optimizeItinerary().map((result) => [result.dayId, result]),
);
const tabs = [...document.querySelectorAll(".day-tab")];
const focus = document.querySelector("#dayFocus");
const map = document.querySelector("#routeMap");
const routeOrder = document.querySelector("#routeOrder");
const alternatives = document.querySelector("#routeAlternatives");
const alternativeToggle = document.querySelector("#showAlternatives");
const mapStatus = document.querySelector("#mapStatus");
let activeDay = "day1";

const bounds = {
  minLat: 44.08,
  maxLat: 45.08,
  minLng: -111.42,
  maxLng: -109.93,
};

function project({ lat, lng }) {
  const width = 760;
  const height = 520;
  const pad = 38;
  return {
    x: pad + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - pad * 2),
    y: height - pad - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - pad * 2),
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${minutes}m`;
}

function formatClock(minutes) {
  if (minutes === null) return "Not applicable";
  const normalized = minutes % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = Math.round(normalized % 60);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 5, 30, hour, minute));
}

function routePoints(candidate) {
  return candidate.routeNodes
    .map((node) => {
      const point = project(locations[node]);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function roadMarkup() {
  return roadSegments
    .map(([from, to]) => {
      const start = project(locations[from]);
      const end = project(locations[to]);
      return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`;
    })
    .join("");
}

function rejectedMarkup(result) {
  if (!alternativeToggle.checked) return "";
  return result.alternatives
    .map(
      (candidate) =>
        `<polyline class="route-rejected" points="${routePoints(candidate)}">
          <title>${escapeHtml(candidate.gateName)}: ${Math.round(candidate.miles)} miles, ${candidate.energy.endSoc.toFixed(0)}% end SOC</title>
        </polyline>`,
    )
    .join("");
}

function markerMarkup(result) {
  const selectedNodes = new Set([
    "hotel",
    result.selected.gate,
    ...result.day.stops,
  ]);

  const locationMarkers = [...selectedNodes]
    .map((id) => {
      const location = locations[id];
      const point = project(location);
      const markerType =
        id === "hotel" ? "hotel" : location.type === "gate" ? "gate" : "stop";
      const labelOffset =
        id === "hotel"
          ? { x: 10, y: -14 }
          : id === "westGate"
            ? { x: 10, y: 20 }
            : { x: 10, y: -8 };
      return `<g class="map-marker ${markerType}">
        <circle cx="${point.x}" cy="${point.y}" r="${markerType === "stop" ? 5 : 7}" />
        <text x="${point.x + labelOffset.x}" y="${point.y + labelOffset.y}">${escapeHtml(location.name)}</text>
      </g>`;
    })
    .join("");

  const chargerMarkers = chargers
    .map((charger) => {
      const point = project(charger);
      return `<g class="map-marker charger">
        <rect x="${point.x - 5}" y="${point.y - 5}" width="10" height="10" rx="2" />
        <title>${escapeHtml(charger.name)} · ${escapeHtml(charger.type)}</title>
      </g>`;
    })
    .join("");

  return locationMarkers + chargerMarkers;
}

function renderFocus(result) {
  const candidate = result.selected;
  focus.innerHTML = `
    <p class="eyebrow">${escapeHtml(result.day.eyebrow)}</p>
    <h3>${escapeHtml(result.day.title)}</h3>
    <p>${escapeHtml(result.day.copy)}</p>
    <dl>
      <div><dt>Optimized distance</dt><dd>${Math.round(candidate.miles)} mi</dd></div>
      <div><dt>Drive time</dt><dd>${formatMinutes(candidate.driveMinutes)}</dd></div>
      <div><dt>Estimated end SOC</dt><dd>${candidate.energy.endSoc.toFixed(0)}%</dd></div>
    </dl>
  `;
}

function renderMap(result) {
  const candidate = result.selected;
  map.innerHTML = `
    <g class="map-grid">
      <line x1="38" y1="160" x2="722" y2="160" />
      <line x1="38" y1="300" x2="722" y2="300" />
      <line x1="250" y1="38" x2="250" y2="482" />
      <line x1="500" y1="38" x2="500" y2="482" />
    </g>
    <g class="park-roads">${roadMarkup()}</g>
    <g aria-hidden="${alternativeToggle.checked ? "false" : "true"}">${rejectedMarkup(result)}</g>
    <polyline class="route-selected" points="${routePoints(candidate)}">
      <title>Selected ${escapeHtml(candidate.gateName)} route</title>
    </polyline>
    ${markerMarkup(result)}
    <g class="map-legend" transform="translate(48 438)">
      <line class="legend-selected" x1="0" y1="0" x2="34" y2="0" />
      <text x="42" y="4">Selected</text>
      <line class="legend-rejected" x1="122" y1="0" x2="156" y2="0" />
      <text x="164" y="4">Rejected gate</text>
      <rect class="legend-charger" x="300" y="-5" width="10" height="10" rx="2" />
      <text x="318" y="4">Charger</text>
    </g>
  `;
  map.setAttribute(
    "aria-label",
    `${result.day.label} selected route through ${candidate.gateName}, ${Math.round(candidate.miles)} miles, with rejected gate alternatives ${alternativeToggle.checked ? "shown" : "hidden"}.`,
  );
  mapStatus.textContent = `${candidate.gateName} selected · ${Math.round(candidate.miles)} mi · ${candidate.energy.endSoc.toFixed(0)}% end SOC`;
}

function renderRouteOrder(result) {
  const candidate = result.selected;
  const orderedNames = [
    locations.hotel.name,
    locations[candidate.gate].name,
    ...candidate.orderedStops.map((stop) => locations[stop].name),
    locations[candidate.gate].name,
    locations.hotel.name,
  ];
  routeOrder.innerHTML = orderedNames
    .map((name, index) => `<li><span>${index + 1}</span>${escapeHtml(name)}</li>`)
    .join("");
  document.querySelector("#wildlifeModel").textContent =
    candidate.wildlifeArrivalMinute === null
      ? ""
      : `Estimated wildlife arrival: ${formatClock(candidate.wildlifeArrivalMinute)}`;
}

function renderAlternatives(result) {
  alternatives.innerHTML = result.alternatives
    .map((candidate) => {
      const reasons = rejectionReasons(candidate, result.settings).join(" · ");
      return `<tr>
        <th scope="row">${escapeHtml(candidate.gateName)}</th>
        <td>${Math.round(candidate.miles)} mi</td>
        <td>${formatMinutes(candidate.driveMinutes)}</td>
        <td>${candidate.energy.endSoc.toFixed(0)}%</td>
        <td><span class="route-state ${candidate.feasible ? "higher-score" : "infeasible"}">${candidate.feasible ? "Not selected" : "Rejected"}</span><br>${escapeHtml(reasons)}</td>
      </tr>`;
    })
    .join("");
}

function render(dayId) {
  activeDay = dayId;
  const result = results[dayId];
  tabs.forEach((tab) => {
    const active = tab.dataset.day === dayId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  renderFocus(result);
  renderMap(result);
  renderRouteOrder(result);
  renderAlternatives(result);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => render(tab.dataset.day));
});

alternativeToggle.addEventListener("change", () => renderMap(results[activeDay]));

document.querySelector("#energyModel").textContent =
  `${vehicle.consumptionWhPerMile} Wh/mi · ${constraints.start_soc}% start · ` +
  `${constraints.min_end_soc}% minimum end · ${constraints.max_miles} mi maximum`;

document.querySelector("#rangeModel").textContent =
  `${vehicle.practicalMilesAt80Percent} mi at 80% scales to ` +
  `${(vehicle.practicalMilesAt80Percent / 0.8 * constraints.start_soc / 100).toFixed(0)} mi at ${constraints.start_soc}% and ` +
  `${(vehicle.practicalMilesAt80Percent / 0.8).toFixed(0)} mi at 100%`;

render(activeDay);
