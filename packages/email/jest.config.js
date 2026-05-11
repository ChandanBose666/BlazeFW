/** @type {import("jest").Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    // diagnostics: false — ts-jest's program-wide type-check otherwise trips
    // TS6059 on the raw-`.ts` `@blazefw/primitives` entry point (it sits
    // outside this package's rootDir). Source types are still enforced by the
    // package's `build` script (`tsc --noEmit`). Matches @blazefw/web's config.
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, diagnostics: false }],
  },
};
