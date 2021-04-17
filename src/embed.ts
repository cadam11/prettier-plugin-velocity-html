import { doc, Doc, FastPath, Options, ParserOptions } from "prettier";
import { AttributeNode, ParserNode } from "./parser/VelocityParserNodes";

const {
  fill,
  concat,
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
          parser: "css",
          __isHTMLStyleAttribute: true,
          __embeddedInHtml: true,
        } as any,
        // TODO Scheduled for removal
        { stripTrailingHardline: true }
      );
    }
    if (doc != null) {
      return concat([
        node.name,
        '="',
        group(concat([indent(concat([softline, doc])), softline])),
        '"',
      ]);
    }
  }
  return null;
};
