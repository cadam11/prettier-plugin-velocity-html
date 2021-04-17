Edge cases that I do not support at the moment. If you think that there are a valid use after all, then please open an issue.
- Dangling spaces are ignored: `foo<span>  </span>bar` will be formatted as `foo<span></span>bar`, prettier-html will format as `foo<span> </span>bar`.
- https://github.com/prettier/prettier/pull/7865
- Smart Quotes: Will always use double quotes for attributes
- img.srcset attribute formatting
- Closing tags are not collapsed ( `/></a>`)