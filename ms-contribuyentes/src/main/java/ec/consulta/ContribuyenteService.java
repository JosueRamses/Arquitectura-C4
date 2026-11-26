package ec.consulta;
import com.fasterxml.jackson.databind.JsonNode;import org.springframework.stereotype.Service;import java.text.Normalizer;
@Service public class ContribuyenteService {
 public record Result(String ruc,String cedula,String nombre,String tipo,String estado,JsonNode datos){}
 private final SriClient client;public ContribuyenteService(SriClient client){this.client=client;}
 public Result consultar(String ruc){
  String path="/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/";
  if(!SriClient.exists(client.get(path+"existePorNumeroRuc","numeroRuc",ruc)))throw new ApiException(404,"No existe un contribuyente con ese RUC.");
  JsonNode all=client.get(path+"obtenerPorNumerosRuc","ruc",ruc),n=all.isArray()&&all.size()==1?all.get(0):all;
  String returned=SriClient.text(n,"numeroRuc","ruc");if(!ruc.equals(returned))throw new ApiException(502,"El SRI no confirmó el RUC solicitado.");
  String tipo=SriClient.text(n,"tipoContribuyente");
  if(tipo==null)throw new ApiException(502,"El SRI no informó el tipo de contribuyente.");
  String normalized=Normalizer.normalize(tipo,Normalizer.Form.NFD).replaceAll("\\p{M}","").toUpperCase(java.util.Locale.ROOT);
  if(!normalized.matches("PERSONA[S]? NATURAL(ES)?"))throw new ApiException(422,"La consulta está disponible únicamente para personas naturales.");
  return new Result(ruc,ruc.substring(0,10),SriClient.text(n,"razonSocial","nombreComercial"),tipo,SriClient.text(n,"estadoContribuyente","estado"),n);
 }
}
