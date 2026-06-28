import {
  chargerIds,
  constraints,
  itineraryDays,
  locations,
  requiredMappedLocations,
  vehicle,
} from "./route-data.mjs";
import {
  generatedAt,
  routeGeometries,
} from "./route-geometries.mjs";

const mapElement = document.querySelector("#routeMap");
const mapStatus = document.querySelector("#mapStatus");
const summaryBody = document.querySelector("#routeSummaryBody");
const validationStatus = document.querySelector("#mapValidation");
const selectorButtons = [
  ...document.querySelectorAll("[data-map-day]"),
];
const focus = document.querySelector("#dayFocus");
const dayTabs = [...document.querySelectorAll(".day-tab")];

if (!globalThis.L) {
  mapElement.innerHTML =
    '<p class="map-error">The map library could not load. Check your connection and reload.</p>';
  throw new Error("Leaflet failed to load");
}

const L = globalThis.L;
const map = L.map(mapElement, {
  scrollWheelZoom: false,
  zoomControl: true,
  zoomAnimation: false,
  fadeAnimation: false,
  markerZoomAnimation: false,
});

const tileLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
).addTo(map);

tileLayer.on("tileerror", () => {
  mapElement.classList.add("tiles-unavailable");
});

const routeLayerHost = L.layerGroup().addTo(map);
const markerLayerHost = L.layerGroup().addTo(map);
const routeLayers = {};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMiles(meters) {
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function estimateEndSoc(day, geometry) {
  const practicalCapacityWh =
    (vehicle.practical_miles_at_80_percent / 0.8) *
    vehicle.consumption_wh_per_mile;
  let startSoc = constraints.start_soc;
  let distanceMeters = geometry.distanceMeters;

  if (day.chargeStop && day.chargeTargetSoc) {
    const chargeIndex = day.route.lastIndexOf(day.chargeStop);
    distanceMeters = geometry.legs
      .slice(chargeIndex)
      .reduce((total, leg) => total + leg.distanceMeters, 0);
    startSoc = day.chargeTargetSoc;
  }

  const miles = distanceMeters / 1609.344;
  return Math.max(
    0,
    startSoc -
      ((miles * vehicle.consumption_wh_per_mile) / practicalCapacityWh) * 100,
  );
}

function routeLatLngs(dayId) {
  return routeGeometries[dayId].coordinates.map(([lng, lat]) => [lat, lng]);
}

function createRouteLayer(dayId) {
  const day = itineraryDays[dayId];
  const latLngs = routeLatLngs(dayId);
  const group = L.layerGroup();
  L.polyline(latLngs, {
    color: "#ffffff",
    weight: 9,
    opacity: 0.9,
    interactive: false,
  }).addTo(group);
  L.polyline(latLngs, {
    color: day.color,
    weight: 5,
    opacity: 0.95,
    lineCap: "round",
    lineJoin: "round",
  })
    .bindTooltip(`${day.label}: ${day.title}`, { sticky: true })
    .addTo(group);
  return group;
}

function markerIcon(label, color, charger = false) {
  return L.divIcon({
    className: "route-marker-shell",
    html: `<span class="route-marker ${charger ? "is-charger" : ""}" style="--marker-color:${color}">${escapeHtml(label)}</span>`,
    iconSize: charger ? [32, 32] : [38, 28],
    iconAnchor: charger ? [16, 16] : [19, 14],
    popupAnchor: [0, -16],
  });
}

function popupMarkup(locationId, codes = []) {
  const location = locations[locationId];
  const codeLine = codes.length
    ? `<strong>${codes.map(escapeHtml).join(" / ")}</strong>`
    : "<strong>EV charger</strong>";
  const chargerDetails =
    location.kind === "charger"
      ? `<br>${escapeHtml(location.connector)} · ${escapeHtml(location.power)}`
      : "";
  return `${codeLine}<br>${escapeHtml(location.name)}${chargerDetails}
    <br><span class="popup-coordinates">${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</span>`;
}

function addDayMarkers(dayId) {
  const day = itineraryDays[dayId];
  const seen = new Set();
  day.route.slice(0, -1).forEach((locationId, index) => {
    if (seen.has(locationId)) return;
    seen.add(locationId);
    const location = locations[locationId];
    const code = `${day.shortLabel}-${index}`;
    L.marker([location.lat, location.lng], {
      icon: markerIcon(code, day.color, location.kind === "charger"),
      keyboard: true,
      title: `${code} ${location.name}`,
    })
      .bindPopup(popupMarkup(locationId, [code]))
      .addTo(markerLayerHost);
  });

  addOtherChargers(seen);
}

function addOtherChargers(excluded = new Set()) {
  for (const locationId of chargerIds) {
    if (excluded.has(locationId)) continue;
    const location = locations[locationId];
    L.marker([location.lat, location.lng], {
      icon: markerIcon("EV", "#2c7a4b", true),
      keyboard: true,
      title: location.name,
    })
      .bindPopup(popupMarkup(locationId))
      .addTo(markerLayerHost);
  }
}

function addSharedMarkers() {
  const appearances = new Map();
  for (const day of Object.values(itineraryDays)) {
    day.route.slice(0, -1).forEach((locationId, index) => {
      const codes = appearances.get(locationId) ?? [];
      codes.push(`${day.shortLabel}-${index}`);
      appearances.set(locationId, codes);
    });
  }

  for (const [locationId, codes] of appearances) {
    const location = locations[locationId];
    const label = location.kind === "charger" ? "EV" : String(codes.length);
    L.marker([location.lat, location.lng], {
      icon: markerIcon(label, "#17212b", location.kind === "charger"),
      keyboard: true,
      title: location.name,
    })
      .bindPopup(popupMarkup(locationId, codes))
      .addTo(markerLayerHost);
  }

  addOtherChargers(new Set(appearances.keys()));
}

function renderFocus(dayId) {
  const day = itineraryDays[dayId];
  const geometry = routeGeometries[dayId];
  focus.innerHTML = `
    <p class="eyebrow">${escapeHtml(day.label)}</p>
    <h3>${escapeHtml(day.title)}</h3>
    <p>${escapeHtml(day.copy)}</p>
    <dl>
      <div><dt>OSRM road distance</dt><dd>${formatMiles(geometry.distanceMeters)}</dd></div>
      <div><dt>Drive time</dt><dd>${formatDuration(geometry.durationSeconds)}</dd></div>
      <div><dt>Estimated end SOC</dt><dd>${estimateEndSoc(day, geometry).toFixed(0)}%</dd></div>
    </dl>
  `;
}

function setSelection(selection) {
  routeLayerHost.clearLayers();
  markerLayerHost.clearLayers();
  const dayIds =
    selection === "all" ? Object.keys(itineraryDays) : [selection];
  const bounds = L.latLngBounds([]);

  for (const dayId of dayIds) {
    routeLayers[dayId].addTo(routeLayerHost);
    bounds.extend(L.latLngBounds(routeLatLngs(dayId)));
  }

  if (selection === "all") {
    addSharedMarkers();
    mapStatus.textContent = "All four OSRM road routes";
  } else {
    addDayMarkers(selection);
    const day = itineraryDays[selection];
    const geometry = routeGeometries[selection];
    mapStatus.textContent =
      `${day.label} · ${formatMiles(geometry.distanceMeters)} · ` +
      `${estimateEndSoc(day, geometry).toFixed(0)}% end SOC`;
    renderFocus(selection);
  }

  selectorButtons.forEach((button) => {
    const active = button.dataset.mapDay === selection;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  map.fitBounds(bounds, {
    padding: [28, 28],
    maxZoom: selection === "all" ? 9 : 10,
  });
}

function renderSummary() {
  summaryBody.innerHTML = Object.entries(itineraryDays)
    .map(([dayId, day]) => {
      const geometry = routeGeometries[dayId];
      const orderedStops = day.route
        .map((locationId) => locations[locationId].shortName)
        .join(" → ");
      const miles = geometry.distanceMeters / 1609.344;
      const limitClass = miles > constraints.max_miles ? "over-limit" : "";
      return `<tr>
        <th scope="row"><span class="day-swatch" style="--day-color:${day.color}"></span>${escapeHtml(day.label)}</th>
        <td>${escapeHtml(orderedStops)}</td>
        <td>${escapeHtml(locations[day.gate].shortName)}</td>
        <td class="${limitClass}">${miles.toFixed(1)}</td>
        <td>${formatDuration(geometry.durationSeconds)}</td>
        <td>${escapeHtml(day.chargeNote)}</td>
        <td>${estimateEndSoc(day, geometry).toFixed(0)}%</td>
      </tr>`;
    })
    .join("");
}

function validateMap() {
  const errors = [];

  for (const [dayId, day] of Object.entries(itineraryDays)) {
    if (day.route[0] !== "hotel" || day.route.at(-1) !== "hotel") {
      errors.push(`${day.label} must start and end at hotel`);
    }
    if (!routeGeometries[dayId]?.coordinates?.length) {
      errors.push(`${day.label} has no road polyline`);
    }
    for (const locationId of day.route) {
      if (!locations[locationId]) {
        errors.push(`${day.label} has unknown stop ${locationId}`);
      }
    }
    const miles = routeGeometries[dayId].distanceMeters / 1609.344;
    if (miles > constraints.max_miles && !day.allowOver200) {
      errors.push(`${day.label} exceeds ${constraints.max_miles} miles`);
    }
  }

  for (const locationId of requiredMappedLocations) {
    if (!locations[locationId]) errors.push(`Missing location ${locationId}`);
  }

  if (Object.keys(routeLayers).length !== Object.keys(itineraryDays).length) {
    errors.push("Not every day has a Leaflet route layer");
  }

  validationStatus.classList.toggle("has-errors", errors.length > 0);
  validationStatus.textContent = errors.length
    ? `Validation failed: ${errors.join(" · ")}`
    : `Validated: 4 hotel-return routes, 4 road polylines, all itinerary stops mapped. Day 4 is the documented ${formatMiles(routeGeometries.day4.distanceMeters)} long-day exception.`;
  return errors;
}

for (const dayId of Object.keys(itineraryDays)) {
  routeLayers[dayId] = createRouteLayer(dayId);
}

selectorButtons.forEach((button) => {
  button.addEventListener("click", () => setSelection(button.dataset.mapDay));
});

dayTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    dayTabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    setSelection(tab.dataset.day);
  });
});

document.querySelector("#routeGeneratedAt").textContent =
  `OSRM road geometry generated ${new Date(generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })}.`;

renderSummary();
setSelection("day1");
const validationErrors = validateMap();
if (validationErrors.length) console.error(validationErrors);
