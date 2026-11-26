package ec.consulta;
import jakarta.validation.Valid;import jakarta.validation.constraints.*;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/vehiculos") public class VehiculoController {
 public record Request(@NotBlank @Pattern(regexp="[A-Z]{3}-?[0-9]{3,4}|[A-Z]{2}[0-9]{3}[A-Z]") String placa){}
 private final VehiculoService service;public VehiculoController(VehiculoService service){this.service=service;}
 @PostMapping("/consultar") public VehiculoService.Result consultar(@Valid @RequestBody Request request){return service.consultar(request.placa().replace("-",""));}
}
