import { doc} from "prettier";

const {
    literalline,
    breakParent,
    dedentToRoot,
    fill,
    ifBreak,
    hardline,
    softline,
    join,
    group,
    indent,
    line,
    align,
  } = doc.builders;

export default [
    indent([
      indent([
        indent([
          align(2, ["", "</div>", breakParent]),
          softline,
          breakParent,
          "</div>",
          breakParent,
        ]),
        softline,
        breakParent,
        "</div>",
        breakParent,
      ]),
      softline,
      breakParent,
      "</div>",
      breakParent,
    ]),
    softline,
    breakParent,
    "</div>",
  ]