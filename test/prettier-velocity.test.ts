import * as fs from "fs";

import { ChildProcess, spawn } from "child_process";
import { createConnection, Socket } from "net";
import {
  compareScreenshots,
  formatVelocity,
  prepareScreenshotFolder,
  readTestcaseFile,
  takeScreenshot,
} from "./testUtils";
import { expect } from "chai";
import { Browser, chromium, Page } from "playwright";

const openSocket = (): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    const client = createConnection("/home/fredo/server.socket", () => {
      resolve(client);
    });
  });
};

const startServer = (): Promise<ChildProcess> => {
  return new Promise((resolve, reject) => {
    const javaProcess = spawn(
      `/home/fredo/.sdkman/candidates/java/current/bin/java`,
      [
        "-jar",
        `${__dirname}/../../test/velocity-java/target/prettier-velocity-1.0-SNAPSHOT.jar`,
      ],
      {}
    );
    const logProcessMessage = (m: Buffer) => {
      console.log(`javaProcess:`, m.toString());
    };
    if (javaProcess == null) {
      throw new Error("foo");
    }
    javaProcess.stdout.on("data", (data) => {
      if ((data as Buffer).toString().includes("Waiting for client")) {
        resolve(javaProcess);
      }
    });
    javaProcess.stderr.on("data", logProcessMessage);
    javaProcess.on("close", logProcessMessage);
  });
};

interface RenderVelocityResult {
  success: boolean;
  message: string;
  renderedTemplate: string;
}

describe("prettier-velocity", () => {
  let velocityServer: ChildProcess;
  let velocityClient: Socket;
  let browser: Browser;
  let page: Page;

  const renderVelocity = (
    testCaseName: string,
    template: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const dataHandler = (data: Buffer): void => {
        const result = JSON.parse(data.toString()) as RenderVelocityResult;
        velocityClient.off("data", dataHandler);
        velocityClient.off("close", closeHandler);
        velocityClient.off("end", endHandler);
        if (result.success) {
          resolve(result.renderedTemplate);
        } else {
          reject(result.message);
        }
      };
      velocityClient.on("data", dataHandler);
      const closeHandler = (had_error: boolean): void =>
        console.log("had_error", had_error);
      velocityClient.on("close", closeHandler);
      const endHandler = () => console.log("end");
      velocityClient.on("end", endHandler);
      const contextScriptPath = `${__dirname}/parser/valid_velocity/${testCaseName.replace(
        ".vm",
        ".groovy"
      )}`;

      velocityClient.write(
        JSON.stringify({
          template,
          contextScriptPath: fs.existsSync(contextScriptPath)
            ? contextScriptPath
            : null,
        })
      );
    });
  };

  before(async () => {
    prepareScreenshotFolder();
    velocityServer = await startServer();
    velocityClient = await openSocket();
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  after(async () => {
    if (browser != null) {
      await browser.close();
    }
    velocityServer.kill();
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

        const numberOfMismatchedPixels = compareScreenshots(
          await takeScreenshot(
            page,
            `${testCaseName}_velocity`,
            await renderVelocity(testCaseName, formattedTemplate)
          ),
          await takeScreenshot(
            page,
            `${testCaseName}`,
            await renderVelocity(testCaseName, template)
          ),
          `${testCaseName}_diff`
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
