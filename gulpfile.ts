import * as gulp from "gulp";
import * as tsc from "gulp-typescript";
import * as sourcemaps from "gulp-sourcemaps";
import del from "del";
import exec from "child_process";
import logger from "fancy-log";

const TARGET_PATH = "dist";
const SOURCE_PATH = "src";
const TS_SOURCE_FILES = SOURCE_PATH + "/**/*.ts";
const GENERATED_PARSER_FILES = SOURCE_PATH + "/parser/generated";
const GRAMMAR_FILE = SOURCE_PATH + "/parser/VelocityHtmlParser.g4";

const tsProject = tsc.createProject("tsconfig.json");

function execWithPromise(cmd: string): Promise<unknown> {
  logger(`Executing "${cmd}"`);
  return new Promise((resolve, reject) => {
    exec.exec(cmd, (error, stdout, stderr) => {
      const isError = error || stderr;
      if (isError) {
        reject(error || stderr);
      } else {
        resolve(stdout);
      }
    });
  });
}

function clean() {
  return del([TARGET_PATH, GENERATED_PARSER_FILES]);
}

const ANTLR_CMD = `./node_modules/.bin/antlr4ts -Dlanguage=JavaScript -Xexact-output-dir -o ${GENERATED_PARSER_FILES}`;

function generateParser(): Promise<unknown> {
  return execWithPromise(
    `${ANTLR_CMD} -no-listener -no-visitor ${SOURCE_PATH}/parser/VelocityHtmlLexer.g4`
  ).then(() =>
    execWithPromise(`${ANTLR_CMD} -no-listener -visitor ${GRAMMAR_FILE}`)
  );
}

function build() {
  const tsResult = tsProject.src().pipe(sourcemaps.init()).pipe(tsProject());

  tsResult.dts.pipe(gulp.dest(TARGET_PATH));

  return tsResult.js
    .pipe(sourcemaps.write(".", { sourceRoot: "./", includeContent: false }))
    .pipe(gulp.dest(TARGET_PATH));
}

function watch() {
  return gulp.watch([TS_SOURCE_FILES], gulp.series("build-compile"));
}

const allGenerateParser = gulp.series(clean, generateParser);

export { clean, build, allGenerateParser as generateParser };
export default gulp.series(clean, generateParser, build);
