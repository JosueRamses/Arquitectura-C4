package ec.consulta;
import java.time.*;import java.util.*;import javax.crypto.Mac;import javax.crypto.spec.SecretKeySpec;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Repository;import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.*;import org.springframework.data.redis.connection.lettuce.*;import org.springframework.data.redis.core.StringRedisTemplate;
@Repository public class RedisCacheRepository implements CacheRepository,AutoCloseable {
 private final ObjectMapper mapper;private final String secret;private final StringRedisTemplate redis;private final LettuceConnectionFactory factory;private volatile boolean connected;
 public RedisCacheRepository(ObjectMapper mapper,@Value("${redis.host}") String host,@Value("${redis.port}") int port,@Value("${redis.username}") String username,@Value("${redis.password}") String password,@Value("${redis.ssl}") boolean ssl,@Value("${cache.hmac-secret}") String secret){
  this.mapper=mapper;this.secret=secret;
  if(host.isBlank()||secret.length()<32||password.isBlank()||!ssl){factory=null;redis=null;return;}
  RedisStandaloneConfiguration config=new RedisStandaloneConfiguration(host,port);config.setUsername(username);config.setPassword(password);
  factory=new LettuceConnectionFactory(config,LettuceClientConfiguration.builder().useSsl().and().commandTimeout(Duration.ofSeconds(2)).shutdownTimeout(Duration.ofMillis(100)).build());
  factory.afterPropertiesSet();factory.start();redis=new StringRedisTemplate(factory);
 }
 String key(String cedula){try{Mac hmac=Mac.getInstance("HmacSHA256");hmac.init(new SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8),"HmacSHA256"));return "licencia:v1:"+HexFormat.of().formatHex(hmac.doFinal(cedula.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("HMAC no disponible");}}
 public Optional<Entry> get(String cedula){if(redis==null)return Optional.empty();try{String json=redis.opsForValue().get(key(cedula));connected=true;if(json==null)return Optional.empty();Entry e=mapper.readValue(json,Entry.class);Instant now=Instant.now();if(e.puntos()<0||e.puntos()>30||e.actualizadoEn().isAfter(now)||!e.actualizadoEn().plus(Duration.ofHours(24)).isAfter(now))return Optional.empty();return Optional.of(e);}catch(Exception e){connected=false;return Optional.empty();}}
 public boolean save(String cedula,Entry e){if(redis==null)return false;try{if(e.puntos()<0||e.puntos()>30)return false;redis.opsForValue().set(key(cedula),mapper.writeValueAsString(e),Duration.ofHours(24));connected=true;return true;}catch(Exception error){connected=false;return false;}}
 public boolean available(){return connected;}public void close(){if(factory!=null)factory.destroy();}
}
