import { CharStream, CommonTokenFactory, TokenSource } from "antlr4ts";
import { Interval } from "antlr4ts/misc/Interval";
import { VelocityHtmlLexer } from "./generated/VelocityHtmlLexer";
import { VelocityToken } from "./VelocityToken";

export class VelocityTokenFactory extends CommonTokenFactory {
  public constructor(private lexer: VelocityHtmlLexer) {
    super();
  }
  public create(
    source: {
      source?: TokenSource;
      stream?: CharStream;
    },
    type: number,
    text: string | undefined,
    channel: number,
    start: number,
    stop: number,
    line: number,
    charPositionInLine: number
  ): VelocityToken {
    const t = new VelocityToken(type, text, source, channel, start, stop);
    t.line = line;
    t.charPositionInLine = charPositionInLine;
    if (text == null && this.copyText && source.stream != null) {
      t.text = source.stream.getText(Interval.of(start, stop));
    }
    t.isInsideString = this.lexer.isVtlReferenceInsideString;
    this.lexer.isVtlReferenceInsideString = false;

    return t;
  }
}
