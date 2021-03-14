// This is the library entry point

import { Doc, FastPath } from "prettier";
import { HtmlTagNode } from "./parser/Node";
import parseVelocityHtml from "./parser/parser";

export default {
  languages: [
    {
      name: "Velocity+HTML",
      parsers: ["velocity-html"],
      extensions: [".vm"],
    },
  ],
  parsers: {
    "velocity-html": parseVelocityHtml,
    astFormat: "velocity-html-ast",
    locStart: function (node: HtmlTagNode): number {
      return node.locationStart;
    },
    locEnd: function (node: HtmlTagNode): number {
      return node.closeTag.locationStart;
    },
  },
  printers: {
    "velocity-html-ast": {
      print: function (
        path: FastPath,
        options: object,
        print: (path: FastPath) => Doc
      ): Doc {
        const node = path.getValue();

        // if (Array.isArray(node)) {
        //   return builders.concat(path.map(print));
        // }
        return node.value;
      },
    },
  },
};
