import { access, readFile } from "node:fs/promises";
import {
  constraints,
  itineraryDays,
  locations,
  priorities,
  roadTripDays,
  vehicle,
} from "./route-data.mjs";
import { routeGeometries } from "./route-geometries.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const milesFor = (dayId) => routeGeometries[dayId].distanceMeters / 1609.344;
const days = Object.entries(itineraryDays);

assert(days.length === 4, "Expected four park route entries.");
assert(vehicle.practical_miles_at_80_percent === 226, "80% practical range must remain 226 miles.");
assert(vehicle.practical_miles_at_100_percent === 283, "100% practical range must remain about 283 miles.");
assert(constraints.comfort_max_miles === 200, "Comfort cap must remain 200 miles.");
assert(constraints.min_end_soc === 25, "Minimum preferred end SOC must remain 25%.");
assert(roadTripDays.length === 2, "Expected two Yellowstone-bound road-trip days.");

for (const [dayId, day] of days) {
  assert(day.route[0] === "hotel", `${dayId} must start at the hotel.`);
  assert(day.route.at(-1) === "hotel", `${dayId} must end at the hotel.`);
  assert(day.route.includes("westEntrance"), `${dayId} must use West Entrance.`);
  assert(day.route.includes("westSupercharger"), `${dayId} must use the West Yellowstone Supercharger.`);
  assert(day.targetEndSoc >= constraints.min_end_soc, `${dayId} target SOC is below 25%.`);
  assert(day.mapStops.length >= 8, `${dayId} requires a detailed stop sequence.`);
  assert(day.schedule.length >= 9, `${dayId} requires a complete schedule.`);
  assert(day.weather.temperatures.length === day.weather.times.length, `${dayId} weather series mismatch.`);

  for (const locationId of [...day.route, ...day.mapStops, ...day.optionalStops]) {
    assert(locations[locationId], `${dayId} references missing location ${locationId}.`);
    assert(Number.isFinite(locations[locationId].lat), `${locationId} has invalid latitude.`);
    assert(Number.isFinite(locations[locationId].lng), `${locationId} has invalid longitude.`);
  }

  const geometry = routeGeometries[dayId];
  assert(geometry?.coordinates?.length > 100, `${dayId} lacks realistic road geometry.`);
  assert(geometry.distanceMeters > 0, `${dayId} lacks route distance.`);
  assert(geometry.durationSeconds > 0, `${dayId} lacks route duration.`);
}

assert(itineraryDays.day1.type === "Partial day", "Tuesday must be a partial arrival day.");
assert(!itineraryDays.day1.route.includes("oldFaithful"), "Tuesday must not include Old Faithful.");
assert(itineraryDays.day2.route.includes("oldFaithful"), "Wednesday must include Old Faithful.");
assert(itineraryDays.day2.route.includes("haydenValley"), "Wednesday must include Hayden Valley.");
assert(!itineraryDays.day3.route.includes("haydenValley"), "Thursday must not repeat Hayden Valley.");
assert(!itineraryDays.day3.route.includes("lakeVillage"), "Thursday must not include Lake Village.");
assert(itineraryDays.day4.route.includes("sloughCreek"), "Friday must turn at Slough Creek.");
assert(!itineraryDays.day4.route.includes("northEntrance"), "Friday must not use North Entrance.");
assert(!itineraryDays.day4.route.includes("northeastEntrance"), "Friday must not use Northeast Entrance.");
assert(milesFor("day4") <= constraints.comfort_max_miles, "Friday exceeds the 200-mile comfort cap.");
assert(locations.biscuitBasin.kind === "closed", "Biscuit Basin must be marked closed.");

const allRequiredStops = new Set(days.flatMap(([, day]) => day.mapStops));
const priorityLocationIds = [
  "grandPrismaticOverlook",
  "oldFaithful",
  "upperGeyser",
  "westThumb",
  "lakeVillage",
  "haydenValley",
  "artistPoint",
  "lowerFallsView",
  "mammoth",
  "westernLamar",
];
for (const locationId of priorityLocationIds) {
  assert(allRequiredStops.has(locationId), `Must-see stop ${locationId} is missing from the maps.`);
}
assert(priorities.must.length === 10, "Must-see priority list is incomplete.");

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
assert(
  html.includes("Yellowstone 3.5-Day Optimized Tesla Itinerary"),
  "Final 3.5-day report title is missing.",
);
assert(html.includes('id="masterRouteMap"'), "Master map container is missing.");
assert(html.includes('id="dailyCards"'), "Daily card container is missing.");
assert(html.includes("Saturday · July 4"), "Saturday drive-home section is missing.");
assert(html.includes("Celsius forecast source"), "Weather source link is missing.");
assert(html.includes("NPS current conditions"), "NPS conditions link is missing.");
assert(html.includes("Tesla Superchargers"), "Tesla quick link is missing.");
assert(html.includes("SpringHill Suites hotel"), "Hotel quick link is missing.");

await access(new URL("../../assets/vendor/leaflet/leaflet.js", import.meta.url));
await access(new URL("../../assets/vendor/leaflet/leaflet.css", import.meta.url));
await access(new URL("../../assets/images/milpitas-to-yellowstone-road-trip.png", import.meta.url));

console.log(
  `Yellowstone itinerary validation passed: ${days
    .map(([dayId, day]) => `${day.shortLabel} ${milesFor(dayId).toFixed(1)} mi`)
    .join(" | ")}`,
);
