import { CommonToken, Recognizer } from "antlr4ts";
import { ATNSimulator } from "antlr4ts/atn/ATNSimulator";

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
}
