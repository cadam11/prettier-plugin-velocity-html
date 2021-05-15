import { VelocityToken } from "./VelocityToken";
import officalHtmlTags from "./officialHtmlTags";

interface SourceCodeLocation {
  line: number;
  column: number;
}

export enum RenderMode {
  BLOCK,
  INLINE,
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
  public _endLocation: SourceCodeLocation | undefined;
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

  public isPreformatted = false;

  public get isInlineRenderMode(): boolean {
    return this.getRenderMode() == RenderMode.INLINE;
  }

  public get isBlockRenderMode(): boolean {
    return this.getRenderMode() == RenderMode.BLOCK;
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

  public abstract getRenderMode(): RenderMode;

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

  public get isOnlyChild(): boolean {
    return this.parent != null && this.parent.children.length == 1;
  }

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    fn(this, 0, [this]);
  }

  public hasLeadingSpaces = false;
  public hasTrailingSpaces = false;

  public get isSelfOrParentPreformatted(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let parent: ParserNode | undefined = this;
    while (parent != null) {
      if (parent instanceof HtmlTagNode && parent.isPreformatted) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }
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
  public getRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
  public knownAttributes = [
    "id",
    "name",
    "class",
    "async",
    "defer",
    "content",
    "charset",
  ];
  clone(): ParserNode {
    return new AttributeNode(this.nameToken, this.valueToken);
  }
  get name(): string {
    const attributeName = this.nameToken.stringValue;
    return this.knownAttributes.includes(attributeName.toLowerCase())
      ? attributeName.toLowerCase()
      : attributeName;
  }
  get value(): string | undefined {
    return this.valueToken != null ? this.valueToken.stringValue : undefined;
  }

  public constructor(
    public nameToken: VelocityToken,
    public valueToken?: VelocityToken
  ) {
    super(nameToken);
  }
}

export class RootNode extends NodeWithChildren {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  clone(): ParserNode {
    return new RootNode();
  }
  public constructor() {
    super({ column: 0, line: 0 });
  }
}

export class HtmlTextNode extends ParserNode {
  public getRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
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

  public trimWhitespace(): void {
    if (this.isWhitespaceOnly) {
      this.tokens = [];
      this.hasLeadingSpaces = true;
      this.hasTrailingSpaces = true;
    } else {
      this.hasLeadingSpaces = this.removeLeadingWhitespace();
      this.hasTrailingSpaces = this.removeTrailingWhitespaceTokens();
    }
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
  public getRenderMode(): RenderMode {
    return this._isInlineRenderMode ? RenderMode.INLINE : RenderMode.BLOCK;
  }
  public get forceBreak(): boolean {
    return this.forceBreakTags.includes(this.tagName);
  }

  private forceBreakTags = ["br"];

  // Taken from https://developer.mozilla.org/en-US/docs/Glossary/Empty_element

  private selfClosingTags = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "keygen",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ];

  private forceCloseTags = ["script"];

  private blockLevelElements = [
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "dialog",
    "dd",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "html",
    "header",
    "hgroup",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "param",
    "table",
    "ul",
  ];

  private preformattedTags = ["pre", "textarea"];

  private _tagName: string;
  public isSelfClosing: boolean;
  public hasClosingTag = false;
  public attributes: AttributeNode[] = [];
  public _isInlineRenderMode: boolean;
  public forceCloseTag: boolean;

  public constructor(public token: VelocityToken) {
    super(token);
  }

  public set tagName(tagName: string) {
    this._tagName = tagName;
    this.isSelfClosing = this.selfClosingTags.includes(this.tagName);
    this.isPreformatted = this.preformattedTags.includes(this.tagName);
    this._isInlineRenderMode = !this.blockLevelElements.includes(this.tagName);
    this.forceCloseTag = this.forceCloseTags.includes(this.tagName);
  }

  public get tagName(): string {
    if (this._tagName != null) {
      return !officalHtmlTags.has(this._tagName.toLowerCase())
        ? this._tagName
        : this._tagName.toLowerCase();
    }
    return "";
  }

  public addAttribute(key: VelocityToken, value?: VelocityToken): void {
    this.attributes.push(new AttributeNode(key, value));
  }
}

export class HtmlCommentNode extends ParserNode {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class IeConditionalCommentNode extends NodeWithChildren {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  get text(): string {
    return this.token.textValue;
  }

  public constructor(public token: VelocityToken) {
    super(token);
  }
}

export class HtmlDocTypeNode extends ParserNode {
  public getRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  public types: string[] = [];

  public constructor(token: VelocityToken) {
    super(token);
  }
}

export class HtmlCdataNode extends ParserNode {
  public getRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class VoidNode extends NodeWithChildren {
  public getRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
}

export class HtmlCloseNode extends ParserNode {
  public getRenderMode(): RenderMode {
    // throw new Error("Method not implemented.");
    return RenderMode.INLINE;
  }

  public tagName: string;
}
