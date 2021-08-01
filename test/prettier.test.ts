import { format } from "prettier";
import { expect } from "chai";
import * as fs from "fs";
import { Browser, chromium, Page } from "playwright";

// TODO False negatives when --timeout is not set.
import {
  takeScreenshot,
  compareScreenshots,
  formatHtml,
  formatVelocity,
  readTestcaseFile,
  prepareScreenshotFolder,
} from "./testUtils";

describe("prettier", () => {
  let browser: Browser;
  let page: Page;
  ([] as [string, string][]).forEach(([input, expectedOutput]) => {
    it(`should format ${input}`, () => {
      const formatted = format(input);
      expect(formatted).to.equal(expectedOutput);
    });
  });

  before(async () => {
    prepareScreenshotFolder();
    browser = await chromium.launch({
      headless: true,
    });
    const browserContext = await browser.newContext({
      viewport: {
        height: 2000,
        width: 1000,
      },
    });
    page = await browserContext.newPage();
  });

  after(async () => {
    if (browser != null) {
      await browser.close();
    }
  });

  it("should have pixel mismatch", async () => {
    const testCaseName = "negative_pixel_test";
    expect(
      compareScreenshots(
        await takeScreenshot(
          page,
          `${testCaseName}_velocity`,
          "<p>foo<span>bar</span></p>"
        ),
        await takeScreenshot(
          page,
          `${testCaseName}_prettier`,
          "<p>foo <span>bar</span></p>"
        ),
        `${testCaseName}_diff`
      )
    ).to.not.equal(0);
  });

  fs.readdirSync(__dirname + "/parser/invalid_html").forEach((testCaseName) => {
    it(`should not process ${testCaseName}`, () => {
      const [input, expectedOutput, options] = readTestcaseFile(
        __dirname + "/parser/invalid_html/" + testCaseName
      );

      let hasError = false;

      try {
        formatVelocity(input, options);
      } catch (e: unknown) {
        hasError = true;
        if (e instanceof Error) {
          // eslint-disable-next-line no-control-regex
          expect(e.message.replace(/\u001b\[.*?m/g, "")).to.equal(
            expectedOutput
          );
        } else {
          throw new Error(`Unknown error type ${typeof e}`);
        }
      }

      expect(hasError).to.be.true;
    });
  });

  fs.readdirSync(__dirname + "/parser/valid_html/").forEach((testCaseName) => {
    it(`should format ${testCaseName}`, async () => {
      const [input, expectedOutput, options] = readTestcaseFile(
        __dirname + "/parser/valid_html/" + testCaseName
      );
      const formatted = formatVelocity(input, options);

      const prettierFormatted = formatHtml(input);

      const numberOfMismatchedPixels = compareScreenshots(
        await takeScreenshot(page, `${testCaseName}_velocity`, formatted),
        await takeScreenshot(
          page,
          `${testCaseName}_prettier`,
          prettierFormatted
        ),
        `${testCaseName}_diff`
      );

      // Comparing strings prints a very good diff.
      expect(formatted).to.equal(
        expectedOutput,
        `Expected does not match actual. Rendered output is equal to prettier? ${
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          numberOfMismatchedPixels === 0
        }`
      );
      expect(numberOfMismatchedPixels).to.equal(0);
    });
  });
});
