/* prettierPlugins */

// This is the library entry point

import { Plugin } from "prettier";
import { HtmlTagNode } from "./parser/VelocityParserNodes";
import parseVelocityHtml from "./parser/parser";
import { preprocess } from "./preprocess";
import { embed } from "./embed";
import printer from "./printer";

const plugin: Plugin = {
  parsers: {
    "velocity-html": {
      parse: parseVelocityHtml,
      astFormat: "velocity-html-ast",
      locStart: function (node: HtmlTagNode): number {
        return node.startLocation.line;
      },
      locEnd: function (node: HtmlTagNode): number {
        return node.endLocation != null ? node.endLocation.line : 0;
      },
    },
  },
  printers: {
    // TODO No preprocess in types?
    "velocity-html-ast": {
      print: printer,
      embed,
      preprocess,
    } as any,
  },
  languages: [
    {
      name: "Velocity+HTML",
      parsers: ["velocity-html"],
      extensions: [".vm"],
    },
  ],
};

export const languages = plugin.languages;

export const parsers = plugin.parsers;

export const printers = plugin.printers;

if (typeof (globalThis as any).prettierPlugins == "undefined") {
  (globalThis as any).prettierPlugins = {
    "velocity-html": {
      parsers: plugin.parsers!,
      languages: plugin.languages,
      printers: plugin.printers,
    },
  };
}
