import { format } from "prettier";
import { expect } from "chai";
import * as fs from "fs";
import { Browser, BrowserContext, chromium } from "playwright";
import * as path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

describe("prettier", () => {
  let browser: Browser;
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

  before(async () => {
    if (!fs.existsSync(SCREENSHOT_FOLDER)) {
      fs.mkdirSync(SCREENSHOT_FOLDER);
    }
    browser = await chromium.launch({ headless: true });
  });

  afterEach(async () => {
    await Promise.all(
      browser
        .contexts()
        .map((context) =>
          Promise.all(context.pages().map((page) => page.close()))
        )
    );
  });

  const SCREENSHOT_FOLDER = path.join(
    process.cwd(),
    "dist",
    "test",
    "screenshots"
  );

  const takeScreenshot = async (
    pathWithoutExtension: string,
    html: string
  ): Promise<string> => {
    const htmlPath = `${pathWithoutExtension}.html`;
    fs.writeFileSync(htmlPath, html);
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`);
    const screenshotPath = `${pathWithoutExtension}.png`;
    await page.screenshot({ path: screenshotPath });
    await page.close();
    return screenshotPath;
  };

  const compareScreenshots = (
    path1: string,
    path2: string,
    diffPath: string
  ): number => {
    const png1 = PNG.sync.read(fs.readFileSync(path1));
    const png2 = PNG.sync.read(fs.readFileSync(path2));
    const { width, height } = png1;
    const diff = new PNG({ width, height });

    const numberOfMismatchedPixels = pixelmatch(
      png1.data,
      png2.data,
      diff.data,
      width,
      height,
      {
        threshold: 0,
      }
    );

    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    return numberOfMismatchedPixels;
  };

  it("should have pixel mismatch", async () => {
    const pathWithoutExtension = path.join(
      SCREENSHOT_FOLDER,
      "negative_pixel_test"
    );
    expect(
      compareScreenshots(
        await takeScreenshot(
          `${pathWithoutExtension}_velocity`,
          "<p>foo<span>bar</span></p>"
        ),
        await takeScreenshot(
          `${pathWithoutExtension}_prettier`,
          "<p>foo <span>bar</span></p>"
        ),
        `${pathWithoutExtension}_diff.png`
      )
    ).to.not.equal(0);
  });

  fs.readdirSync(__dirname + "/parser/testCases/").forEach((testCaseName) => {
    it(`should format ${testCaseName}`, async () => {
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

      const pathWithoutExtension = path.join(SCREENSHOT_FOLDER, testCaseName);

      const prettierFormatted = format(input, {
        parser: "html",
      });

      expect(
        compareScreenshots(
          await takeScreenshot(`${pathWithoutExtension}_velocity`, formatted),
          await takeScreenshot(
            `${pathWithoutExtension}_prettier`,
            prettierFormatted
          ),
          `${pathWithoutExtension}_diff.png`
        )
      ).to.equal(0);
    });
  });
});
