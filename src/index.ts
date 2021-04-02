// This is the library entry point

import { Plugin } from "prettier";
import { HtmlTagNode } from "./parser/Node";
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
        return node.locationStart;
      },
      locEnd: function (node: HtmlTagNode): number {
        return node.closeTag.locationStart;
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
