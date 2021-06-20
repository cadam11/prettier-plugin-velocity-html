import { format, Options } from "prettier";
import { expect } from "chai";
import * as fs from "fs";
import { Browser, chromium } from "playwright";
import * as path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { openSync } from "temp";
import { execSync } from "child_process";

const sleep = async (time: number) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), time);
  });
};

const formatHtml = (input: string): string => {
  return format(input, {
    parser: "html",
  });
};

const formatVelocity = (
  input: string,
  options: Options | undefined
): string => {
  return format(input, {
    parser: "velocity-html",
    // pluginSearchDirs: ["./dir-with-plugins"],
    plugins: ["./dist/src"],
    ...options,
  });
};

const renderVelocity = (
  testCaseName: string,
  formattedTemplate: string
): string => {
  const velocityTemplate = openSync("prettier-velocity");
  fs.writeFileSync(velocityTemplate.path, formattedTemplate);
  return execSync(
    `java -jar ${__dirname}/../../test/velocity-java/target/prettier-velocity-1.0-SNAPSHOT.jar ` +
      `${velocityTemplate.path} ` +
      `${__dirname}/parser/valid_velocity/${testCaseName.replace(
        ".vm",
        ".groovy"
      )}`
  ).toString();
};

describe("prettier", () => {
  let browser: Browser;
  ([] as [string, string][]).forEach(([input, expectedOutput]) => {
    it(`should format ${input}`, () => {
      const formatted = format(input);
      expect(formatted).to.equal(expectedOutput);
    });
  });

  const readTestcaseFile = (path: string): [string, string, Options?] => {
    let testCaseContent = fs.readFileSync(path).toString();
    const configSegments = testCaseContent.split(
      "\n" +
        "=====================================input======================================" +
        "\n"
    );
    let config: Options | undefined;
    if (configSegments.length > 1) {
      config = JSON.parse(configSegments[0]);
      testCaseContent = configSegments[1];
    }
    const elements = testCaseContent.split(
      "\n" +
        "=====================================output=====================================" +
        "\n"
    );
    if (elements.length != 2) {
      throw new Error(
        `File ${path} is not valid testcase. It has ${elements.length} elements`
      );
    }
    return [elements[0], elements[1], config];
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

      const testCasePath = path.join(SCREENSHOT_FOLDER, testCaseName);

      const prettierFormatted = formatHtml(input);

      const numberOfMismatchedPixels = compareScreenshots(
        await takeScreenshot(`${testCasePath}_velocity`, formatted),
        await takeScreenshot(`${testCasePath}_prettier`, prettierFormatted),
        `${testCasePath}_diff.png`
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

  fs.readdirSync(__dirname + "/parser/valid_velocity/").forEach(
    (testCaseName) => {
      if (testCaseName.endsWith(".groovy")) {
        return;
      }
      if (!testCaseName.endsWith(".vm")) {
        throw new Error(`${testCaseName} must end with .groovy or .vm`);
      }
      it(`should format ${testCaseName}`, async () => {
        const [template, expectedOutput, options] = readTestcaseFile(
          __dirname + "/parser/valid_velocity/" + testCaseName
        );

        const formattedTemplate = formatVelocity(template, options);

        const testCasePath = path.join(SCREENSHOT_FOLDER, testCaseName);

        const numberOfMismatchedPixels = compareScreenshots(
          await takeScreenshot(
            `${testCasePath}_velocity`,
            renderVelocity(testCaseName, formattedTemplate)
          ),
          await takeScreenshot(
            `${testCasePath}`,
            renderVelocity(testCaseName, template)
          ),
          `${testCasePath}_diff.png`
        );

        // Comparing strings prints a very good diff.
        expect(formatVelocity(template, options)).to.equal(
          expectedOutput,
          `Expected does not match actual. Rendered output is equal to prettier? ${
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            numberOfMismatchedPixels === 0
          }`
        );
        expect(numberOfMismatchedPixels).to.equal(0);
      });
    }
  );
});
