package velocity;

import java.nio.file.Path;

public class VelocityCommand {

  private String template;
  private Path contextScriptPath;

  public String getTemplate() {
    return template;
  }

  public void setTemplate(String template) {
    this.template = template;
  }

  public Path getContextScriptPath() {
    return contextScriptPath;
  }

  public void setContextScriptPath(Path contextScriptPath) {
    this.contextScriptPath = contextScriptPath;
  }
}
