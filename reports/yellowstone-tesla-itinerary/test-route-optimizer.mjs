import assert from "node:assert/strict";
import { constraints, days } from "./route-data.mjs";
import { optimizeDay, optimizeItinerary } from "./route-optimizer.mjs";

const itinerary = optimizeItinerary();

assert.equal(itinerary.length, 4);

for (const result of itinerary) {
  assert.equal(result.alternatives.length, 4);
  assert.equal(result.selected.feasible, true, `${result.dayId} should be feasible`);
  assert.ok(result.selected.miles <= constraints.max_miles);
  assert.ok(result.selected.energy.endSoc >= constraints.min_end_soc);
  assert.equal(result.selected.gate, "westGate");
  assert.deepEqual(
    [...result.selected.orderedStops].sort(),
    [...days[result.dayId].stops].sort(),
  );
}

const constrained = optimizeDay("day4", { max_miles: 150 });
assert.equal(constrained.selected.feasible, false);

console.log(
  itinerary
    .map(
      ({ dayId, selected }) =>
        `${dayId}: ${Math.round(selected.miles)} mi, ${selected.energy.endSoc.toFixed(1)}% SOC, ${selected.gateName}`,
    )
    .join("\n"),
);
