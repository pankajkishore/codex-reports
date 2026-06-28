export const vehicle = {
  consumptionWhPerMile: 480,
  practicalMilesAt80Percent: 226,
};

export const constraints = {
  max_miles: 200,
  min_end_soc: 25,
  start_soc: 95,
};

export const locations = {
  hotel: {
    name: "Hotel base (approx.)",
    type: "hotel",
    lat: 44.673,
    lng: -111.351,
  },
  westGate: {
    name: "West Entrance",
    type: "gate",
    lat: 44.657,
    lng: -111.089,
  },
  northGate: {
    name: "North Entrance",
    type: "gate",
    lat: 45.029,
    lng: -110.705,
  },
  northeastGate: {
    name: "Northeast Entrance",
    type: "gate",
    lat: 45.005,
    lng: -110.01,
  },
  eastGate: {
    name: "East Entrance",
    type: "gate",
    lat: 44.488,
    lng: -110.003,
  },
  southGate: {
    name: "South Entrance",
    type: "gate",
    lat: 44.133,
    lng: -110.666,
  },
  madisonRiver: {
    name: "Madison River",
    type: "stop",
    lat: 44.647,
    lng: -110.977,
  },
  madisonJunction: {
    name: "Madison Junction",
    type: "junction",
    lat: 44.646,
    lng: -110.861,
  },
  grandPrismatic: {
    name: "Grand Prismatic",
    type: "stop",
    lat: 44.525,
    lng: -110.838,
  },
  fireholeLake: {
    name: "Firehole Lake Drive",
    type: "stop",
    lat: 44.546,
    lng: -110.786,
  },
  oldFaithful: {
    name: "Old Faithful",
    type: "stop",
    lat: 44.46,
    lng: -110.828,
  },
  westThumb: {
    name: "West Thumb",
    type: "stop",
    lat: 44.416,
    lng: -110.573,
  },
  yellowstoneLake: {
    name: "Yellowstone Lake",
    type: "stop",
    lat: 44.55,
    lng: -110.4,
  },
  hayden: {
    name: "Hayden Valley",
    type: "wildlife",
    lat: 44.644,
    lng: -110.468,
  },
  canyon: {
    name: "Canyon Village",
    type: "stop",
    lat: 44.734,
    lng: -110.489,
  },
  artistPoint: {
    name: "Artist Point",
    type: "stop",
    lat: 44.721,
    lng: -110.479,
  },
  norris: {
    name: "Norris Geyser Basin",
    type: "stop",
    lat: 44.727,
    lng: -110.704,
  },
  mammoth: {
    name: "Mammoth Hot Springs",
    type: "stop",
    lat: 44.976,
    lng: -110.701,
  },
  towerFall: {
    name: "Tower Fall",
    type: "stop",
    lat: 44.916,
    lng: -110.421,
  },
  westernLamar: {
    name: "Western Lamar Valley",
    type: "wildlife",
    lat: 44.916,
    lng: -110.255,
  },
};

export const gates = [
  "westGate",
  "northGate",
  "northeastGate",
  "eastGate",
  "southGate",
];

export const hotelConnections = {
  westGate: { miles: 15, minutes: 28 },
  northGate: { miles: 103, minutes: 130 },
  northeastGate: { miles: 163, minutes: 205 },
  eastGate: { miles: 155, minutes: 190 },
  southGate: { miles: 92, minutes: 120 },
};

export const roadSegments = [
  ["westGate", "madisonRiver", 8, 15],
  ["madisonRiver", "madisonJunction", 6, 10],
  ["madisonJunction", "norris", 14, 25],
  ["madisonJunction", "grandPrismatic", 10, 20],
  ["grandPrismatic", "oldFaithful", 7, 15],
  ["grandPrismatic", "fireholeLake", 4, 12],
  ["fireholeLake", "madisonJunction", 12, 25],
  ["oldFaithful", "westThumb", 17, 35],
  ["westThumb", "southGate", 22, 35],
  ["westThumb", "yellowstoneLake", 21, 35],
  ["yellowstoneLake", "eastGate", 27, 45],
  ["yellowstoneLake", "hayden", 7, 15],
  ["hayden", "canyon", 10, 20],
  ["canyon", "artistPoint", 5, 15],
  ["canyon", "norris", 12, 25],
  ["canyon", "towerFall", 19, 35],
  ["norris", "mammoth", 21, 35],
  ["mammoth", "northGate", 5, 15],
  ["mammoth", "towerFall", 18, 35],
  ["towerFall", "westernLamar", 15, 30],
  ["westernLamar", "northeastGate", 24, 40],
];

export const chargers = [
  {
    id: "westSupercharger",
    name: "West Yellowstone Supercharger",
    type: "Supercharger",
    lat: 44.658,
    lng: -111.099,
  },
  {
    id: "oldFaithfulL2",
    name: "Old Faithful Level 2",
    type: "Level 2 backup",
    lat: 44.459,
    lng: -110.831,
  },
  {
    id: "canyonL2",
    name: "Canyon Village Level 2",
    type: "Level 2 backup",
    lat: 44.735,
    lng: -110.49,
  },
  {
    id: "mammothL2",
    name: "Mammoth Level 2",
    type: "Level 2 backup",
    lat: 44.977,
    lng: -110.699,
  },
];

export const days = {
  day1: {
    label: "Day 1",
    eyebrow: "Day 1 · Jun 30 Tue",
    title: "West Yellowstone and Grand Prismatic",
    copy: "Easy arrival afternoon with Madison River, Grand Prismatic, and Firehole Lake Drive.",
    stops: ["madisonRiver", "grandPrismatic", "fireholeLake"],
    dwellMinutes: 35,
    startMinute: 780,
  },
  day2: {
    label: "Day 2",
    eyebrow: "Day 2 · Jul 1 Wed",
    title: "Old Faithful and Yellowstone Lake",
    copy: "Classic south loop with Old Faithful, West Thumb, and Yellowstone Lake.",
    stops: ["madisonJunction", "oldFaithful", "westThumb", "yellowstoneLake"],
    dwellMinutes: 45,
    startMinute: 420,
  },
  day3: {
    label: "Day 3",
    eyebrow: "Day 3 · Jul 2 Thu",
    title: "Canyon, Artist Point, and Hayden Valley",
    copy: "Waterfalls, canyon viewpoints, geyser basin time, and an early wildlife window.",
    stops: ["norris", "canyon", "artistPoint", "hayden"],
    dwellMinutes: 40,
    startMinute: 360,
    wildlifeStop: "hayden",
    wildlifeTargetMinute: 570,
  },
  day4: {
    label: "Day 4",
    eyebrow: "Day 4 · Jul 3 Fri",
    title: "Mammoth, Tower Fall, and Western Lamar",
    copy: "The longest northern route with a priority on reaching Lamar early.",
    stops: ["norris", "mammoth", "towerFall", "westernLamar"],
    dwellMinutes: 40,
    startMinute: 330,
    wildlifeStop: "westernLamar",
    wildlifeTargetMinute: 570,
  },
};
