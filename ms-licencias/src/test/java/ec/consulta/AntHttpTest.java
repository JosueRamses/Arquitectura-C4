package ec.consulta;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AntHttpTest {
    @Test void javaClientDistinguishesRestrictionsAndGatewayFailuresWithoutInventingPoints() throws Exception {
        AtomicInteger status = new AtomicInteger(401);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ant", exchange -> {
            byte[] body = "<html><body>Upstream response</body></html>".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status.get(), body.length);
            try (var out = exchange.getResponseBody()) { out.write(body); }
        });
        server.start();
        try {
            // No selector in production until actual HTML can be inspected. HTTP diagnosis still works.
            var client = new AntClient("http://127.0.0.1:" + server.getAddress().getPort() + "/ant", "");
            for (int code : new int[]{401, 403, 502}) {
                status.set(code);
                ApiException failure = assertThrows(ApiException.class, () -> client.consultar("synthetic-test"));
                assertTrue(failure.getMessage().contains("HTTP " + code));
            }
            status.set(200);
            ApiException unverifiedHtml = assertThrows(ApiException.class, () -> client.consultar("synthetic-test"));
            assertTrue(unverifiedHtml.getMessage().contains("selector HTML"));
        } finally { server.stop(0); }
    }
}
