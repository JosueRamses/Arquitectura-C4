package ec.consulta;
import java.time.Instant;import java.util.Optional;
public interface CacheRepository {
 record Entry(int puntos,Instant actualizadoEn){}
 Optional<Entry> get(String cedula);
 boolean save(String cedula,Entry entry);
 boolean available();
}
