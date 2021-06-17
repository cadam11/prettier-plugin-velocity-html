import { CommonToken, Recognizer } from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";

export function isCollapsibleWhitespaceOnly(text: string): boolean {
  // There are many whitespace characters that we don't want to collapse.
  // See https://en.wikipedia.org/wiki/Whitespace_character
  return /^[ \t\n\r\f]+$/.exec(text) != null;
}

export const NEWLINE_REGEX = /\r\n|\r|\n/;

// Both are 1-based
export interface SourceCodeLocation {
  line: number;
  column: number;
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
    return isCollapsibleWhitespaceOnly(this.textValue);
  }

  get stringValue(): string {
    return this.text != null
      ? this.text.startsWith('"') || this.text.startsWith("'")
        ? this.text.substring(1, this.text.length - 1)
        : this.text
      : "";
  }

  get startLocation(): SourceCodeLocation {
    return {
      line: this.line,
      column: this.charPositionInLine + 1,
    };
  }

  get endLocation(): SourceCodeLocation {
    const lines = this.textValue.split(NEWLINE_REGEX);
    if (lines.length == 1) {
      return {
        line: this.line,
        column: this.charPositionInLine + this.textValue.length + 1,
      };
    } else {
      return {
        line: this.line + (lines.length - 1),
        column: this.charPositionInLine + lines[lines.length - 1].length + 1,
      };
    }
  }

  get textValue(): string {
    return this.text != null ? this.text : "";
  }
}
