package ec.consulta;
import com.fasterxml.jackson.databind.ObjectMapper;import java.time.Instant;
import org.junit.jupiter.api.Test;import static org.junit.jupiter.api.Assertions.*;
class RedisPrivacyTest {
 @Test void nonTlsRejectsPersonalDataBeforeNetwork(){try(var c=new RedisCacheRepository(new ObjectMapper(),"",6379,"default","",false,"test-secret-with-at-least-32-characters")){
  assertFalse(c.permitted("0000000000"));assertFalse(c.save("0000000000",new CacheRepository.Entry(20,Instant.now())));assertTrue(c.get("0000000000").isEmpty());
  assertTrue(c.permitted("synthetic:550e8400-e29b-41d4-a716-446655440000"));assertFalse(c.permitted("synthetic:nombre-personal"));
 }}
 @Test void syntheticKeysUseSeparateNamespace(){try(var c=new RedisCacheRepository(new ObjectMapper(),"",6379,"default","",false,"test-secret-with-at-least-32-characters")){
  String id="synthetic:550e8400-e29b-41d4-a716-446655440000";assertTrue(c.key(id).matches("licencia:test:v1:[0-9a-f]{64}"));assertEquals(c.key(id),c.key(id));assertFalse(c.key(id).contains("550e8400"));
 }}
}
