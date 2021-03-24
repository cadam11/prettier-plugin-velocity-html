import { format } from "prettier";
import * as fs from "fs";
import { expect } from "chai";

describe("prettier", () => {
  ([
    [
      "<input name=address maxlength=200>",
      `<input name="address" maxlength="200">`,
    ],
    [
      "<input name='address' maxlength='200'>",
      `<input name="address" maxlength="200">`,
    ],
  ] as [string, string][]).forEach(([input, expectedOutput]) => {
    it(`should format ${input}`, () => {
      const formatted = format(input, {
        parser: "velocity-html",
        // pluginSearchDirs: ["./dir-with-plugins"],
        plugins: ["./dist/src"],
      });
      expect(formatted).to.equal(expectedOutput);
    });
  });

  // it("should format", () => {
  //   const testCase = fs
  //     .readFileSync(__dirname + "/parser/testCases/testCase01.html")
  //     .toString();
  //   const formatted = format(testCase, {
  //     parser: "velocity-html",
  //     // pluginSearchDirs: ["./dir-with-plugins"],
  //     plugins: ["./dist/src"],
  //   });
  //   console.log(`formatted\n${formatted}`);
  // });
});
