import { format, Options } from "prettier";
import * as fs from "fs";
import * as process from "process";
import * as path from "path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { Page } from "playwright";

export const SCREENSHOT_FOLDER = path.join(
  process.cwd(),
  "dist",
  "test",
  "screenshots"
);

export const prepareScreenshotFolder = (): void => {
  if (!fs.existsSync(SCREENSHOT_FOLDER)) {
    fs.mkdirSync(SCREENSHOT_FOLDER);
  }
};

export const sleep = async (timeInMs: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), timeInMs);
  });
};

export const formatHtml = (input: string): string => {
  return format(input, {
    parser: "html",
  });
};

export const formatVelocity = (
  input: string,
  options: Options | undefined
): string => {
  return format(input, {
    parser: "velocity-html",
    // pluginSearchDirs: ["./dir-with-plugins"],
    plugins: [`${__dirname}/../src`],
    ...options,
  });
};

export const readTestcaseFile = (path: string): [string, string, Options?] => {
  let testCaseContent = fs.readFileSync(path).toString();
  const configSegments = testCaseContent.split(
    "\n" +
      "=====================================input======================================" +
      "\n"
  );
  let config: Options | undefined;
  if (configSegments.length > 1) {
    config = JSON.parse(configSegments[0]) as Options;
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

export const compareScreenshots = (
  path1: string,
  path2: string,
  prefix: string
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

  const diffPath = path.join(SCREENSHOT_FOLDER, `${prefix}.png`);

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return numberOfMismatchedPixels;
};

export const takeScreenshot = async (
  page: Page,
  prefix: string,
  html: string
): Promise<string> => {
  const htmlPath = path.join(SCREENSHOT_FOLDER, `${prefix}.html`);
  fs.writeFileSync(htmlPath, html);
  await page.goto(`file://${htmlPath}`);
  const isContentTooLong = await page.evaluate(
    "Math.max(document.body.offsetHeight, document.body.clientHeight, document.body.scrollHeight) > window.innerHeight"
  );

  // Chrome shows a short loading spinner inside video elements. It cannot be paused() (only thing I have tried), therefore we wait until it is hopefully done.
  // If we don't wait the screenshot comparision won't work.
  if (html.includes("<video")) {
    await sleep(2000);
  }
  const screenshotPath = path.join(SCREENSHOT_FOLDER, `${prefix}.png`);
  await page.screenshot({ path: screenshotPath });
  if (isContentTooLong == true) {
    throw new Error(`Content of ${prefix} is too long.`);
  }
  return screenshotPath;
};
