// This is the library entry point

import { Doc, FastPath, doc } from "prettier";
import { HtmlTagNode } from "./parser/Node";
import parseVelocityHtml from "./parser/parser";
import printer from "./printer";

export const languages = [
  {
    name: "Velocity+HTML",
    parsers: ["velocity-html"],
    extensions: [".vm"],
  },
];

export const parsers = {
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
};

export const printers = {
  "velocity-html-ast": {
    print: printer,
  },
};
