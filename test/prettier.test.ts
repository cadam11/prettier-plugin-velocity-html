import { format } from "prettier";
import { expect } from "chai";
import * as fs from "fs";
import { Browser, chromium } from "playwright";
import * as path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const sleep = async (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), time);
  });
};

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

  const readTestcaseFile = (path: string): [string, string] => {
    const testCaseContent = fs.readFileSync(path).toString();
    const elements = testCaseContent.split(
      "\n" +
        "=====================================output=====================================" +
        "\n"
    );
    if (elements.length != 2) {
      throw new Error(`File ${path} is not valid testcase`);
    }
    return [elements[0], elements[1]];
  };

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

  after(async () => {
    await browser.close();
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
    // Chrome shows a short loading spinner inside video elements. It cannot be paused() (only thing I have tried), therefore we wait until it is hopefully done.
    // If we don't wait the screenshot comparision won't work.
    if (html.includes("<video")) {
      await sleep(2000);
    }
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

  fs.readdirSync(__dirname + "/parser/invalid_html").forEach((testCaseName) => {
    it.only(`should not process ${testCaseName}`, () => {
      const [input, expectedOutput] = readTestcaseFile(
        __dirname + "/parser/invalid_html/" + testCaseName
      );

      try {
        format(input, {
          parser: "velocity-html",
          // pluginSearchDirs: ["./dir-with-plugins"],
          plugins: ["./dist/src"],
        });
      } catch (e: unknown) {
        if (typeof e === "string") {
          expect(e).to.match(new RegExp(expectedOutput));
        } else {
          throw new Error(`Unknown error type ${typeof e}`);
        }
      }
    });
  });

  fs.readdirSync(__dirname + "/parser/valid_html/").forEach((testCaseName) => {
    it(`should format ${testCaseName}`, async () => {
      const [input, expectedOutput] = readTestcaseFile(
        __dirname + "/parser/testCases/" + testCaseName
      );
      const formatted = format(input, {
        parser: "velocity-html",
        // pluginSearchDirs: ["./dir-with-plugins"],
        plugins: ["./dist/src"],
      });

      const pathWithoutExtension = path.join(SCREENSHOT_FOLDER, testCaseName);

      const prettierFormatted = format(input, {
        parser: "html",
      });

      const numberOfMismatchedPixels = compareScreenshots(
        await takeScreenshot(`${pathWithoutExtension}_velocity`, formatted),
        await takeScreenshot(
          `${pathWithoutExtension}_prettier`,
          prettierFormatted
        ),
        `${pathWithoutExtension}_diff.png`
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
