package ec.consulta;
import com.fasterxml.jackson.databind.ObjectMapper;import java.time.*;import java.util.UUID;
import org.junit.jupiter.api.Test;import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;

@EnabledIfSystemProperty(named="redis.live",matches="true")
class RedisCloudTest {
 private RedisCacheRepository repository(Duration retention){
  String password=System.getenv("REDIS_PASSWORD");assertNotNull(password,"Falta REDIS_PASSWORD");assertFalse(password.isBlank(),"REDIS_PASSWORD vacía");
  return new RedisCacheRepository(new ObjectMapper().findAndRegisterModules(),System.getenv("REDIS_HOST"),Integer.parseInt(System.getenv("REDIS_PORT")),System.getenv().getOrDefault("REDIS_USERNAME","default"),password,Boolean.parseBoolean(System.getenv().getOrDefault("REDIS_SSL","false")),System.getenv("CACHE_HMAC_SECRET"),retention);
 }
 private String id(){return "synthetic:"+UUID.randomUUID();}
 @Test void pingWriteReadAndExpire()throws Exception{
  String id=id();try(var cache=repository(Duration.ofSeconds(3))){try{
   assertTrue(cache.ping(),"PING Redis Cloud debe responder PONG");var entry=new CacheRepository.Entry(0,Instant.now());
   assertTrue(cache.save(id,entry),"Escritura sintética fallida");assertEquals(entry,cache.get(id).orElseThrow());
   assertTrue(cache.ttl(id)>=0&&cache.ttl(id)<=3,"TTL no establecido");Thread.sleep(3200);
   assertEquals(-2,cache.ttl(id),"Redis debe eliminar la clave");assertTrue(cache.get(id).isEmpty());
  }finally{cache.deleteSynthetic(id);}}
 }
 @Test void liveCacheAsideFallbackAndCircuitBreaker(){
  String id=id();try(var cache=repository(Duration.ofHours(24))){try{
   var ant=mock(AntClient.class);var service=new LicenciaService(cache,ant);when(ant.consultar(id)).thenReturn(25);
   var first=service.consultar(id);assertEquals("ANT",first.origen());assertEquals(25,first.puntos());
   long initialTtl=cache.ttl(id);assertTrue(initialTtl>86300&&initialTtl<=86400);
   var fresh=service.consultar(id);assertEquals("Redis Cloud",fresh.origen());assertFalse(fresh.desactualizado());verify(ant,times(1)).consultar(id);
   assertTrue(cache.ttl(id)<=initialTtl,"La lectura no debe renovar TTL");
   assertTrue(cache.save(id,new CacheRepository.Entry(25,Instant.now().minusSeconds(960))));long staleTtl=cache.ttl(id);assertTrue(staleTtl>85300&&staleTtl<=85440);
   reset(ant);when(ant.consultar(id)).thenThrow(new ApiException(503,"Fallo ANT controlado en test"));service=new LicenciaService(cache,ant);
   for(int i=0;i<8;i++){var fallback=service.consultar(id);assertEquals(25,fallback.puntos());assertEquals("Redis Cloud",fallback.origen());assertTrue(fallback.desactualizado());assertEquals("NO_DISPONIBLE",fallback.disponibilidad());}
   verify(ant,times(4)).consultar(id);assertTrue(cache.ttl(id)<=staleTtl,"Fallback no prolonga respaldo");
   cache.deleteSynthetic(id);assertNull(service.consultar(id).puntos());reset(ant);when(ant.consultar(id)).thenReturn(0);
   assertEquals(0,new LicenciaService(cache,ant).consultar(id).puntos());assertEquals(0,cache.get(id).orElseThrow().puntos());
  }finally{cache.deleteSynthetic(id);}}
 }
 @Test void nonTlsNeverReadsOrWritesPersonalIdentifiers(){try(var cache=repository(Duration.ofHours(24))){if(!Boolean.parseBoolean(System.getenv().getOrDefault("REDIS_SSL","false"))){assertFalse(cache.permitted("0000000000"));assertFalse(cache.save("0000000000",new CacheRepository.Entry(30,Instant.now())));assertTrue(cache.get("0000000000").isEmpty());}}}
}
