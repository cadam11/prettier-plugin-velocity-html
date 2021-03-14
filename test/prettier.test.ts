import { format } from "prettier";
import * as fs from "fs";

describe("prettier", () => {
  it("should format", () => {
    const testCase = fs
      .readFileSync(__dirname + "/parser/testCases/testCase01.html")
      .toString();
    const formatted = format(testCase, {
      parser: "velocity-html",
      // pluginSearchDirs: ["./dir-with-plugins"],
      plugins: ["./dist/src"],
    });
    console.log(`formatted\n${formatted}`);
  });
});
