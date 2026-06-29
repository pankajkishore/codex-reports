import {
  backupChargerIds,
  constraints,
  driveHome,
  itineraryDays,
  locations,
  priorities,
  roadTripDays,
  vehicle,
} from "./route-data.mjs";
import { generatedAt, routeGeometries } from "./route-geometries.mjs";

const dayEntries = Object.entries(itineraryDays);
const maps = new Map();
const detailLayers = new Map();
let masterMap;
let activeMasterDay = "all";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const milesFor = (dayId) => routeGeometries[dayId].distanceMeters / 1609.344;
const hoursFor = (dayId) => routeGeometries[dayId].durationSeconds / 3600;
const latLngsFor = (dayId) => {
  const coordinates = routeGeometries[dayId].coordinates;
  const stride = Math.max(1, Math.ceil(coordinates.length / 1200));
  const sampled = coordinates
    .filter((_, index) => index % stride === 0)
    .map(([lng, lat]) => [lat, lng]);
  const [lastLng, lastLat] = coordinates.at(-1);
  if (sampled.at(-1)[0] !== lastLat || sampled.at(-1)[1] !== lastLng) {
    sampled.push([lastLat, lastLng]);
  }
  return sampled;
};

const tileLayer = () =>
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  });

const makeMap = (elementId) => {
  const map = L.map(elementId, {
    zoomAnimation: false,
    fadeAnimation: false,
  });
  tileLayer().addTo(map);
  maps.set(elementId, map);
  return map;
};

const routeLines = (dayId, day, map) => {
  const latLngs = latLngsFor(dayId);
  const casing = L.polyline(latLngs, {
    color: "#ffffff",
    weight: 8,
    opacity: 0.9,
    lineJoin: "round",
  }).addTo(map);
  const line = L.polyline(latLngs, {
    color: day.color,
    weight: 5,
    opacity: 0.95,
    lineJoin: "round",
  }).addTo(map);
  return { casing, line, latLngs };
};

const numberedIcon = (dayNumber, stopNumber, color, kind) =>
  L.divIcon({
    className: "route-marker-shell",
    html: `<span class="route-marker ${escapeHtml(kind)}" style="--marker-color:${escapeHtml(
      color,
    )}">D${dayNumber}-${stopNumber}</span>`,
    iconSize: [46, 34],
    iconAnchor: [23, 17],
  });

const optionalIcon = () =>
  L.divIcon({
    className: "optional-marker-shell",
    html: '<span class="optional-marker" aria-hidden="true">○</span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const arrowIcon = (color, bearing) =>
  L.divIcon({
    className: "route-arrow-shell",
    html: `<span class="route-arrow" style="--arrow-color:${escapeHtml(
      color,
    )};transform:rotate(${bearing}deg)">➤</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const bearingBetween = ([lat1, lng1], [lat2, lng2]) => {
  const y = Math.sin(((lng2 - lng1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lng2 - lng1) * Math.PI) / 180);
  return (Math.atan2(y, x) * 180) / Math.PI;
};

const addArrows = (map, latLngs, color) => {
  const step = Math.max(55, Math.floor(latLngs.length / 10));
  for (let index = step; index < latLngs.length - 2; index += step) {
    const nextIndex = Math.min(index + 3, latLngs.length - 1);
    L.marker(latLngs[index], {
      icon: arrowIcon(color, bearingBetween(latLngs[index], latLngs[nextIndex])),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }
};

const markerPopup = (dayId, stopNumber, location, status = "Required stop") => `
  <strong>${escapeHtml(location.name)}</strong><br />
  <span>${escapeHtml(dayId.toUpperCase())}-${stopNumber} · ${escapeHtml(status)}</span><br />
  <small>${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}</small>
`;

const addDetailedMarkers = (map, dayId, day, dayNumber) => {
  day.mapStops.forEach((locationId, stopNumber) => {
    const location = locations[locationId];
    const status =
      location.kind === "closed"
        ? "Closed · drive past only"
        : location.kind === "charger"
          ? "Required evening charge"
          : "Required stop";
    L.marker([location.lat, location.lng], {
      icon: numberedIcon(dayNumber, stopNumber, day.color, location.kind),
      title: location.name,
    })
      .bindPopup(markerPopup(dayId, stopNumber, location, status))
      .addTo(map);
  });

  day.optionalStops.forEach((locationId) => {
    const location = locations[locationId];
    L.marker([location.lat, location.lng], {
      icon: optionalIcon(),
      title: `Optional: ${location.name}`,
    })
      .bindPopup(`<strong>${escapeHtml(location.name)}</strong><br />Optional only if time and range allow.`)
      .addTo(map);
  });

  backupChargerIds
    .filter((locationId) => day.mapStops.some((stopId) => {
      const stop = locations[stopId];
      const charger = locations[locationId];
      return Math.abs(stop.lat - charger.lat) < 0.03 && Math.abs(stop.lng - charger.lng) < 0.03;
    }))
    .forEach((locationId) => {
      const location = locations[locationId];
      L.circleMarker([location.lat, location.lng], {
        radius: 6,
        color: "#6b7280",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
        dashArray: "3 3",
      })
        .bindPopup(`<strong>${escapeHtml(location.name)}</strong><br />Level 2 backup only.`)
        .addTo(map);
    });
};

const googleDirectionsUrl = (day) => {
  const points = day.route.map((id) => locations[id]);
  const origin = points[0];
  const destination = points.at(-1);
  const waypoints = points.slice(1, -1).map((point) => `${point.lat},${point.lng}`).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=${encodeURIComponent(
    waypoints,
  )}&travelmode=driving`;
};

const weatherChart = (weather, color) => {
  const width = 620;
  const height = 220;
  const plot = { left: 52, top: 18, right: 16, bottom: 42 };
  const innerWidth = width - plot.left - plot.right;
  const innerHeight = height - plot.top - plot.bottom;
  const x = (index) => plot.left + (index / (weather.temperatures.length - 1)) * innerWidth;
  const y = (temperature) => plot.top + ((30 - temperature) / 30) * innerHeight;
  const path = weather.temperatures
    .map((temperature, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(temperature)}`)
    .join(" ");
  const grid = [0, 10, 20, 30]
    .map(
      (tick) => `
        <line x1="${plot.left}" y1="${y(tick)}" x2="${width - plot.right}" y2="${y(tick)}" />
        <text x="${plot.left - 10}" y="${y(tick) + 4}" text-anchor="end">${tick}°</text>
      `,
    )
    .join("");
  const labels = weather.times
    .map(
      (time, index) => `
        <text x="${x(index)}" y="${height - 14}" text-anchor="middle">${escapeHtml(time)}</text>
        <circle cx="${x(index)}" cy="${y(weather.temperatures[index])}" r="5" />
        <text class="temperature-label" x="${x(index)}" y="${y(weather.temperatures[index]) - 10}" text-anchor="middle">${Math.round(
          weather.temperatures[index],
        )}°</text>
      `,
    )
    .join("");
  return `
    <svg class="weather-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Hourly temperature in Celsius">
      <g class="weather-grid">${grid}</g>
      <text class="axis-title" x="16" y="16">°C</text>
      <path class="weather-line" d="${path}" style="--weather-color:${escapeHtml(color)}" />
      <g class="weather-points" style="--weather-color:${escapeHtml(color)}">${labels}</g>
    </svg>
  `;
};

const renderRoadTrip = () => {
  document.querySelector("#roadTripTableBody").innerHTML = roadTripDays
    .map(
      (day) => `
        <tr>
          <td><strong>${escapeHtml(day.label)}</strong><br /><small>${escapeHtml(day.start)}</small></td>
          <td>${escapeHtml(day.route)}</td>
          <td>${escapeHtml(day.requiredChargers.join(" → "))}</td>
          <td>${escapeHtml(day.optionalChargers.join(", "))}</td>
          <td>${escapeHtml(day.food.join(" · "))}</td>
          <td>${escapeHtml(day.overnight)}${day.arrival ? `<br /><strong>${escapeHtml(day.arrival)}</strong>` : ""}</td>
        </tr>
      `,
    )
    .join("");
};

const renderPriorities = () => {
  for (const [key, elementId] of [
    ["must", "mustSeeList"],
    ["optional", "optionalList"],
    ["skip", "skipList"],
  ]) {
    document.querySelector(`#${elementId}`).innerHTML = priorities[key]
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  }
};

const routeSequence = (day) =>
  day.mapStops.map((id, index) => `<span><b>${index}</b>${escapeHtml(locations[id].shortName)}</span>`).join("");

const renderDailyCards = () => {
  document.querySelector("#dailyCards").innerHTML = dayEntries
    .map(([dayId, day], index) => {
      const actualMiles = milesFor(dayId);
      const actualHours = hoursFor(dayId);
      return `
        <article class="daily-card" id="${dayId}">
          <header class="daily-card-header" style="--day-color:${escapeHtml(day.color)}">
            <div>
              <span class="day-status">${escapeHtml(day.type)}</span>
              <p class="eyebrow">${escapeHtml(day.label)} · ${escapeHtml(day.date)}</p>
              <h3>${escapeHtml(day.title)}</h3>
              <p>${escapeHtml(day.purpose)}</p>
            </div>
            <div class="battery-readout">
              <span>Pre-charge SOC target</span>
              <strong>${escapeHtml(day.targetEndSocLabel)}</strong>
              <div class="battery-track" aria-label="${escapeHtml(day.targetEndSocLabel)} pre-charge battery target">
                <span class="battery-fill" style="width:${day.targetEndSoc}%;--day-color:${escapeHtml(day.color)}"></span>
              </div>
            </div>
          </header>

          <div class="daily-metrics">
            <div><span>Leave</span><strong>${escapeHtml(day.departure)}</strong></div>
            <div><span>Return</span><strong>${escapeHtml(day.returnEstimate)}</strong></div>
            <div><span>Requested</span><strong>${escapeHtml(day.targetMiles)}</strong></div>
            <div><span>OSRM route</span><strong>${actualMiles.toFixed(1)} mi · ${actualHours.toFixed(1)} hr · ${(actualMiles * vehicle.consumption_wh_per_mile / 1000).toFixed(0)} kWh</strong></div>
            <div><span>Walking</span><strong>${escapeHtml(day.walking)}</strong></div>
            <div><span>Stops</span><strong>${escapeHtml(day.stopDuration)}</strong></div>
          </div>

          <div class="route-sequence" aria-label="Ordered stops">${routeSequence(day)}</div>

          <div class="daily-detail-grid">
            <div class="detail-map-shell">
              <div class="map-toolbar">
                <strong>Detailed route · D${index + 1}</strong>
                <a href="${googleDirectionsUrl(day)}">Open in Google Maps</a>
              </div>
              <div id="detailMap-${dayId}" class="detail-route-map" aria-label="${escapeHtml(day.label)} route map"></div>
            </div>
            <ol class="timeline">
              ${day.schedule
                .map(
                  ([time, stop, note]) => `
                    <li>
                      <time>${escapeHtml(time)}</time>
                      <div><strong>${escapeHtml(stop)}</strong><span>${escapeHtml(note)}</span></div>
                    </li>
                  `,
                )
                .join("")}
            </ol>
          </div>

          <div class="ops-grid">
            <div><span>Best photo window</span><strong>${escapeHtml(day.photoWindow)}</strong></div>
            <div><span>Best wildlife window</span><strong>${escapeHtml(day.wildlifeWindow)}</strong></div>
            <div><span>Parking</span><strong>${escapeHtml(day.parking)}</strong></div>
            <div><span>Bathrooms</span><strong>${escapeHtml(day.bathrooms)}</strong></div>
            <div><span>Food plan</span><strong>${escapeHtml(day.foodPlan)}</strong></div>
          </div>

          <section class="weather-panel">
            <div>
              <p class="eyebrow">Hourly forecast in Celsius</p>
              <h4>${escapeHtml(day.weather.summary)}</h4>
              <p><strong>Rain:</strong> ${escapeHtml(day.weather.rainChance)} · <strong>Wear:</strong> ${escapeHtml(day.weather.wear)}</p>
            </div>
            ${weatherChart(day.weather, day.color)}
          </section>
        </article>
      `;
    })
    .join("");
};

const renderSummary = () => {
  document.querySelector("#routeSummaryBody").innerHTML = dayEntries
    .map(
      ([dayId, day]) => `
        <tr>
          <td><strong>${escapeHtml(day.shortLabel)} ${escapeHtml(day.date)}</strong><br /><small>${escapeHtml(day.type)}</small></td>
          <td>${escapeHtml(day.title)}</td>
          <td>${escapeHtml(day.targetMiles)}</td>
          <td><strong>${milesFor(dayId).toFixed(1)} mi</strong></td>
          <td>${hoursFor(dayId).toFixed(1)} hr road time</td>
          <td>${escapeHtml(day.targetEndSocLabel)}</td>
          <td>${escapeHtml(day.departure)}</td>
        </tr>
      `,
    )
    .join("");
};

const renderDriveHome = () => {
  document.querySelector("#driveHomeRoute").textContent = `${driveHome.route}. ${driveHome.departure}.`;
  document.querySelector("#driveHomeGuidance").textContent = driveHome.guidance;
  document.querySelector("#driveHomeCharge").textContent = driveHome.chargePlan;
};

const initializeMasterMap = () => {
  masterMap = makeMap("masterRouteMap");
  for (const [dayId, day] of dayEntries) {
    const layerGroup = L.layerGroup().addTo(masterMap);
    const lines = routeLines(dayId, day, layerGroup);
    detailLayers.set(dayId, { layerGroup, ...lines });
  }
  fitMasterMap();
  updateMasterMap();

  document.querySelectorAll("[data-master-day]").forEach((button) => {
    button.addEventListener("click", () => {
      activeMasterDay = button.dataset.masterDay;
      document.querySelectorAll("[data-master-day]").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      updateMasterMap();
    });
  });
};

const fitMasterMap = () => {
  const selected =
    activeMasterDay === "all"
      ? dayEntries.flatMap(([dayId]) => latLngsFor(dayId))
      : latLngsFor(activeMasterDay);
  masterMap.fitBounds(selected, { padding: [24, 24] });
};

const updateMasterMap = () => {
  for (const [dayId, { layerGroup }] of detailLayers) {
    if (activeMasterDay === "all" || activeMasterDay === dayId) {
      layerGroup.addTo(masterMap);
    } else {
      masterMap.removeLayer(layerGroup);
    }
  }
  fitMasterMap();
  document.querySelector("#masterMapStatus").textContent =
    activeMasterDay === "all"
      ? "Showing all four park routes"
      : `${itineraryDays[activeMasterDay].label} · ${milesFor(activeMasterDay).toFixed(1)} mi`;
};

const initializeDetailMaps = () => {
  dayEntries.forEach(([dayId, day], index) => {
    const map = makeMap(`detailMap-${dayId}`);
    const { latLngs } = routeLines(dayId, day, map);
    addArrows(map, latLngs, day.color);
    addDetailedMarkers(map, dayId, day, index + 1);
    map.fitBounds(latLngs, { padding: [28, 28] });
  });
};

const validate = () => {
  const errors = [];
  if (dayEntries.length !== 4) errors.push("Expected four park route entries.");
  for (const [dayId, day] of dayEntries) {
    if (day.route[0] !== "hotel" || day.route.at(-1) !== "hotel") {
      errors.push(`${dayId} must start and end at the hotel.`);
    }
    if (!routeGeometries[dayId]?.coordinates?.length) errors.push(`${dayId} has no road geometry.`);
    for (const locationId of [...day.route, ...day.mapStops, ...day.optionalStops]) {
      if (!locations[locationId]) errors.push(`${dayId} references missing ${locationId}.`);
    }
  }
  if (itineraryDays.day1.route.includes("oldFaithful")) errors.push("Tuesday cannot include Old Faithful.");
  if (!itineraryDays.day2.route.includes("haydenValley")) errors.push("Wednesday must include Hayden Valley.");
  if (itineraryDays.day3.route.includes("haydenValley") || itineraryDays.day3.route.includes("lakeVillage")) {
    errors.push("Thursday must remain a pure canyon day.");
  }
  if (!itineraryDays.day4.route.includes("sloughCreek")) errors.push("Friday must turn at Slough Creek.");
  if (milesFor("day4") > constraints.comfort_max_miles) errors.push("Friday exceeds the 200-mile comfort cap.");
  if (locations.biscuitBasin.kind !== "closed") errors.push("Biscuit Basin closure is not represented.");
  if (maps.size !== 5) errors.push("All five interactive maps did not initialize.");
  if (vehicle.practical_miles_at_80_percent !== 226) errors.push("Vehicle range assumption changed.");

  const status = document.querySelector("#mapValidation");
  status.classList.toggle("error", errors.length > 0);
  status.innerHTML = errors.length
    ? `<strong>Validation failed:</strong> ${escapeHtml(errors.join(" "))}`
    : `<strong>Route validation passed.</strong> Four road polylines, four hotel round trips, required stops, the 200-mile Friday cap, and the final day assignments are confirmed. Geometry refreshed ${escapeHtml(
        new Date(generatedAt).toLocaleString(),
      )}.`;
};

renderRoadTrip();
renderPriorities();
renderSummary();
renderDailyCards();
renderDriveHome();
initializeMasterMap();
initializeDetailMaps();
validate();
