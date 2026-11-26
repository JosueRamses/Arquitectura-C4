package ec.consulta;
import jakarta.validation.Valid;import jakarta.validation.constraints.NotBlank;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/licencias") public class LicenciaController {
 public record Request(@NotBlank String ruc){}
 private final LicenciaService service;public LicenciaController(LicenciaService service){this.service=service;}
 @PostMapping("/consultar") public LicenseResult consultar(@Valid @RequestBody Request request){Input.requireRuc(request.ruc());return service.consultar(request.ruc().substring(0,10));}
}
