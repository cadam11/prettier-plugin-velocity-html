import { VelocityToken } from "./VelocityToken";

interface SourceCodeLocation {
  line: number;
  column: number;
}

export abstract class ParserNode {
  public _endToken: VelocityToken | undefined;

  public get endToken(): VelocityToken | undefined {
    return this._endToken;
  }

  public set endToken(token: VelocityToken | undefined) {
    if (this.endToken != null) {
      throw new Error("Cannot set endToken more than once.");
    }
    this._endToken = token;
  }

  public startLocation: SourceCodeLocation;
  protected _endLocation: SourceCodeLocation | undefined;
  public get endLocation(): SourceCodeLocation | undefined {
    return this.endToken != null
      ? {
          column:
            this.endToken.charPositionInLine +
            (this.endToken.text != null ? this.endToken.text.length : 0),
          line: this.endToken.line,
        }
      : this._endLocation;
  }

  constructor(startLocation: SourceCodeLocation | VelocityToken) {
    if (startLocation instanceof VelocityToken) {
      this.startLocation = {
        column: startLocation.charPositionInLine,
        line: startLocation.line,
      };
    } else {
      this.startLocation = startLocation;
    }
  }

  public get prev(): ParserNode | undefined {
    return this.index != null && this.parent != null
      ? this.parent.children[this.index - 1]
      : undefined;
  }
  public get next(): ParserNode | undefined {
    return this.index != null && this.parent != null
      ? this.parent.children[this.index + 1]
      : undefined;
  }
  public get index(): number | undefined {
    return this.parent != null ? this.parent.children.indexOf(this) : undefined;
  }
  public parent: NodeWithChildren | undefined;

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    fn(this, 0, [this]);
  }

  public hasLeadingSpaces = false;
  public hasTrailingSpaces = false;
}

export abstract class NodeWithChildren extends ParserNode {
  public children: ParserNode[] = [];

  public get lastChild(): ParserNode | undefined {
    return this.children[this.children.length - 1];
  }

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    this.children = this.children.map((node) => {
      node.walk(fn);
      return node;
    });
    super.walk(fn);
  }

  public addChild(child: ParserNode): void {
    this.children.push(child);
    child.parent = this;
  }
}

export class AttributeNode extends ParserNode {
  clone(): ParserNode {
    return new AttributeNode(this.nameToken, this.valueToken);
  }
  get name(): string {
    return this.nameToken.textValue;
  }
  get value(): string | undefined {
    return this.valueToken != null ? this.valueToken.textValue : undefined;
  }

  public constructor(
    public nameToken: VelocityToken,
    public valueToken?: VelocityToken
  ) {
    super(nameToken);
  }
}

export class RootNode extends NodeWithChildren {
  clone(): ParserNode {
    return new RootNode();
  }
  public constructor() {
    super({ column: 0, line: 0 });
  }
}

export class HtmlTextNode extends ParserNode {
  public tokens: VelocityToken[] = [];

  public constructor(token: VelocityToken) {
    super(token);
    // Bypass check
    this._endToken = token;
    this.tokens.push(token);
  }

  public get text(): string {
    return this.tokens.map((token) => token.textValue).join("");
  }

  public addText(token: VelocityToken): void {
    // TODO Fix this in a different way
    // if (this.isWhitespaceOnly && !token.isWhitespaceOnly) {
    //   this.text = text;
    //   // Discard leading spaces. It will be trimmed later and then the startLocation is wrong.
    //   this.startLocation = {
    //     column: token.charPositionInLine,
    //     line: token.line,
    //   };
    //   // Bypass check
    //   this._endToken = token;
    // } else {

    // this.text += text;
    this.tokens.push(token);
    // Bypass check
    this._endToken = token;
    // }
  }

  public get isWhitespaceOnly(): boolean {
    return /^\s+$/.exec(this.text) != null;
  }

  public removeTrailingWhitespaceTokens(): boolean {
    const tokens = this.tokens;
    return this.removeWhitespaceTokens(
      (function* () {
        for (let i = tokens.length - 1; i >= 0; i--) {
          yield tokens[i];
        }
      })(),
      (numberOfWhitespaceTokens) => tokens.length - numberOfWhitespaceTokens
    );
  }

  public removeLeadingWhitespace(): boolean {
    const tokens = this.tokens;
    return this.removeWhitespaceTokens(
      (function* () {
        for (let i = 0; i < tokens.length; i++) {
          yield tokens[i];
        }
      })(),
      () => 0
    );
  }

  private removeWhitespaceTokens(
    iterator: Generator<VelocityToken>,
    startIndexFn: (numberOfWhitespaceTokens: number) => number
  ): boolean {
    if (this.isWhitespaceOnly) {
      throw new Error(
        "Cannot remove whitespace tokens on whitespace only text. Result would be the empty string."
      );
    }
    let numberOfTailingWhitespaceTokens = 0;

    let token = iterator.next();
    while (token.done != null && !token.done) {
      if (token.value.isWhitespaceOnly) {
        numberOfTailingWhitespaceTokens++;
        token = iterator.next();
      } else {
        break;
      }
    }
    this.tokens.splice(
      startIndexFn(numberOfTailingWhitespaceTokens),
      numberOfTailingWhitespaceTokens
    );
    this._endToken = this.tokens[this.tokens.length - 1];
    this.startLocation = {
      column: this.tokens[0].charPositionInLine,
      line: this.tokens[0].line,
    };
    return numberOfTailingWhitespaceTokens > 0;
  }
}

export class HtmlTagNode extends NodeWithChildren {
  private selfClosingTags = ["input", "meta", "img", "link"];
  private _tagName: string;
  public isSelfClosing: boolean;
  public hasClosingTag: boolean;
  public attributes: AttributeNode[] = [];

  public constructor(public token: VelocityToken) {
    super(token);
  }

  public set tagName(tagName: string) {
    this._tagName = tagName;
    this.isSelfClosing = this.selfClosingTags.includes(tagName);
  }

  public get tagName(): string {
    return this._tagName != null ? this._tagName : "";
  }

  public addAttribute(key: VelocityToken, value?: VelocityToken): void {
    this.attributes.push(new AttributeNode(key, value));
  }
}

export class HtmlCommentNode extends ParserNode {
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class IeConditionalCommentNode extends NodeWithChildren {
  get text(): string {
    return this.token.textValue;
  }

  public constructor(public token: VelocityToken) {
    super(token);
  }
}

export class HtmlDocTypeNode extends ParserNode {
  public types: string[] = [];

  public constructor(token: VelocityToken) {
    super(token);
  }
}
