There are two render modes for elements: block and inline. Block elements will break its children uniformly, whereas inline elements will try to fill as much horizontal space as possible.

inline
```
<span> inline </span><span> inline </span> <span> inline </span><span>
  inline
</span>
```

block
```
<datalist id="colors">
  <option>Blue</option>
  <option>Green</option>
</datalist>
```
The decision to treat one element one way or the other is made based on the element name. 
Block and inline refer to the way elements will be laid out in source code not necessarily how they are rendered in a browser. Most elements that are not treated by browsers as inline elements are treated as block elements (although a browser does not think of them as block elements). This can be done because in the elements context, whitespace has no meaning and it can be used to improve readabiliy. `<select>` would be an example of a element that this formatter treats a block, but a browser renders as `display: inline-block`.

TODO
- `<!-- prettier-ignore -->`

Edge cases that I do not support at the moment. If you think that there are a valid use after all, then please open an issue.
- No smart formatting of classnames
- No smart quotes for attributes: Will always use double quotes for attributes
- img.srcset attribute formatting
- HTML comments inside `<script>`
- Magic comments such as `<!-- display: block -->` and similar
- `<script>` only supports JS (and not JSON, TS, Markdown, etc...). Unsupported script types are left as is.
- Inline tags inside text break differently compared to prettier:
Prettier
```
<div>
  Lorem ipsum dolor sit amet, consectetur adipiscing elit,
  "<strong>seddoeiusmod</strong>".
</div>
```
Prettier Velocity
```
<div>
  Lorem ipsum dolor sit amet, consectetur adipiscing elit, "<strong
  >seddoeiusmod</strong>".
</div>
```

However, Prettiers formatting is not always better:
Prettier:
```
<div>
  before<object data="horse.wav">
    <param name="autoplay" value="true" />
    <param name="autoplay" value="true" /></object
  >after
</div>
```

Prettier Velocity (notice the `</object>`):
```
<div>
  before<object data="horse.wav">
    <param name="autoplay" value="true" />
    <param name="autoplay" value="true" />
  </object>after
</div>
```

