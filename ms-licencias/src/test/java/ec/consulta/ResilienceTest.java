package ec.consulta;
import org.junit.jupiter.api.*;import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;import java.time.*;import java.util.*;
class ResilienceTest {
 final Instant now=Instant.parse("2026-11-26T12:00:00Z");final Clock clock=Clock.fixed(now,ZoneOffset.UTC);
 CacheRepository cache;AntClient ant;LicenciaService service;
 @BeforeEach void setup(){cache=mock(CacheRepository.class);ant=mock(AntClient.class);service=new LicenciaService(cache,ant,clock);when(cache.get(anyString())).thenReturn(Optional.empty());}
 @Test void freshCacheAvoidsAnt(){when(cache.get("test")).thenReturn(Optional.of(new CacheRepository.Entry(0,now.minusSeconds(60))));var r=service.consultar("test");assertEquals(0,r.puntos());assertEquals("Redis Cloud",r.origen());assertFalse(r.desactualizado());verifyNoInteractions(ant);}
 @Test void expiredFreshnessRetainsFallback(){when(cache.get("test")).thenReturn(Optional.of(new CacheRepository.Entry(18,now.minusSeconds(901))));when(ant.consultar("test")).thenThrow(new ApiException(503,"ANT"));var r=service.consultar("test");assertEquals(18,r.puntos());assertTrue(r.desactualizado());verify(cache,never()).save(anyString(),any());}
 @Test void noCacheIsUnavailableNotZero(){when(ant.consultar("test")).thenThrow(new ApiException(503,"ANT"));var r=service.consultar("test");assertNull(r.puntos());assertEquals("NO_DISPONIBLE",r.disponibilidad());verify(cache,never()).save(anyString(),any());}
 @Test void validZeroIsSaved(){when(ant.consultar("test")).thenReturn(0);var r=service.consultar("test");assertEquals(0,r.puntos());assertEquals("ANT",r.origen());verify(cache).save("test",new CacheRepository.Entry(0,now));}
 @Test void olderThan24HoursNeverReturned(){when(cache.get("test")).thenReturn(Optional.of(new CacheRepository.Entry(20,now.minusSeconds(86401))));when(ant.consultar("test")).thenThrow(new ApiException(503,"ANT"));assertNull(service.consultar("test").puntos());}
 @Test void circuitOpensAfterFailures(){when(ant.consultar("test")).thenThrow(new ApiException(503,"ANT"));for(int i=0;i<8;i++)service.consultar("test");verify(ant,times(4)).consultar("test");}
 @Test void successfulRefreshUpdatesCache(){when(cache.get("test")).thenReturn(Optional.of(new CacheRepository.Entry(10,now.minusSeconds(1000))));when(ant.consultar("test")).thenReturn(25);assertEquals(25,service.consultar("test").puntos());verify(cache).save("test",new CacheRepository.Entry(25,now));}
 @Test void htmlParserAcceptsZeroOnlyWithExplicitSelector(){assertEquals(0,AntClient.parse("<span id='fixture-points'>0</span>","#fixture-points"));}
 @Test void captchaNeverCachedAsPoints(){assertThrows(ApiException.class,()->AntClient.parse("<div>captcha</div><span id='p'>25</span>","#p"));}
 @Test void ambiguousOrMissingPointsRejected(){assertThrows(ApiException.class,()->AntClient.parse("<span class='p'>20</span><span class='p'>30</span>",".p"));assertThrows(ApiException.class,()->AntClient.parse("<p>Error</p>",".p"));assertThrows(ApiException.class,()->AntClient.parse("<p id='p'>99</p>","#p"));}
 @Test void rucChecksum(){assertTrue(Input.ruc("1710034065001"));assertFalse(Input.ruc("1710034064001"));assertFalse(Input.ruc("1790010001001"));assertFalse(Input.ruc("1710034065002"));}
}
