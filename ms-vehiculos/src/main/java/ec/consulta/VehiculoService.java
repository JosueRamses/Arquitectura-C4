package ec.consulta;
import com.fasterxml.jackson.databind.JsonNode;import org.springframework.stereotype.Service;import java.math.BigDecimal;import java.util.*;
@Service public class VehiculoService {
 public record Rubro(String concepto,BigDecimal valor){}
 public record Result(JsonNode vehiculo,JsonNode rubros,List<Rubro> conceptos,BigDecimal total,String aviso){}
 private final SriClient client;public VehiculoService(SriClient client){this.client=client;}
 public Result consultar(String placa){String path="/sri-matriculacion-vehicular-recaudacion-servicio-internet/rest/";
  if(!SriClient.exists(client.get(path+"BaseVehiculo/existePorNumeroPlaca","numeroPlaca",placa)))throw new ApiException(404,"No existe un vehículo con esa placa.");
  JsonNode n=client.get(path+"BaseVehiculo/obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn","numeroPlacaCampvCpn",placa);
  String code=SriClient.text(n,"codigoVehiculo");if(code==null||!code.matches("[0-9]+"))throw new ApiException(502,"El SRI no informó un código de vehículo válido.");
  JsonNode rubros=client.getOptional(path+"ConsultaRubros/obtenerPorCodigoVehiculo","codigoVehiculo",code);
  List<Rubro> conceptos=extract(rubros);BigDecimal total=conceptos==null?null:conceptos.stream().map(Rubro::valor).reduce(BigDecimal.ZERO,BigDecimal::add);
  return new Result(n,rubros,conceptos,total,"La consulta no acredita que el vehículo pertenezca al contribuyente."+(rubros==null||rubros.isNull()?" El SRI respondió sin contenido al consultar rubros (HTTP 204); no devolvió valores y el total no está confirmado.":total==null?" No se pudo interpretar de forma segura el total; revisa la respuesta oficial.":""));
 }
 // Only flat, explicitly identified charge rows are summed. Nested/unknown formats fail closed.
 static List<Rubro> extract(JsonNode n){
  if(n==null||!n.isArray())return null;List<Rubro> rows=new ArrayList<>();Set<String> ids=new HashSet<>();
  for(JsonNode row:n){if(!row.isObject())return null;
   String name=SriClient.text(row,"descripcionRubro","descripcion");JsonNode value=row.get("valorRubro");String id=SriClient.text(row,"codigoRubro");String year=SriClient.text(row,"anio","anioFiscal");
   if(name==null||id==null||value==null||!value.isNumber()||value.decimalValue().signum()<0)return null;
   if(name.toLowerCase(java.util.Locale.ROOT).contains("total"))return null;
   String key=id+":"+year;if(!ids.add(key))return null;
   rows.add(new Rubro(name,value.decimalValue()));
  }return rows;
 }
}
