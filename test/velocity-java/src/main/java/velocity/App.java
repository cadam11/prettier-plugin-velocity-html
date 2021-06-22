package velocity;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.StandardProtocolFamily;
import java.net.UnixDomainSocketAddress;
import java.nio.ByteBuffer;
import java.nio.channels.ServerSocketChannel;
import java.nio.channels.SocketChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.apache.velocity.VelocityContext;
import org.apache.velocity.app.VelocityEngine;

import groovy.lang.GroovyShell;

public class App {

  private static ObjectMapper objectMapper = new ObjectMapper();

  private static Optional<VelocityCommand> readMessageFromSocket(
    SocketChannel channel
  ) throws IOException {
    ByteBuffer buffer = ByteBuffer.allocate(1024);
    int bytesRead = channel.read(buffer);
    if (bytesRead < 0) return Optional.empty();

    byte[] bytes = new byte[bytesRead];
    buffer.flip();
    buffer.get(bytes);
    String message = new String(bytes);
    System.out.println("[INFO]: Received %s".formatted(message));

    return Optional.of(objectMapper.readValue(message, VelocityCommand.class));
  }

  public static void main(String[] args) throws Exception {
    Path socketFile = Path
      .of(System.getProperty("user.home"))
      .resolve("server.socket");
    System.out.println("[INFO] Opening socket at %s...".formatted(socketFile));
    Files.deleteIfExists(socketFile);
    UnixDomainSocketAddress address = UnixDomainSocketAddress.of(socketFile);
    ServerSocketChannel serverChannel = ServerSocketChannel.open(
      StandardProtocolFamily.UNIX
    );
    serverChannel.bind(address);
    System.out.println("[INFO] Waiting for client to connect...");
    SocketChannel channel = serverChannel.accept();
    System.out.println("[INFO] Client connected");
    while (true) {
      try {
        Optional<VelocityCommand> optionalCommand = readMessageFromSocket(
          channel
        );
        if (optionalCommand.isPresent()) {
          VelocityCommand command = optionalCommand.get();
          RenderVelocityResult result = processVelocityCommand(command);
          byte[] resultAsBytes = objectMapper.writeValueAsBytes(result);
          ByteBuffer byteBuffer = ByteBuffer.allocate(resultAsBytes.length);
          byteBuffer.put(resultAsBytes);
          byteBuffer.flip();
          while (byteBuffer.hasRemaining()) {
            channel.write(byteBuffer);
          }
        }
      } catch (Exception e) {
        System.out.println("[ERROR] %s".formatted(e));
      }
      Thread.sleep(100);
    }
  }

  public static RenderVelocityResult processVelocityCommand(
    VelocityCommand velocityCommand
  ) {
    // TODO Validation
    if (velocityCommand.getTemplate() == null) {
      return RenderVelocityResult.ofFailure("Must provide template");
    }
    final VelocityEngine engine = new VelocityEngine();
    final VelocityContext context = new VelocityContext();

    GroovyShell shell = new GroovyShell();
    try {
      if (velocityCommand.getContextScriptPath() != null) {
        Object data = shell.evaluate(
          velocityCommand.getContextScriptPath().toFile()
        );
        if (!(data instanceof Map)) {
          return RenderVelocityResult.ofFailure(
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
      }
      StringWriter sw = new StringWriter();
      engine.evaluate(context, sw, "foo", velocityCommand.getTemplate());
      return RenderVelocityResult.ofSuccess(sw.getBuffer().toString());
    } catch (Exception e) {
      StringWriter sw = new StringWriter();
      e.printStackTrace(new PrintWriter(sw));
      String exceptionAsString = sw.toString();
      return RenderVelocityResult.ofFailure(exceptionAsString);
    }
  }
}
