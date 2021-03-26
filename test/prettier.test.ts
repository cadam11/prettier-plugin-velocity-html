import { format } from "prettier";
import { expect } from "chai";
import * as fs from "fs";

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
    [
      '<input name="address" maxlength="200">',
      `<input name="address" maxlength="200">`,
    ],
    ['<div class="foo"></div>', '<div class="foo"></div>'],
    ['<div   class="foo"   ></div>', '<div class="foo"></div>'],
    [
      '<div   class="foo bar"   id="header"   ></div>',
      '<div class="foo bar" id="header"></div>',
    ],
    ["<div data-prettier></div>", "<div data-prettier></div>"],
    ['<div data-prettier="true"></div>', '<div data-prettier="true"></div>'],
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

  fs.readdirSync(__dirname + "/parser/testCases/").forEach((testCaseName) => {
    it(`should format ${testCaseName}`, () => {
      const testCaseContent = fs
        .readFileSync(__dirname + "/parser/testCases/" + testCaseName)
        .toString();
      const [input, expectedOutput] = testCaseContent.split(
        "\n" + "=".repeat(79) + "\n"
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
