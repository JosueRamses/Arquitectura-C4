package ec.consulta;
import java.time.*;import java.util.Optional;import org.springframework.stereotype.Service;
import io.github.resilience4j.circuitbreaker.*;
@Service public class LicenciaService {
 private final CacheRepository cache;private final AntClient ant;private final Clock clock;
 private final CircuitBreaker circuit=CircuitBreaker.of("ant",CircuitBreakerConfig.custom().failureRateThreshold(50).slidingWindowSize(10).minimumNumberOfCalls(4).waitDurationInOpenState(Duration.ofSeconds(30)).permittedNumberOfCallsInHalfOpenState(2).build());
 @org.springframework.beans.factory.annotation.Autowired
 public LicenciaService(CacheRepository cache,AntClient ant){this(cache,ant,Clock.systemUTC());}
 LicenciaService(CacheRepository cache,AntClient ant,Clock clock){this.cache=cache;this.ant=ant;this.clock=clock;}
 public LicenseResult consultar(String cedula){
  Instant now=clock.instant();Optional<CacheRepository.Entry> saved=cache.get(cedula).filter(e->!e.actualizadoEn().isAfter(now)&&e.actualizadoEn().plus(Duration.ofHours(24)).isAfter(now));
  if(saved.isPresent()&&saved.get().actualizadoEn().plus(Duration.ofMinutes(15)).isAfter(now))return result(saved.get(),"Redis Cloud",false,"NO_CONSULTADO","Información vigente en caché; ANT no consultada.");
  try{int points=circuit.executeSupplier(()->ant.consultar(cedula));var e=new CacheRepository.Entry(points,now);boolean stored=cache.save(cedula,e);String notice=cache instanceof RedisCacheRepository repository&&!repository.tlsEnabled()&&!RedisCacheRepository.synthetic(cedula)?"Consulta oficial válida; respaldo de datos personales bloqueado hasta habilitar TLS en Redis Cloud.":"Consulta oficial válida; Redis Cloud no disponible para guardar respaldo.";return result(e,"ANT",false,"DISPONIBLE",stored?"Consulta oficial actualizada.":notice);}
  catch(Exception e){String reason=unavailabilityReason(e);if(saved.isPresent())return result(saved.get(),"Redis Cloud",true,"NO_DISPONIBLE",reason+" Se muestra la última respuesta válida.");return new LicenseResult(null,null,null,false,"NO_DISPONIBLE",reason+" No existe una respuesta válida almacenada.");}
 }
 private String unavailabilityReason(Exception error){
  if(error instanceof io.github.resilience4j.circuitbreaker.CallNotPermittedException)return "El circuito ANT está abierto temporalmente por fallos anteriores.";
  if(error instanceof ApiException api){String message=api.getMessage();if(message!=null&&(message.startsWith("La ANT ")||message.startsWith("El gateway de la ANT ")||message.equals("No fue posible consultar la ANT.")))return message;}
  return "ANT no disponible.";
 }
 private LicenseResult result(CacheRepository.Entry e,String source,boolean stale,String status,String message){return new LicenseResult(e.puntos(),e.actualizadoEn(),source,stale,status,message);}
}
