import { doc, Doc, FastPath, Options, ParserOptions } from "prettier";
import {
  AttributeNode,
  HtmlTagNode,
  HtmlTextNode,
  ParserNode,
} from "./parser/VelocityParserNodes";
import { concatChildren, printClosingTag, printOpeningTag } from "./printer";

const { concat, breakParent, group } = doc.builders;

const CSS_PARSER_OPTIONS = {
  parser: "css",
  __isHTMLStyleAttribute: true,
  __embeddedInHtml: true,
};

const JS_PARSER_OPTIONS = {
  parser: "babel",
  __embeddedInHtml: true,
  __babelSourceType: "script",
};

// TODO Type for textToDocOptions

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
      return group(concat([node.name, '="', concatChildren(node, doc), '"']));
    }
  } else if (node instanceof HtmlTagNode) {
    if (node.tagName == "script" || node.tagName === "style") {
      const scriptText = node.children
        .map((child) => {
          if (!(child instanceof HtmlTextNode)) {
            throw new Error(`Unexpected type ${child.toString()}`);
          }
          return child.text;
        })
        .join(" ");

      const parserOptions = inferParserOptions(node);

      const doc =
        scriptText != "" && parserOptions != null
          ? textToDoc(
              scriptText,
              {
                ...parserOptions,
              },
              // TODO Scheduled for removal
              { stripTrailingHardline: true }
            )
          : scriptText;

      return concat([
        breakParent,
        printOpeningTag(node, path, print),
        concatChildren(node, doc),
        printClosingTag(node),
      ]);
    }
  }
  return null;
};

function inferParserOptions(node: HtmlTagNode): any | null {
  if (node.tagName === "style") {
    return CSS_PARSER_OPTIONS;
  } else {
    if (node.scriptParser === "babel") {
      return JS_PARSER_OPTIONS;
    } else {
      return null;
    }
  }
}
