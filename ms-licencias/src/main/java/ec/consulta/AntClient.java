package ec.consulta;
import java.net.*;import java.net.http.*;import java.time.Duration;import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;import org.springframework.beans.factory.annotation.Value;
@Component public class AntClient {
 private final String url,selector;private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
 public AntClient(@Value("${ant.url}") String url,@Value("${ant.points-selector}") String selector){this.url=url;this.selector=selector;}
 public int consultar(String cedula){
  try{var req=HttpRequest.newBuilder(URI.create(url+"?ps_tipo_identificacion=CED&ps_identificacion="+cedula+"&ps_placa=")).timeout(Duration.ofSeconds(5)).header("Accept","text/html").GET().build();
   var res=http.send(req,HttpResponse.BodyHandlers.ofString());
   if(res.statusCode()==401||res.statusCode()==403)throw new ApiException(503,"La ANT restringió el acceso (HTTP "+res.statusCode()+"). Se requiere acceso autorizado del proveedor.");
   if(res.statusCode()==502)throw new ApiException(503,"El gateway de la ANT no pudo obtener una respuesta válida de su servicio interno (HTTP 502).");
   if(res.statusCode()!=200||res.body().length()>2000000)throw new ApiException(503,"La ANT no está disponible.");
   if(selector.isBlank())throw new ApiException(503,"La ANT respondió, pero aún no se ha podido verificar su selector HTML de puntos.");
   return parse(res.body(),selector);
  }catch(ApiException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiException(503,"Consulta interrumpida.");}catch(Exception e){throw new ApiException(503,"No fue posible consultar la ANT.");}
 }
 static int parse(String html,String selector){
  var doc=Jsoup.parse(html);String lower=html.toLowerCase(java.util.Locale.ROOT);
  if(lower.contains("captcha")||lower.contains("access denied")||lower.contains("acceso denegado"))throw new ApiException(503,"La ANT restringió el acceso.");
  var fields=doc.select(selector);if(fields.size()!=1)throw new ApiException(503,"No se pudo identificar los puntos en la ANT.");
  var el=fields.first();String value=el.tagName().equals("input")?el.val():el.text();
  if(!value.trim().matches("[0-9]{1,2}"))throw new ApiException(503,"Respuesta de puntos inválida.");
  int points=Integer.parseInt(value.trim());if(points>30)throw new ApiException(503,"Puntaje fuera de rango.");return points;
 }
}
