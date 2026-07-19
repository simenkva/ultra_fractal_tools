import assert from "node:assert/strict";
import test from "node:test";

import {
  UF6_CATALOG,
  ULTRA_FRACTAL_VERSION,
  type CatalogGroup,
} from "../catalog/uf6";

const assertGroup = (name: string, value: CatalogGroup<unknown>): void => {
  assert.equal(value.ultraFractalVersion, ULTRA_FRACTAL_VERSION, `${name} version`);
  assert.ok(value.values.length > 0, `${name} must not be empty`);
  assert.ok(value.sources.length > 0, `${name} must have a source`);

  for (const source of value.sources) {
    assert.match(source.url, /^https:\/\/www\.ultrafractal\.com\/help\//);
    assert.ok(source.title.length > 0);
  }

  const strings = value.values.filter(
    (item): item is string => typeof item === "string",
  );
  assert.equal(
    new Set(strings.map((item) => item.toLocaleLowerCase("en-US"))).size,
    strings.length,
    `${name} must be case-insensitively unique`,
  );
};

void test("UF6 catalog groups are versioned, sourced, and unique", () => {
  const groups: ReadonlyArray<readonly [string, CatalogGroup<unknown>]> = [
    ["primitiveTypes", UF6_CATALOG.primitiveTypes],
    ["builtInClasses", UF6_CATALOG.builtInClasses],
    ["reservedKeywords", UF6_CATALOG.reservedKeywords],
    ["semiReservedKeywords", UF6_CATALOG.semiReservedKeywords],
    ["contextualClassWords", UF6_CATALOG.contextualClassWords],
    ["controlFlowKeywords", UF6_CATALOG.controlFlowKeywords],
    ["blockKeywords", UF6_CATALOG.blockKeywords],
    ["compilerDirectives", UF6_CATALOG.compilerDirectives],
    ["builtInFunctions", UF6_CATALOG.builtInFunctions],
    ["predefinedSymbols", UF6_CATALOG.predefinedSymbols],
    ["settings", UF6_CATALOG.settings],
    ["sectionOrders.ufm", UF6_CATALOG.sectionOrders.ufm],
    ["sectionOrders.ucl", UF6_CATALOG.sectionOrders.ucl],
    ["sectionOrders.uxf", UF6_CATALOG.sectionOrders.uxf],
    ["sectionOrders.ulb", UF6_CATALOG.sectionOrders.ulb],
    ["defaultSettingsByFileType.ufm", UF6_CATALOG.defaultSettingsByFileType.ufm],
    ["defaultSettingsByFileType.ucl", UF6_CATALOG.defaultSettingsByFileType.ucl],
    ["defaultSettingsByFileType.uxf", UF6_CATALOG.defaultSettingsByFileType.uxf],
  ];

  for (const [name, group] of groups) {
    assertGroup(name, group);
  }
});

void test("UF6 catalog contains the documented core inventories", () => {
  assert.equal(UF6_CATALOG.version, "6");
  assert.equal(UF6_CATALOG.builtInFunctions.values.length, 72);
  assert.equal(UF6_CATALOG.predefinedSymbols.values.length, 26);
  assert.equal(UF6_CATALOG.settings.values.length, 28);
  assert.deepEqual(UF6_CATALOG.sectionOrders.ufm.values[0]?.sections, [
    "global",
    "builtin",
    "init",
    "loop",
    "bailout",
    "perturbinit",
    "perturbloop",
    "default",
    "switch",
  ]);
  assert.deepEqual(UF6_CATALOG.sectionOrders.ucl.values[0]?.sections, [
    "global",
    "init",
    "loop",
    "final",
    "default",
  ]);
  assert.deepEqual(UF6_CATALOG.sectionOrders.uxf.values[0]?.sections, [
    "global",
    "transform",
    "default",
  ]);
  assert.deepEqual(UF6_CATALOG.sectionOrders.ulb.values[0]?.sections, [
    "public",
    "protected",
    "private",
    "default",
  ]);
  assert.equal(UF6_CATALOG.sectionOrders.ulb.values[0]?.ordered, true);
});
