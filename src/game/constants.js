export const TABLE = {
  width: 1200,
  height: 620,
  rail: 58,
  pocketRadius: 35,
  ballRadius: 16,
};

export const POCKETS = [
  { x: TABLE.rail, y: TABLE.rail },
  { x: TABLE.width / 2, y: TABLE.rail - 5 },
  { x: TABLE.width - TABLE.rail, y: TABLE.rail },
  { x: TABLE.rail, y: TABLE.height - TABLE.rail },
  { x: TABLE.width / 2, y: TABLE.height - TABLE.rail + 5 },
  { x: TABLE.width - TABLE.rail, y: TABLE.height - TABLE.rail },
];

export const BALLS = [
  { id: "cue", number: 0, color: "#f8f6e8", type: "cue" },
  { id: "b1", number: 1, color: "#f2b43f", type: "solid" },
  { id: "b2", number: 2, color: "#315fd8", type: "solid" },
  { id: "b3", number: 3, color: "#d33b31", type: "solid" },
  { id: "b4", number: 4, color: "#6d43c6", type: "solid" },
  { id: "b5", number: 5, color: "#f2742c", type: "solid" },
  { id: "b6", number: 6, color: "#1d9a64", type: "solid" },
  { id: "b7", number: 7, color: "#7b2e1d", type: "solid" },
  { id: "b8", number: 8, color: "#171719", type: "eight" },
  { id: "b9", number: 9, color: "#f2b43f", type: "stripe" },
  { id: "b10", number: 10, color: "#315fd8", type: "stripe" },
  { id: "b11", number: 11, color: "#d33b31", type: "stripe" },
  { id: "b12", number: 12, color: "#6d43c6", type: "stripe" },
  { id: "b13", number: 13, color: "#f2742c", type: "stripe" },
  { id: "b14", number: 14, color: "#1d9a64", type: "stripe" },
  { id: "b15", number: 15, color: "#7b2e1d", type: "stripe" },
];
