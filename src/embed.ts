import { doc, Doc, FastPath, Options, ParserOptions } from "prettier";
import {
  AttributeNode,
  HtmlTagNode,
  HtmlTextNode,
  ParserNode,
} from "./parser/VelocityParserNodes";
import { concatChildren, printClosingTag, printOpeningTag } from "./printer";

const {
  fill,
  concat,
  breakParent,
  hardline,
  softline,
  join,
  group,
  indent,
  line,
} = doc.builders;

export const embed = (
  path: FastPath<ParserNode>,
  print: (path: FastPath<ParserNode>) => Doc,
  textToDoc: (text: string, options: Options, textToDocOptions: any) => Doc,
  options: ParserOptions
): Doc | null => {
  const node = path.getValue();

  if (node instanceof AttributeNode) {
    let doc: Doc | null = null;
    if (node.name === "style") {
      doc = textToDoc(
        node.value!,
        {
          ...options,
          parser: "css",
          __isHTMLStyleAttribute: true,
          __embeddedInHtml: true,
        } as any,
        // TODO Scheduled for removal
        { stripTrailingHardline: true }
      );
    }
    if (doc != null) {
      return concat([node.name, '="', concatChildren(doc), '"']);
    }
  } else if (node instanceof HtmlTagNode) {
    if (node.tagName == "script") {
      const scriptText = node.children
        .map((child) => {
          if (!(child instanceof HtmlTextNode)) {
            throw new Error(`Unexpected type ${child.toString()}`);
          }
          return child.text;
        })
        .join(" ");

      const doc =
        scriptText !== ""
          ? textToDoc(
              scriptText,
              {
                ...options,
                parser: "babel",
                __embeddedInHtml: true,
                __babelSourceType: "script",
              } as any,
              // TODO Scheduled for removal
              { stripTrailingHardline: true }
            )
          : "";
      return concat([
        breakParent,
        printOpeningTag(node, path, print),
        concatChildren(doc),
        printClosingTag(node),
      ]);
    }
  }
  return null;
};
