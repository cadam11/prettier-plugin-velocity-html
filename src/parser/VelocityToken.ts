import { CommonToken, Recognizer } from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";

export function isCollapsbileWhitespaceOnly(text: string): boolean {
  // There are many whitespace characters that we don't want to collapse.
  // See https://en.wikipedia.org/wiki/Whitespace_character
  return /^[ \t\n\r\f]+$/.exec(text) != null;
}
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

  get isWhitespaceOnly(): boolean {
    return isCollapsbileWhitespaceOnly(this.textValue);
  }

  get stringValue(): string {
    return this.text != null
      ? this.text.startsWith('"') || this.text.startsWith("'")
        ? this.text.substring(1, this.text.length - 1)
        : this.text
      : "";
  }

  get textValue(): string {
    return this.text != null ? this.text : "";
  }
}
