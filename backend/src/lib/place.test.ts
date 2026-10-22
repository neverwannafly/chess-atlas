import test from "node:test";
import assert from "node:assert/strict";
import { parsePlace } from "../lib/place.js";
import { CITY_COUNT } from "../data/places.js";

const cases: [string, string | null, string | null][] = [
  ["Chennai", "Chennai", "Tamil Nadu"],
  ["Bengaluru, KA", "Bengaluru", "Karnataka"],
  ["Bangalore", "Bengaluru", "Karnataka"],
  ["Bangalore, Karnataka", "Bengaluru", "Karnataka"],
  ["New Delhi", "Delhi", "Delhi"],
  ["Delhi", "Delhi", "Delhi"],
  ["Tamil Nadu", null, "Tamil Nadu"],
  ["UP", null, "Uttar Pradesh"],
  ["Pune,, Maharashtra", "Pune", "Maharashtra"],
  ["Pune ,, Maharashtra", "Pune", "Maharashtra"],
  [", West Bengal,", null, "West Bengal"],
  ["Karnataka,", null, "Karnataka"],
  ["Jabalpur ,, MP", "Jabalpur", "Madhya Pradesh"],
  ["Jalpaiguri,, WB", "Jalpaiguri", "West Bengal"],
  ["Tirupattur DT,, Tamil Nadu", "Tirupattur", "Tamil Nadu"],
  ["Thane West,, Maharashtra", "Thane", "Maharashtra"],
  ["Ahiyanagar (ahmednagar),, Maharashtra", "Ahilyanagar", "Maharashtra"],
  ["Miyapur,, Hyderabad", "Hyderabad", "Telangana"],
  ["Virudhachalam.Cuddalore,, Tamil Nadu", "Cuddalore", "Tamil Nadu"],
  ["Pondicherry", "Puducherry", "Puducherry"],
  ["Kashmir", null, "Jammu and Kashmir"],
  ["Mysore", "Mysuru", "Karnataka"],
  ["Someunknowntown, Kerala", "Someunknowntown", "Kerala"],
  ["Someunknowntown", "Someunknowntown", null],
  ["Maharahstra", null, "Maharashtra"],
  ["Mangaluru, Karanataka", "Mangaluru", "Karnataka"],
  ["PUNE", "Pune", "Maharashtra"],
  ["", null, null],
];

for (const [input, city, state] of cases) {
  test(`parsePlace(${JSON.stringify(input)})`, () => {
    assert.deepEqual(parsePlace(input), { city, state });
  });
}

test("city table covers 150+ cities", () => {
  assert.ok(CITY_COUNT >= 150, `only ${CITY_COUNT}`);
});
