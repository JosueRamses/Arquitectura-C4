package ec.consulta;
import java.time.*;import java.util.*;import javax.crypto.Mac;import javax.crypto.spec.SecretKeySpec;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Repository;import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.*;import org.springframework.data.redis.connection.lettuce.*;import org.springframework.data.redis.core.StringRedisTemplate;
@Repository public class RedisCacheRepository implements CacheRepository,AutoCloseable {
 private final ObjectMapper mapper;private final String secret;private final StringRedisTemplate redis;private final LettuceConnectionFactory factory;private volatile boolean connected;
 private final Duration retention;
 @org.springframework.beans.factory.annotation.Autowired
 public RedisCacheRepository(ObjectMapper mapper,@Value("${redis.host}") String host,@Value("${redis.port}") int port,@Value("${redis.username}") String username,@Value("${redis.password}") String password,@Value("${redis.ssl}") boolean ssl,@Value("${cache.hmac-secret}") String secret){
  this(mapper,host,port,username,password,ssl,secret,Duration.ofHours(24));
 }
 RedisCacheRepository(ObjectMapper mapper,String host,int port,String username,String password,boolean ssl,String secret,Duration retention){
  this.mapper=mapper;this.secret=secret;this.retention=retention;
  if(host.isBlank()||secret.length()<32||password.isBlank()){factory=null;redis=null;return;}
  RedisStandaloneConfiguration config=new RedisStandaloneConfiguration(host,port);config.setUsername(username);config.setPassword(password);
  var client=LettuceClientConfiguration.builder().commandTimeout(Duration.ofSeconds(2)).shutdownTimeout(Duration.ofMillis(100));
  if(ssl)client.useSsl();
  factory=new LettuceConnectionFactory(config,client.build());
  factory.afterPropertiesSet();factory.start();redis=new StringRedisTemplate(factory);
 }
 // Controllers accept validated RUCs; these UUID identifiers exist only in controlled tests.
 static boolean synthetic(String id){return id!=null&&id.matches("synthetic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");}
 boolean permitted(String id){return id!=null;}
 String key(String cedula){try{Mac hmac=Mac.getInstance("HmacSHA256");hmac.init(new SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8),"HmacSHA256"));return (synthetic(cedula)?"licencia:test:v1:":"licencia:v1:")+HexFormat.of().formatHex(hmac.doFinal(cedula.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("HMAC no disponible");}}
 public Optional<Entry> get(String cedula){if(redis==null||!permitted(cedula))return Optional.empty();try{String json=redis.opsForValue().get(key(cedula));connected=true;if(json==null)return Optional.empty();Entry e=mapper.readValue(json,Entry.class);Instant now=Instant.now();if(e.puntos()<0||e.puntos()>30||e.actualizadoEn()==null||e.actualizadoEn().isAfter(now)||!e.actualizadoEn().plus(retention).isAfter(now))return Optional.empty();return Optional.of(e);}catch(Exception e){connected=false;return Optional.empty();}}
 public boolean save(String cedula,Entry e){if(redis==null||!permitted(cedula)||e==null||e.actualizadoEn()==null)return false;try{Instant now=Instant.now();Duration ttl=Duration.between(now,e.actualizadoEn().plus(retention));if(e.puntos()<0||e.puntos()>30||e.actualizadoEn().isAfter(now)||ttl.isNegative()||ttl.isZero())return false;redis.opsForValue().set(key(cedula),mapper.writeValueAsString(e),ttl);connected=true;return true;}catch(Exception error){connected=false;return false;}}
 // Package-local diagnostics: never exposed as REST commands.
 boolean ping(){if(factory==null)return false;try(var connection=factory.getConnection()){connected="PONG".equals(connection.ping());}catch(Exception e){connected=false;}return connected;}
 long ttl(String id){if(redis==null||!permitted(id))return -2;Long ttl=redis.getExpire(key(id));return ttl==null?-2:ttl;}
 void deleteSynthetic(String id){if(redis!=null&&synthetic(id))redis.delete(key(id));}
 public boolean available(){return connected;}public void close(){if(factory!=null)factory.destroy();}
}
