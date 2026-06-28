import {
  constraints,
  days,
  gates,
  hotelConnections,
  locations,
  roadSegments,
  vehicle,
} from "./route-data.mjs";

const graph = new Map();
const segmentLookup = new Map();

for (const [from, to, miles, minutes] of roadSegments) {
  const segment = { from, to, miles, minutes };
  graph.set(from, [...(graph.get(from) ?? []), { node: to, ...segment }]);
  graph.set(to, [
    ...(graph.get(to) ?? []),
    { node: from, from: to, to: from, miles, minutes },
  ]);
  segmentLookup.set(edgeKey(from, to), segment);
}

function edgeKey(a, b) {
  return [a, b].sort().join("|");
}

function permutations(items) {
  if (items.length < 2) return [items];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, itemIndex) => itemIndex !== index)).map(
      (rest) => [item, ...rest],
    ),
  );
}

function shortestPath(start, end) {
  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const queue = [{ node: start, miles: 0 }];

  while (queue.length) {
    queue.sort((a, b) => a.miles - b.miles);
    const current = queue.shift();
    if (current.node === end) break;
    if (current.miles !== distances.get(current.node)) continue;

    for (const edge of graph.get(current.node) ?? []) {
      const nextMiles = current.miles + edge.miles;
      if (nextMiles < (distances.get(edge.node) ?? Infinity)) {
        distances.set(edge.node, nextMiles);
        previous.set(edge.node, current.node);
        queue.push({ node: edge.node, miles: nextMiles });
      }
    }
  }

  if (!distances.has(end)) return null;

  const nodes = [end];
  while (nodes[0] !== start) nodes.unshift(previous.get(nodes[0]));

  return nodes.slice(1).reduce(
    (result, node, index) => {
      const from = nodes[index];
      const segment = segmentLookup.get(edgeKey(from, node));
      result.miles += segment.miles;
      result.minutes += segment.minutes;
      return result;
    },
    { nodes, miles: 0, minutes: 0 },
  );
}

function energyEstimate(miles, settings) {
  const fullPracticalMiles =
    vehicle.practicalMilesAt80Percent / 0.8;
  const practicalCapacityWh =
    fullPracticalMiles * vehicle.consumptionWhPerMile;
  const energyUsedWh = miles * vehicle.consumptionWhPerMile;
  const endSoc =
    settings.start_soc - (energyUsedWh / practicalCapacityWh) * 100;

  return {
    practicalCapacityKwh: practicalCapacityWh / 1000,
    startUsableMiles: fullPracticalMiles * (settings.start_soc / 100),
    energyUsedKwh: energyUsedWh / 1000,
    endSoc: Math.max(0, endSoc),
  };
}

function buildParkRoute(gate, orderedStops, day) {
  const waypoints = [gate, ...orderedStops, gate];
  const nodes = [gate];
  let miles = 0;
  let minutes = 0;
  let elapsedMinutes = hotelConnections[gate].minutes;
  let wildlifeArrivalMinute = null;

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const path = shortestPath(waypoints[index], waypoints[index + 1]);
    if (!path) return null;
    nodes.push(...path.nodes.slice(1));
    miles += path.miles;
    minutes += path.minutes;
    elapsedMinutes += path.minutes;

    const arrivedStop = waypoints[index + 1];
    if (arrivedStop === day.wildlifeStop && wildlifeArrivalMinute === null) {
      wildlifeArrivalMinute = day.startMinute + elapsedMinutes;
    }
    if (orderedStops.includes(arrivedStop)) {
      elapsedMinutes += day.dwellMinutes;
    }
  }

  return { nodes, miles, minutes, wildlifeArrivalMinute };
}

function scoreCandidate(gate, orderedStops, day, settings) {
  const parkRoute = buildParkRoute(gate, orderedStops, day);
  if (!parkRoute) return null;

  const connector = hotelConnections[gate];
  const miles = parkRoute.miles + connector.miles * 2;
  const driveMinutes = parkRoute.minutes + connector.minutes * 2;
  const energy = energyEstimate(miles, settings);
  const traversed = new Map();

  for (let index = 0; index < parkRoute.nodes.length - 1; index += 1) {
    const key = edgeKey(parkRoute.nodes[index], parkRoute.nodes[index + 1]);
    traversed.set(key, (traversed.get(key) ?? 0) + 1);
  }

  const backtrackMiles = [...traversed.entries()].reduce((total, [key, count]) => {
    if (count < 2) return total;
    return total + segmentLookup.get(key).miles * (count - 1);
  }, 0);
  const batteryBuffer = energy.endSoc - settings.min_end_soc;
  const batteryPenalty =
    batteryBuffer < 0
      ? 1000 + Math.abs(batteryBuffer) * 100
      : Math.max(0, 10 - batteryBuffer) * 8;
  const wildlifeDelay =
    day.wildlifeTargetMinute && parkRoute.wildlifeArrivalMinute
      ? Math.max(0, parkRoute.wildlifeArrivalMinute - day.wildlifeTargetMinute)
      : 0;
  const penalties = {
    backtracking: backtrackMiles * 1.2,
    battery: batteryPenalty,
    lateWildlife: wildlifeDelay * 1.5,
  };
  const feasible =
    miles <= settings.max_miles && energy.endSoc >= settings.min_end_soc;

  return {
    gate,
    gateName: locations[gate].name,
    orderedStops,
    routeNodes: ["hotel", gate, ...parkRoute.nodes.slice(1), "hotel"],
    miles,
    driveMinutes,
    backtrackMiles,
    wildlifeArrivalMinute: parkRoute.wildlifeArrivalMinute,
    energy,
    penalties,
    feasible,
    score:
      miles +
      driveMinutes / 12 +
      penalties.backtracking +
      penalties.battery +
      penalties.lateWildlife,
  };
}

export function optimizeDay(dayId, overrides = {}) {
  const day = days[dayId];
  const settings = { ...constraints, ...overrides };
  if (!day) throw new Error(`Unknown day: ${dayId}`);

  const candidates = gates
    .map((gate) => {
      const gateRoutes = permutations(day.stops)
        .map((stopOrder) => scoreCandidate(gate, stopOrder, day, settings))
        .filter(Boolean)
        .sort((a, b) => a.score - b.score);
      return gateRoutes[0];
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      return a.score - b.score;
    });

  return {
    dayId,
    day,
    settings,
    selected: candidates[0],
    alternatives: candidates.slice(1),
  };
}

export function optimizeItinerary(overrides = {}) {
  return Object.keys(days).map((dayId) => optimizeDay(dayId, overrides));
}

export function rejectionReasons(candidate, settings = constraints) {
  const reasons = [];
  if (candidate.miles > settings.max_miles) {
    reasons.push(`${Math.round(candidate.miles - settings.max_miles)} mi over limit`);
  }
  if (candidate.energy.endSoc < settings.min_end_soc) {
    reasons.push(`${(settings.min_end_soc - candidate.energy.endSoc).toFixed(1)}% below SOC floor`);
  }
  if (candidate.backtrackMiles > 40) {
    reasons.push(`${Math.round(candidate.backtrackMiles)} mi repeated road`);
  }
  if (candidate.penalties.lateWildlife > 0) {
    reasons.push("misses early wildlife window");
  }
  return reasons.length ? reasons : ["higher distance and time score"];
}
