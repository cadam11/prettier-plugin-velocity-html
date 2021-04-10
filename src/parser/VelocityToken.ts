import { CommonToken, Recognizer } from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";
import { VelocityHtmlLexer } from "./generated/VelocityHtmlLexer";
import { ParserException } from "./parser";

export class VelocityToken extends CommonToken {
  public isInsideString = false;

  public toVelocityString<TSymbol, ATNInterpreter extends ATNSimulator>(
    recognizer: Recognizer<TSymbol, ATNInterpreter> | undefined
  ): string {
    let stringRepresentation = super.toString(recognizer);
    if (this.isInsideString) {
      stringRepresentation = stringRepresentation.replace(
        "]",
        ", insideString]"
      );
    }
    return stringRepresentation;
  }

  get textValue(): string {
    switch (this.type) {
      case VelocityHtmlLexer.HTML_STRING:
        return this.text != null
          ? this.text.substring(1, this.text.length - 1)
          : "";
      case VelocityHtmlLexer.HTML_NAME:
      case VelocityHtmlLexer.HTML_TEXT:
      case VelocityHtmlLexer.COMMENT:
      case VelocityHtmlLexer.DOCTYPE_TYPE:
        return this.text != null ? this.text : "";
      default:
        throw new ParserException(this);
    }
  }
}
