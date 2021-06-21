package velocity;

public class RenderVelocityResult {

  private String renderedTemplate;
  private String message;
  private boolean success;

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public String getRenderedTemplate() {
    return renderedTemplate;
  }

  public void setRenderedTemplate(String renderedTemplate) {
    this.renderedTemplate = renderedTemplate;
  }

  public boolean isSuccess() {
    return success;
  }

  public void setSuccess(boolean success) {
    this.success = success;
  }

  public static RenderVelocityResult ofSuccess(String renderedTemplate) {
    RenderVelocityResult result = new RenderVelocityResult();
    result.setSuccess(true);
    result.setRenderedTemplate(renderedTemplate);
    return result;
  }

  public static RenderVelocityResult ofFailure(String message) {
    RenderVelocityResult result = new RenderVelocityResult();
    result.setSuccess(false);
    result.setMessage(message);
    return result;
  }
}
