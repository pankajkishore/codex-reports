import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  constraints,
  itineraryDays,
  locations,
  requiredMappedLocations,
} from "./route-data.mjs";
import { routeGeometries } from "./route-geometries.mjs";

const seenLocations = new Set();
const reportHtml = await readFile(
  new URL("./index.html", import.meta.url),
  "utf8",
);

for (const [dayId, day] of Object.entries(itineraryDays)) {
  assert.equal(day.route[0], "hotel", `${dayId} must start at hotel`);
  assert.equal(day.route.at(-1), "hotel", `${dayId} must end at hotel`);

  for (const locationId of day.route) {
    assert.ok(locations[locationId], `${dayId} has unknown stop ${locationId}`);
    seenLocations.add(locationId);
  }

  const geometry = routeGeometries[dayId];
  assert.ok(geometry, `${dayId} must have a road polyline`);
  assert.ok(geometry.coordinates.length > 20, `${dayId} geometry is too short`);
  assert.equal(geometry.legs.length, day.route.length - 1);

  const miles = geometry.distanceMeters / 1609.344;
  assert.ok(
    miles <= constraints.max_miles || day.allowOver200,
    `${dayId} exceeds ${constraints.max_miles} miles without an exception`,
  );

  const planMatch = reportHtml.match(
    new RegExp(
      `<ol class="spot-list" data-route-day="${dayId}">([\\s\\S]*?)</ol>`,
    ),
  );
  assert.ok(planMatch, `${dayId} must have a detailed HTML spot list`);
  const planStops = [
    ...planMatch[1].matchAll(/data-location="([^"]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(
    planStops,
    day.route,
    `${dayId} HTML spot list must match its route array`,
  );
}

for (const locationId of requiredMappedLocations) {
  assert.ok(locations[locationId], `Missing required map location ${locationId}`);
}

assert.deepEqual(itineraryDays.day1.route.slice(0, 6), [
  "hotel",
  "westEntrance",
  "madisonJunction",
  "grandPrismatic",
  "oldFaithful",
  "westSupercharger",
]);

console.log(
  Object.entries(itineraryDays)
    .map(([dayId, day]) => {
      const geometry = routeGeometries[dayId];
      return `${day.label}: ${(geometry.distanceMeters / 1609.344).toFixed(1)} mi, ${geometry.coordinates.length} road points`;
    })
    .join("\n"),
);
