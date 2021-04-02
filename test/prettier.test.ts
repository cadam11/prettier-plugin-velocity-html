import { format } from "prettier";
import { expect } from "chai";
import * as fs from "fs";

describe("prettier", () => {
  ([] as [string, string][]).forEach(([input, expectedOutput]) => {
    it(`should format ${input}`, () => {
      const formatted = format(input, {
        parser: "velocity-html",
        // pluginSearchDirs: ["./dir-with-plugins"],
        plugins: ["./dist/src"],
      });
      expect(formatted).to.equal(expectedOutput);
    });
  });

  fs.readdirSync(__dirname + "/parser/testCases/").forEach((testCaseName) => {
    it(`should format ${testCaseName}`, () => {
      const testCaseContent = fs
        .readFileSync(__dirname + "/parser/testCases/" + testCaseName)
        .toString();
      const [input, expectedOutput] = testCaseContent.split(
        "\n" +
          "=====================================output=====================================" +
          "\n"
      );
      const formatted = format(input, {
        parser: "velocity-html",
        // pluginSearchDirs: ["./dir-with-plugins"],
        plugins: ["./dist/src"],
      });
      expect(formatted).to.equal(expectedOutput);
    });
  });
});
