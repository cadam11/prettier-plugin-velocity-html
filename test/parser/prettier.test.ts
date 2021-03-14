import { format } from "prettier";
import * as fs from "fs";

describe("prettier", () => {
  it("should format", () => {
    const testCase = fs
      .readFileSync(__dirname + "/testCases/testCase01.html")
      .toString();
    format(testCase, {
      parser: "velocity-html",
      // pluginSearchDirs: ["./dir-with-plugins"],
      plugins: ["../../src/"],
    });
  });
});
