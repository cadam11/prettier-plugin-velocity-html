package velocity;

import java.nio.file.Path;
import java.util.List;

public class VelocityCommand {

  private String name;
  private String template;
  private Path contextScriptPath;
  private List<Path> resourceLoaderPath;

  public void setName(String name) {
    this.name = name;
  }

  public String getName() {
    return name;
  }

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

  public List<Path> getResourceLoaderPath() {
    return resourceLoaderPath;
  }

  public void setResourceLoaderPath(List<Path> resourceLoaderPath) {
    this.resourceLoaderPath = resourceLoaderPath;
  }
}
