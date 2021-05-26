import { expect } from "chai";
import { RootNode } from "../src/parser/VelocityParserNodes";
import { VelocityToken } from "../src/parser/VelocityToken";

describe("nodes", () => {
  it("should throw if root node start is decorated", () => {
    const node = new RootNode();
    expect(
      () => (node.revealedConditionalCommentStart = {} as VelocityToken)
    ).to.throw();
  });

  it("should throw if root node end is decorated", () => {
    const node = new RootNode();
    expect(
      () => (node.revealedConditionalCommentEnd = {} as VelocityToken)
    ).to.throw();
  });
});
