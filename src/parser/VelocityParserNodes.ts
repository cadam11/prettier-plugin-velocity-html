import {
  isCollapsibleWhitespaceOnly,
  SourceCodeLocation,
  VelocityToken,
} from "./VelocityToken";
import { RenderDefinition, RenderMode, tagRegistry } from "./tagRegistry";

// TODO Maybe overwrite get startNode().
export type AnyNodeWithChildren = NodeWithChildren<
  NodeWithChildrenDecoration,
  NodeWithChildrenDecoration
>;

// TODO Nested conditional comment
export class DecoratedNode {
  public _revealedConditionalCommentStart: VelocityToken | null;

  public get revealedConditionalCommentStart(): VelocityToken | null {
    if (this instanceof NodeWithChildren) {
      return (this.startNode as NodeWithChildrenDecoration)
        .revealedConditionalCommentStart;
    } else {
      return this._revealedConditionalCommentStart;
    }
  }
  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    this._revealedConditionalCommentStart = token;
  }

  public _revealedConditionalCommentEnd: VelocityToken | null = null;

  public get revealedConditionalCommentEnd(): VelocityToken | null {
    if (this instanceof NodeWithChildren) {
      // TODO Typescript
      return (this.endNode as NodeWithChildrenDecoration) != null
        ? (this.endNode as NodeWithChildrenDecoration)
            .revealedConditionalCommentEnd
        : null;
    } else {
      return this._revealedConditionalCommentEnd;
    }
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    this._revealedConditionalCommentEnd = token;
  }
}

export abstract class ParserNode extends DecoratedNode {
  public set endToken(token: VelocityToken) {
    this._endLocation = token.endLocation;
  }

  public get endToken(): VelocityToken {
    throw new Error("Not implemented");
  }

  public _startLocation: SourceCodeLocation;
  public get startLocation(): SourceCodeLocation {
    if (this.revealedConditionalCommentStart != null) {
      return this.revealedConditionalCommentStart.startLocation;
    } else {
      return this._startLocation;
    }
  }
  // TODO Remove
  public _endLocation: SourceCodeLocation;
  public get endLocation(): SourceCodeLocation {
    if (this.revealedConditionalCommentEnd != null) {
      return this.revealedConditionalCommentEnd.endLocation;
    } else if (this instanceof NodeWithChildren && this.endNode == null) {
      return this.lastChild != null
        ? this.lastChild.endLocation
        : this._endLocation;
    }
    return this._endLocation;
  }

  public _isPreformatted = false;

  public isPreformatted(): boolean {
    return this._isPreformatted;
  }

  public get isInlineRenderMode(): boolean {
    return this.getSiblingsRenderMode() == RenderMode.INLINE;
  }

  public get isBlockRenderMode(): boolean {
    return this.getSiblingsRenderMode() == RenderMode.BLOCK;
  }

  constructor(startToken: VelocityToken) {
    super();
    this._startLocation = startToken.startLocation;
    this._endLocation = startToken.endLocation;
  }

  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }

  public get prev(): ParserNode | undefined {
    return this.parent.children[this.index - 1];
  }
  public get next(): ParserNode | undefined {
    return this.parent.children[this.index + 1];
  }
  public get index(): number {
    return this.parent.children.indexOf(this);
  }
  public get isFirstChild(): boolean {
    return this.index == 0;
  }
  public get isLastChild(): boolean {
    return this.index == this.parent.children.length - 1;
  }
  private _parent: AnyNodeWithChildren;

  public get parent(): AnyNodeWithChildren {
    return this._parent;
  }

  public set parent(parent: AnyNodeWithChildren) {
    this._parent = parent;
  }

  public get isOnlyChild(): boolean {
    return this.parent.children.length == 1;
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
    if (this.isPreformatted()) {
      return true;
    }
    let parent: ParserNode | undefined = this.parent;
    // Only node without parent is RootNode
    while (!(parent instanceof RootNode)) {
      if (parent instanceof HtmlTagNode && parent.isPreformatted()) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  public forceBreak = false;

  public _prettierIgnore: VelocityToken[] = [];

  /**
   * This is an array, because <!--prettier-ignore--> is allowed to appear multiple times in succession.
   * It has no effect, but we don't want to remove code.
   */
  public set prettierIgnore(prettierIgnore: VelocityToken[]) {
    this._prettierIgnore = prettierIgnore;
  }

  public get prettierIgnore(): VelocityToken[] {
    return this._prettierIgnore;
  }
}

export class NullDecoratedNode extends DecoratedNode {}

export class NodeWithChildrenDecoration extends DecoratedNode {
  constructor() {
    super();
  }
}

export abstract class NodeWithChildren<
  StartNode extends NodeWithChildrenDecoration,
  EndNode extends NodeWithChildrenDecoration
> extends ParserNode {
  public children: ParserNode[] = [];

  public get lastChild(): ParserNode | undefined {
    return this.children[this.children.length - 1];
  }

  public walk(
    fn: (node: ParserNode, index: number, array: ParserNode[]) => void
  ): void {
    this.children.forEach((node) => {
      node.walk(fn);
    });
    super.walk(fn);
  }

  constructor(token: VelocityToken) {
    super(token);
  }

  public startNode: StartNode | undefined;
  public endNode: EndNode | undefined;

  public forceBreakChildren = false;

  public addChild(child: ParserNode): void {
    this.children.push(child);
    child.parent = this;
  }

  public get maxDepth(): number {
    return this.children.reduce((maxDepth, child) => {
      if (child instanceof NodeWithChildren) {
        const childDepth = child.maxDepth + 1;
        return Math.max(childDepth, maxDepth);
      } else {
        // Text nodes and simliar should be considered "content" not depth.
        return maxDepth;
      }
    }, 0);
  }

  public get firstChild(): ParserNode | undefined {
    return this.children[0];
  }
}

export class AttributeNode extends ParserNode {
  public knownAttributes = [
    "id",
    "name",
    "class",
    "async",
    "defer",
    "content",
    "charset",
  ];
  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.BLOCK;
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

  // TODO Remove?
  public get isSelfOrParentPreformatted(): boolean {
    return false;
  }
}

export class RootNode extends NodeWithChildren<
  NullDecoratedNode,
  NullDecoratedNode
> {
  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  public constructor() {
    super({} as any);
  }

  public get startLocation(): SourceCodeLocation {
    throw new Error("Root node has no start location");
  }

  public get endLocation(): SourceCodeLocation {
    throw new Error("Root node has no end location");
  }

  public get parent(): AnyNodeWithChildren {
    throw new Error("Root node has no parent");
  }

  public set parent(parent: AnyNodeWithChildren) {
    throw new Error("Root node has no parent");
  }

  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    throw new Error(`Cannot decorate root node.`);
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    throw new Error(`Cannot decorate root node.`);
  }
}

export type WhitespaceTokenType =
  | "text"
  | "conditionalComment"
  | "prettierIgnore";
export class WhitespaceToken {
  public text: string;
  public type: WhitespaceTokenType;
  public isWhitespaceOnly: boolean;
  public line: number;
  public column: number;
  constructor(token: VelocityToken, type: WhitespaceTokenType = "text") {
    this.text = token.textValue;
    this.isWhitespaceOnly = token.isWhitespaceOnly;
    this.line = token.line;
    this.type = type;
  }
}

export class HtmlTextNode extends ParserNode {
  public tokens: WhitespaceToken[] = [];

  public constructor(token: VelocityToken) {
    super(token);
    this.tokens.push(new WhitespaceToken(token));
  }

  public get text(): string {
    return this.tokens.map((token) => token.text).join("");
  }

  public addText(token: VelocityToken): void {
    this.tokens.push(new WhitespaceToken(token));
  }

  public get isWhitespaceOnly(): boolean {
    return isCollapsibleWhitespaceOnly(this.text);
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
      // Collapse space to single space (inline elements only).
      if (this.isOnlyChild && this.parent.isInlineRenderMode) {
        this.tokens = [
          {
            line: this.startLocation.line,
            column: this.startLocation.column,
            isWhitespaceOnly: true,
            text: " ",
            type: "text",
          },
        ];
      } else {
        // Spaces are attached to siblings if there are any.
        this.tokens = [];
        this.hasLeadingSpaces = true;
        this.hasTrailingSpaces = true;
      }
    } else {
      // Don't overwrite. May have been set be previous or next child. Must trim anyway.
      this.hasLeadingSpaces =
        this.removeLeadingWhitespace() ||
        this.hasLeadingSpaces ||
        (this.revealedConditionalCommentStart != null &&
          /\s+$/.exec(this.revealedConditionalCommentStart.textValue) != null);
      this.hasTrailingSpaces =
        this.removeTrailingWhitespaceTokens() ||
        this.hasTrailingSpaces ||
        (this.revealedConditionalCommentEnd != null &&
          /^\s+/.exec(this.revealedConditionalCommentEnd.textValue) != null);
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
    iterator: Generator<WhitespaceToken>,
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
    this._endLocation = this.tokens[this.tokens.length - 1];
    this._startLocation = {
      line: this.tokens[0].line,
      column: this.tokens[0].column,
    };
    return numberOfTailingWhitespaceTokens > 0;
  }

  /**
   * Integrate node decoration into text to avoid a text node followed by another text node.
   */
  public set revealedConditionalCommentStart(token: VelocityToken | null) {
    if (token != null) {
      // Insert before the text node that is "annotated"
      this.tokens.splice(
        this.tokens.length - 1,
        0,
        new WhitespaceToken(token, "conditionalComment")
      );
    }
  }

  public set revealedConditionalCommentEnd(token: VelocityToken | null) {
    if (token != null) {
      this.tokens.push(new WhitespaceToken(token, "conditionalComment"));
    }
  }

  public get prettierIgnore(): VelocityToken[] {
    return [];
  }

  public set prettierIgnore(tokens: VelocityToken[]) {
    // Insert before the text node that is "annotated"
    this.tokens.splice(
      this.tokens.length - 1,
      0,
      ...tokens.map((token) => new WhitespaceToken(token, "prettierIgnore"))
    );
  }
}

export class HtmlAttributesNode extends NodeWithChildren<
  NullDecoratedNode,
  NullDecoratedNode
> {
  constructor() {
    // TODO
    super({} as any);
  }
}

export class HtmlTagNode extends NodeWithChildren<
  NodeWithChildrenDecoration,
  NodeWithChildrenDecoration
> {
  public getSiblingsRenderMode(): RenderMode {
    return this.renderDefinition.siblingsMode;
  }

  public getChildrenRenderMode(): RenderMode {
    return this.renderDefinition.childrenMode;
  }

  private renderDefinition: Required<RenderDefinition>;
  private _tagName: string;
  public isSelfClosing: boolean;
  public _attributes: HtmlAttributesNode;
  public forceCloseTag: boolean;

  public constructor(public token: VelocityToken) {
    super(token);
    this.startNode = new NodeWithChildrenDecoration();
    this._attributes = new HtmlAttributesNode();
    this._attributes.parent = this;
  }

  public get scriptParser(): string | undefined {
    // TODO Typescript
    const typeAttribute = this._attributes.children.find(
      (attribute) =>
        attribute instanceof AttributeNode && attribute.name === "type"
    ) as AttributeNode;
    const scriptType = typeAttribute != null ? typeAttribute.value : undefined;
    return Object.keys(this.supportedScriptTypes).find((parser) =>
      this.supportedScriptTypes[parser].includes(scriptType)
    );
  }

  public supportedScriptTypes: { [key: string]: (string | undefined)[] } = {
    babel: [
      "text/javascript",
      "text/babel",
      "application/javascript",
      "jsx",
      undefined,
    ],
  };

  public isPreformatted(): boolean {
    return (
      this.renderDefinition.preformatted ||
      (this.tagName === "script" && this.scriptParser == null) ||
      (["style", "script"].includes(this.tagName) &&
        this.containsVelocityNodes())
    );
  }

  private containsVelocityNodes(): boolean {
    for (const child of this.children) {
      if (
        child instanceof VelocityDirectiveNode ||
        child instanceof VelocityReferenceNode
      ) {
        return true;
      }
    }
    return false;
  }

  public set tagName(tagName: string) {
    this._tagName = tagName;
    const renderDefinition = tagRegistry.get(this.tagName);
    // TODO
    // this.renderDefinition = {
    //   siblingsMode: RenderMode.INLINE,
    //   childrenMode: RenderMode.INLINE,
    //   forceBreak: false,
    //   forceBreakChildren: false,
    //   forceClose: false,
    //   preformatted: false,
    //   selfClosing: false,
    //   ...renderDefinition,
    // };
    if (renderDefinition == null) {
      this.renderDefinition = {
        siblingsMode: RenderMode.INLINE,
        childrenMode: RenderMode.INLINE,
        forceBreak: false,
        forceBreakChildren: false,
        forceClose: false,
        preformatted: false,
        selfClosing: false,
      };
    } else {
      this.renderDefinition = {
        siblingsMode: renderDefinition.siblingsMode,
        childrenMode:
          renderDefinition.childrenMode != null
            ? renderDefinition.childrenMode
            : renderDefinition.siblingsMode,
        forceBreak:
          renderDefinition.forceBreak != null
            ? renderDefinition.forceBreak
            : false,
        forceBreakChildren:
          renderDefinition.forceBreakChildren != null
            ? renderDefinition.forceBreakChildren
            : false,
        forceClose:
          renderDefinition.forceClose != null
            ? renderDefinition.forceClose
            : false,
        preformatted:
          renderDefinition.preformatted != null
            ? renderDefinition.preformatted
            : false,
        selfClosing:
          renderDefinition.selfClosing != null
            ? renderDefinition.selfClosing
            : false,
      };
    }
    this.forceCloseTag = this.renderDefinition.forceClose;
    this.forceBreak = this.renderDefinition.forceBreak;
    this.forceBreakChildren = this.renderDefinition.forceBreakChildren;
    this.isSelfClosing = this.renderDefinition.selfClosing;
  }

  public get tagName(): string {
    if (this._tagName != null) {
      return !tagRegistry.has(this._tagName.toLowerCase())
        ? this._tagName
        : this._tagName.toLowerCase();
    }
    return "";
  }

  public get attributes(): ParserNode[] {
    return this._attributes.children;
  }

  public addAttribute(attribute: AttributeNode | VelocityDirectiveNode): void {
    this._attributes.addChild(attribute);
  }
}

export class HtmlCommentNode extends ParserNode {
  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class IeConditionalCommentNode extends NodeWithChildren<
  NodeWithChildrenDecoration,
  NodeWithChildrenDecoration
> {
  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  get text(): string {
    return this.token.textValue;
  }

  public constructor(public token: VelocityToken) {
    super(token);
    this.startNode = new NodeWithChildrenDecoration();
  }
}

export class HtmlDocTypeNode extends ParserNode {
  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }
  public types: string[] = [];

  public constructor(token: VelocityToken) {
    super(token);
  }
}

export class HtmlCdataNode extends ParserNode {
  public text: string;

  public constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
    this.endToken = token;
  }
}

export class HtmlCloseNode extends NodeWithChildren<
  NodeWithChildrenDecoration,
  NodeWithChildrenDecoration
> {
  public tagName: string;

  public getSiblingsRenderMode(): RenderMode {
    return RenderMode.BLOCK;
  }

  constructor(token: VelocityToken) {
    super(token);
    /**
     * Always break children of close nodes to improve readability:
     * <!--[if lt IE 9]><td></td></td>
     *        </tr>
     * To break this, we have to force the break into the first children group:
     * <!--[if lt IE 9]>
     *          <td></td></td>
     *        </tr>
     */
    this.forceBreakChildren = true;
    // TODO This should be endNode
    this.endNode = new NodeWithChildrenDecoration();
  }
}

interface VelocityRenderDefinition {
  siblingsMode?: RenderMode;
  hasChildren?: boolean;
  hasVelocityCode?: boolean;
  adaptiveMode?: boolean;
}

export class VelocityDirectiveEndNode extends NodeWithChildrenDecoration {
  constructor(public token: VelocityToken) {
    super();
  }
}
export class VelocityDirectiveNode extends NodeWithChildren<
  NodeWithChildrenDecoration,
  VelocityDirectiveEndNode
> {
  public directive: string;

  private _tokens: VelocityToken[] = [];

  // prettier-ignore
  private directiveToRenderDefinition: Map<string, VelocityRenderDefinition> =
    new Map([
      ["set", { siblingsMode: RenderMode.BLOCK, hasChildren: false }],
      ["if", { adaptiveMode: true }],
      ["elseif", {adaptiveMode: true}],
      ["else", { adaptiveMode: true, hasVelocityCode: false }],
    ]);

  private renderDefinition: Required<VelocityRenderDefinition>;

  public endStatement = false;

  public formalMode = false;

  getSiblingsRenderMode(): RenderMode {
    if (this.renderDefinition.adaptiveMode) {
      let prev = this.prev;
      while (prev != null && prev instanceof VelocityDirectiveNode) {
        prev = prev.prev;
      }
      const prevRenderMode =
        prev != null ? prev.getSiblingsRenderMode() : RenderMode.BLOCK;
      let next = this.next;
      while (next != null && next instanceof VelocityDirectiveNode) {
        next = next.next;
      }
      const nextRenderMode =
        next != null ? next.getSiblingsRenderMode() : RenderMode.BLOCK;
      return prevRenderMode == RenderMode.INLINE ||
        nextRenderMode == RenderMode.INLINE
        ? RenderMode.INLINE
        : RenderMode.BLOCK;
    }
    return this.renderDefinition.siblingsMode;
  }

  get hasChildren(): boolean {
    return this.renderDefinition.hasChildren;
  }

  get hasVelocityCode(): boolean {
    return this.renderDefinition.hasVelocityCode;
  }

  constructor(startLocation: VelocityToken) {
    super(startLocation);
    const directiveWithoutSpaces = startLocation.textValue.replace(/ \t/g, "");
    // TODO #set with space and tab.
    this.directive = directiveWithoutSpaces.substring(
      1,
      directiveWithoutSpaces.endsWith("(")
        ? directiveWithoutSpaces.length - 1
        : directiveWithoutSpaces.length
    );
    if (this.directive.startsWith("{")) {
      this.formalMode = true;
      this.directive = this.directive.substring(1, this.directive.length - 1);
    }
    const renderDefinition = this.directiveToRenderDefinition.get(
      this.directive
    );
    this.renderDefinition = {
      siblingsMode: RenderMode.BLOCK,
      hasChildren: true,
      hasVelocityCode: true,
      adaptiveMode: false,
      ...renderDefinition,
    };
    this.forceBreakChildren = true;
    this.startNode = new NodeWithChildrenDecoration();
  }

  public addToken(token: VelocityToken): void {
    this._tokens.push(token);
    this._endLocation = token.endLocation;
  }

  public get tokens(): VelocityToken[] {
    return this._tokens;
  }
}

export class VelocityCommentNode extends ParserNode {
  getSiblingsRenderMode(): RenderMode {
    return RenderMode.INLINE;
  }
  public text: string;
  constructor(token: VelocityToken) {
    super(token);
    this.text = token.textValue;
  }
}

export class VelocityReferenceNode extends ParserNode {
  private _tokens: VelocityToken[] = [];
  public hasChildren = false;
  public isFormalReference = false;
  constructor(token: VelocityToken) {
    super(token);
    this.isFormalReference =
      token.textValue.charAt(1) == "{" || token.textValue.charAt(2) == "{";
    this._tokens.push(token);
  }

  public addToken(token: VelocityToken): void {
    this._tokens.push(token);
    this._endLocation = token.endLocation;
  }

  public get tokens(): VelocityToken[] {
    return this._tokens;
  }
}
