Prettier plugin that formats HTML containing Velocity code.

<br/>

### Try your Velocity code using the interactive **[Playground](https://prettier-plugin-velocity-html.herokuapp.com/)**

<br/>

## Motivation
I was looking for one solution to format and enforce a codestyle for Java, XML, Velocity+HTML and JS. Prettier supports HTML and JS out of the box. Java support is provided by [prettier-java](https://github.com/jhipster/prettier-java) and XML by [@prettier/plugin-xml]. The Prettier HTML parser is pretty robust and can parse most Velocity code. AFAIK there are only two cases it can't handle:
- Using HTML language elements in velocity strings: `#(set $htmlElement ="<div>")`
- Using Velocity fragments (a `footer.vm` for example): `</div> </div> <div> Footer text ... </div> </body> </html>`


I have never seen the first example in real life, the second is pretty common in my experience.

Even if Prettier can parse the HTML Velocity code, it is unlikely to improve the formatting of the code, because it will treat every Velocity element as text and will lay it out as such:

### Original 
```
#set ($serviceName = $context.serviceName)
#if ($serviceName)
	<legend>
        #encodeForHTML($serviceName)
    </legend>
#else
    <legend>
        Login to anonymous service
    </legend>
#end
```
### Prettier HTML
```
#set ($serviceName = $context.serviceName) #if ($serviceName)
<legend>#encodeForHTML($serviceName)</legend>
#else
<legend>Login to anonymous service</legend>
#end
```
### Prettier Velocity HTML
```
#set($serviceName = $context.serviceName)
#if($serviceName)
  <legend>#encodeForHTML($serviceName)</legend>
#else
  <legend>Login to anonymous service</legend>
#end
```

## How to integrate it
There are multiple ways to do it. The solution I used in the project that motivated this plugins works like this:
Create a `package.json` in a folder `formatter` that will only contain dependencies to prettier. Install `prettier` and all plugins using `npm i <package-name> --save`. Add [spotless](https://github.com/diffplug/spotless) to your `pom.xml`. Follow the instructions here 

## How it works
There are two render modes for elements: block and inline. Block elements will break its children uniformly, whereas inline elements will try to fill as much horizontal space as possible.

### inline
```
<span> inline </span><span> inline </span> <span> inline </span><span>
  inline
</span>
```

### block
```
<datalist id="colors">
  <option>Blue</option>
  <option>Green</option>
</datalist>
```
The decision to treat one element one way or the other is made based on the element name. 
Block and inline refer to the way elements will be laid out in source code not necessarily how they are rendered in a browser. Most elements that are not treated by browsers as inline elements are treated as block elements. We will use this to improve readability in places where whitespace has no meaning. `<select>` would be an example of a element that this formatter treats a block, but a browser renders as `display: inline-block`.

TODO
- `<!-- prettier-ignore -->`

Edge cases that I do not support at the moment. If you think that there are a valid use after all, then please open an issue.
- No smart quotes for attributes: Will always use double quotes for attributes
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

