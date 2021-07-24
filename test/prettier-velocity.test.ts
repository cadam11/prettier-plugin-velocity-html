import * as fs from "fs";

import { ChildProcess, spawn, SpawnOptions } from "child_process";
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

import * as log4js from "log4js";

const velocityServerLogger = log4js.getLogger("velocity-server");
const velocityClientLogger = log4js.getLogger("velocity-client");
log4js.configure({
  appenders: {
    console: { type: "console" },
  },
  categories: {
    default: { appenders: ["console"], level: "debug" },
  },
});

const VALID_VELOCITY_PATH = `${__dirname}/parser/valid_velocity`;

const openSocket = (): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    const client = createConnection("/home/fredo/server.socket", () => {
      resolve(client);
    });
  });
};

const startServer = (): Promise<ChildProcess> => {
  return new Promise((resolve, reject) => {
    const spawnArgs: [string, readonly string[], SpawnOptions] = [
      `/home/fredo/.sdkman/candidates/java/current/bin/java`,
      [
        "-jar",
        `${__dirname}/../../test/velocity-java/target/prettier-velocity-1.0-SNAPSHOT.jar`,
      ],
      {},
    ];
    velocityServerLogger.info(
      `Starting with ${spawnArgs[0]} ${spawnArgs[1].join(" ")}`
    );
    const javaProcess = spawn.apply(this, spawnArgs);
    if (
      javaProcess == null ||
      javaProcess.stdout == null ||
      javaProcess.stderr == null
    ) {
      throw new Error();
    }
    javaProcess.stdout.on("data", (data) => {
      const text = (data as Buffer).toString();
      velocityServerLogger.info(text);
      if (text.includes("Waiting for client")) {
        resolve(javaProcess);
      }
    });
    javaProcess.stderr.on("data", (error: Buffer) => {
      velocityServerLogger.error(error.toString());
    });
    javaProcess.on("close", () => {
      velocityServerLogger.info("Shutting down");
    });
  });
};

interface RenderVelocityResult {
  success: boolean;
  message: string;
  renderedTemplate: string;
}

interface VelocityCommand {
  name: string;
  template: string;
  contextScriptPath?: string | null;
  resourceLoaderPath?: string[] | null;
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
          velocityClientLogger.info(
            `Received rendered template\n${result.renderedTemplate}`
          );
          resolve(result.renderedTemplate);
        } else {
          velocityClientLogger.error(
            `Error while rendering template ${result.message}`
          );
          reject(result.message);
        }
      };
      velocityClient.on("data", dataHandler);
      const closeHandler = (had_error: boolean): void =>
        velocityClientLogger.error("had_error", had_error);
      velocityClient.on("close", closeHandler);
      const endHandler = () => velocityClientLogger.info("end");
      velocityClient.on("end", endHandler);
      const contextScriptPath = `${VALID_VELOCITY_PATH}/${testCaseName.replace(
        ".vm",
        ".groovy"
      )}`;

      const resourceLoaderPath = [];
      const testCaseResourcePath = `${VALID_VELOCITY_PATH}/${testCaseName.replace(
        ".vm",
        ""
      )}`;
      if (fs.existsSync(testCaseResourcePath)) {
        resourceLoaderPath.push(testCaseResourcePath);
      }
      const groupPath = `${VALID_VELOCITY_PATH}/${testCaseName.split("_")[0]}`;
      if (fs.existsSync(groupPath)) {
        resourceLoaderPath.push(groupPath);
      }

      const command: VelocityCommand = {
        name: testCaseName,
        template,
        contextScriptPath: fs.existsSync(contextScriptPath)
          ? contextScriptPath
          : null,
        resourceLoaderPath,
      };
      const message = JSON.stringify(command);
      velocityClientLogger.info(`Sending message ${message}`);
      velocityClient.write(message);
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
    if (velocityServer != null) {
      velocityServer.kill();
    }
  });

  fs.readdirSync(VALID_VELOCITY_PATH).forEach((testCaseName) => {
    if (testCaseName.endsWith(".groovy")) {
      return;
    }
    const testCasePath = `${VALID_VELOCITY_PATH}/${testCaseName}`;
    if (fs.lstatSync(testCasePath).isDirectory()) {
      return;
    }
    if (!testCaseName.endsWith(".vm")) {
      throw new Error(`${testCaseName} must end with .groovy or .vm`);
    }
    it(`should format ${testCaseName}`, async () => {
      const [template, expectedOutput, options] =
        readTestcaseFile(testCasePath);

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
  });
});
