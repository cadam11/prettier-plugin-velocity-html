package velocity;

import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.VelocityEngine;

import groovy.lang.GroovyShell;

public class App {

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      throw new IllegalStateException(
        "Must provide path to template and path to json"
      );
    }
    Path templatePath = Path.of(args[0]);
    if (!templatePath.toFile().exists()) {
      throw new IllegalArgumentException(
        "%s does not exist".formatted(templatePath)
      );
    }
    final String template = Files.readString(templatePath);
    final VelocityEngine engine = new VelocityEngine();
    final VelocityContext context = new VelocityContext();
    Path contextDataPath = Path.of(args[1]);
    if (!contextDataPath.toFile().exists()) {
      throw new IllegalStateException(
        "%s does not exist".formatted(contextDataPath)
      );
    }
    GroovyShell shell = new GroovyShell();
    Object data = shell.evaluate(contextDataPath.toFile());
    if (!(data instanceof Map)) {
      throw new IllegalStateException(
        "Result is a %s, expected Map.".formatted(
            data.getClass().getSimpleName()
          )
      );
    }
    ((Map<String, Object>) data).entrySet()
      .forEach(
        entry -> {
          context.put(entry.getKey(), entry.getValue());
        }
      );
    StringWriter sw = new StringWriter();
    engine.evaluate(context, sw, "foo", template);
    System.out.println(sw.getBuffer().toString());
  }
}
