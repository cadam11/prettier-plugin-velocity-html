Prettier plugin that formats HTML containing Velocity code

<br/>

### Try your Velocity code using the interactive **[Playground](https://prettier-plugin-velocity-html.herokuapp.com/)**
or install it using `npm i prettier-plugin-velocity-html`. 
<br/>
The plugin will try to format all files ending in `.vm`. Alternatively you can use the `--parser "velocity-html"` switch of the Prettier CLI.

<br/>

## Motivation
I was looking for one IDE inpendent, maven compatible solution to format and enforce a codestyle for Java, XML, Velocity+HTML and JS. Prettier supports HTML and JS out of the box. Java support is provided by [prettier-java](https://github.com/jhipster/prettier-java) and XML by [@prettier/plugin-xml](https://github.com/prettier/plugin-xml). The Prettier HTML parser is pretty robust and can parse most Velocity code. AFAIK there are only two cases it can't handle:
- Using HTML language elements in velocity strings: `#(set $htmlElement ="<div>")`
- Using Velocity fragments (a `footer.vm` for example): `</div> </div> <div> Footer text ... </div> </body> </html>`


I have never seen the first example in real life, the second is pretty common in my experience.

Even if Prettier can parse HTML Velocity code, it is unlikely to improve the formatting of the code, because it will treat every Velocity element as text and will lay it out as such:

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
There are multiple ways to do this. I will describe the solution I used in the project that motivated this plugin.
### IDE integration
- Create a `package.json` in a folder called `formatter` using `npm init`.
- Install `prettier` and all plugins using `npm i <package-name> --save`. This installation of prettier and its plugin will be configured in your IDE
- Add `package.json` and `package-lock.json` to your version control. Exclude `node_modules/`
- Install the Prettier plugin for your IDE. For IntelliJ use [Prettier](https://plugins.jetbrains.com/plugin/10456-prettier). For Visual Studio Code use [prettier-vscode](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).
- Configure the location of your prettier installation (the Prettier executable inside the `formatter` folder). Consult the documentation for the mentioned plugins

### CI Integration
This is written for Maven
- Add [spotless](https://github.com/diffplug/spotless) plugin to your `pom.xml`
```
<plugin>
  <groupId>com.diffplug.spotless</groupId>
  <artifactId>spotless-maven-plugin</artifactId>
  <version>${maven-spotless-plugin.version}</version>
  <executions>
      <execution>
          <id>check-formatting</id>
          <goals>
              <goal>check</goal>
          </goals>
          <phase>validate</phase>
      </execution>
  </executions>
  <configuration>
      <formats>
          <format>
              <includes>
                  <include>**/src/**/*.java</include>
                  <include>**/src/**/*.js</include>
                  <include>**/src/**/*.xml</include>
                  <include>**/src/**/*.vm</include>
                  <include>pom.xml</include>
              </includes>
              <excludes>
                  <exclude>**/node_modules/**</exclude>
              </excludes>

              <prettier>
                  <npmExecutable>${project.basedir}/node/npm</npmExecutable>
                  <!-- Prettier versions have to be duplicated here and in formatter/package.json. See https://github.com/diffplug/spotless/issues/675 -->
                  <devDependencyProperties>
                      <property>
                          <name>prettier</name>
                          <value><!-- VERSION --></value>
                      </property>
                      <property>
                          <name>@prettier/plugin-xml</name>
                          <value><!-- VERSION --></value>
                      </property>
                      <property>
                          <name>prettier-plugin-java</name>
                          <value><!-- VERSION --></value>
                      </property>
                      <property>
                          <name>prettier-plugin-velocity-html</name>
                          <value><!-- VERSION --></value>
                      </property>
                  </devDependencyProperties>
                  <configFile>${project.basedir}/.prettierrc.json</configFile>
              </prettier>
          </format>
      </formats>
  </configuration>
</plugin>
```
- As you can see above, spotless will install Prettier and its plugins again. It currently does not support using a existing installation.
- One way to provide Node and NPM is the [frontend-maven-plugin](https://github.com/eirslett/frontend-maven-plugin)
```
<plugin>
    <groupId>com.github.eirslett</groupId>
    <artifactId>frontend-maven-plugin</artifactId>
    <version>${maven-frontend-plugin.version}</version>
    <executions>
        <execution>
            <id>install node and npm</id>
            <goals>
                <goal>install-node-and-npm</goal>
            </goals>
            <phase>validate</phase>
        </execution>
    </executions>
    <configuration>
        <nodeVersion>v10.18.0</nodeVersion>
        <installDirectory>${project.basedir}</installDirectory>
    </configuration>
</plugin>
```
- Run `mvn spotless:check` in your pipeline.


## How it works
There are two render modes for elements: **block** and **inline**. Block elements will break its children uniformly, whereas inline elements will try to fill as much horizontal space as possible. Whitespace in block elements is not significant, whitespace in inline elements is significant. Inline elements will break the opening or closing tag to avoid inserting whitespace where none was present in the original code. Block elements will never break opening or closing tags.

### inline
```
<span> inline </span><span> inline </span> <span> inline </span><span>
  inline</span
>
```

### block
```
<datalist id="colors">
  <option>Blue</option>
  <option>Green</option>
</datalist>
```
The decision to treat one element one way or the other is made based on the element name. Block and inline refer to the way elements will be laid out in code not how they are rendered in a browser. We will use block elements to improve readability in places where whitespace has no meaning.
This plugin comes with its own HTML parser. It is tested using all relevant test cases from the Prettier HTML parser. The output will not always be identical to Prettier HTML. I wanted to avoid the excessive complexity in Prettier's codebase and simplified some cases.

