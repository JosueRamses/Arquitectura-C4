package ec.consulta;
import org.junit.jupiter.api.Test;import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;import com.fasterxml.jackson.databind.*;import java.math.BigDecimal;
class VehiculoTest {
 final ObjectMapper mapper=new ObjectMapper();
 @Test void emptyOfficialResponseIsNeitherNotFoundNorZeroCharges()throws Exception{
  var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);
  server.createContext("/exists",exchange->{exchange.sendResponseHeaders(204,-1);exchange.close();});server.start();
  try{var client=new SriClient("http://127.0.0.1:"+server.getAddress().getPort(),mapper);var error=assertThrows(ApiException.class,()->client.get("/exists","numeroPlaca","ABC0000"));assertEquals(502,error.status);assertTrue(error.getMessage().contains("204"));}finally{server.stop(0);}
 }
 @Test void flatChargesSumWithoutSubtotals()throws Exception{var rows=VehiculoService.extract(mapper.readTree("[{\"codigoRubro\":1,\"descripcion\":\"Impuesto\",\"valorRubro\":10.25},{\"codigoRubro\":2,\"descripcion\":\"Tasa\",\"valorRubro\":2.50}]"));assertEquals(new BigDecimal("12.75"),rows.stream().map(VehiculoService.Rubro::valor).reduce(BigDecimal.ZERO,BigDecimal::add));}
 @Test void nestedOrAmbiguousTotalsRejected()throws Exception{assertNull(VehiculoService.extract(mapper.readTree("{\"total\":20,\"rubros\":[]}")));assertNull(VehiculoService.extract(mapper.readTree("[{\"codigoRubro\":1,\"descripcion\":\"Subtotal\",\"valorRubro\":10}]")));}
 @Test void duplicateChargeNotCountedTwice()throws Exception{assertNull(VehiculoService.extract(mapper.readTree("[{\"codigoRubro\":1,\"descripcion\":\"Impuesto\",\"valorRubro\":10},{\"codigoRubro\":1,\"descripcion\":\"Impuesto\",\"valorRubro\":10}]")));}
 @Test void realVehicleCodePassedToRubros()throws Exception{SriClient c=mock(SriClient.class);when(c.get(anyString(),anyString(),anyString())).thenReturn(mapper.readTree("true"),mapper.readTree("{\"codigoVehiculo\":123456}"),mapper.readTree("[]"));new VehiculoService(c).consultar("ABC1234");verify(c).get(contains("ConsultaRubros"),eq("codigoVehiculo"),eq("123456"));}
}
