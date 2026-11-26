package ec.consulta;
import java.time.Instant;
public record LicenseResult(Integer puntos,Instant actualizadoEn,String origen,boolean desactualizado,String disponibilidad,String mensaje){}
