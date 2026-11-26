package ec.consulta;
import java.net.*;import java.net.http.*;import java.time.Duration;
import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Component;import org.springframework.beans.factory.annotation.Value;
@Component public class SriClient {
 private final String base;private final ObjectMapper mapper;
 private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
 public SriClient(@Value("${sri.base-url}") String base,ObjectMapper mapper){this.base=base;this.mapper=mapper;}
 public JsonNode get(String path,String parameter,String value){
  return request(path,parameter,value,false);
 }
 public JsonNode getOptional(String path,String parameter,String value){
  return request(path,parameter,value,true);
 }
 private JsonNode request(String path,String parameter,String value,boolean allowNoContent){
  try {var uri=URI.create(base+path+"?"+parameter+"="+URLEncoder.encode(value,java.nio.charset.StandardCharsets.UTF_8));
   var response=http.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10)).header("Accept","application/json").GET().build(),HttpResponse.BodyHandlers.ofString());
   if(response.statusCode()==204){if(allowNoContent)return com.fasterxml.jackson.databind.node.NullNode.getInstance();throw new ApiException(502,"El SRI respondió sin contenido (HTTP 204). No fue posible confirmar la consulta; revisa la placa o inténtalo más tarde.");}
   if(response.statusCode()!=200||response.body().length()>2000000)throw new ApiException(503,"El SRI no está disponible.");
   var data=mapper.readTree(response.body());if(data==null||data.isNull())throw new ApiException(503,"El SRI devolvió una respuesta vacía.");return data;
  }catch(ApiException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiException(503,"Consulta interrumpida.");}catch(Exception e){throw new ApiException(503,"No fue posible conectar con el SRI.");}
 }
 static boolean exists(JsonNode n){
  if(n!=null&&n.isBoolean())return n.booleanValue();
  if(n!=null&&n.path("mensaje").isTextual()&&"La placa existe".equalsIgnoreCase(n.path("mensaje").asText().strip()))return true;
  throw new ApiException(502,"El SRI no confirmó la existencia de la placa con un formato reconocido.");
 }
 static String text(JsonNode n,String... keys){for(String k:keys){JsonNode v=n.get(k);if(v!=null&&v.isValueNode()&&!v.isNull())return v.asText();}return null;}
}
