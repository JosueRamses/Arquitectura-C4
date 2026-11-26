package ec.consulta;
import org.junit.jupiter.api.Test;import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;import com.fasterxml.jackson.databind.*;
class ContribuyenteTest {
 final ObjectMapper mapper=new ObjectMapper();
 ContribuyenteService service(String json)throws Exception{SriClient client=mock(SriClient.class);when(client.get(anyString(),anyString(),anyString())).thenReturn(mapper.readTree("true"),mapper.readTree(json));return new ContribuyenteService(client);}
 @Test void naturalPersonAccepted()throws Exception{var r=service("[{\"numeroRuc\":\"1710034065001\",\"razonSocial\":\"FIXTURE\",\"tipoContribuyente\":\"PERSONA NATURAL\"}]").consultar("1710034065001");assertEquals("1710034065",r.cedula());}
 @Test void societyRejected()throws Exception{var s=service("{\"numeroRuc\":\"1710034065001\",\"tipoContribuyente\":\"SOCIEDAD\"}");assertEquals(422,assertThrows(ApiException.class,()->s.consultar("1710034065001")).status);}
 @Test void unknownTypeCannotContinue()throws Exception{var s=service("{\"numeroRuc\":\"1710034065001\"}");assertThrows(ApiException.class,()->s.consultar("1710034065001"));}
 @Test void mismatchedRucRejected()throws Exception{var s=service("{\"numeroRuc\":\"other\",\"tipoContribuyente\":\"PERSONA NATURAL\"}");assertThrows(ApiException.class,()->s.consultar("1710034065001"));}
 @Test void notFound()throws Exception{SriClient c=mock(SriClient.class);when(c.get(anyString(),anyString(),anyString())).thenReturn(mapper.readTree("false"));assertEquals(404,assertThrows(ApiException.class,()->new ContribuyenteService(c).consultar("1710034065001")).status);}
}
