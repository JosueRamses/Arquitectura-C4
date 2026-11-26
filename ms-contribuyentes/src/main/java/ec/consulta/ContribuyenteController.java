package ec.consulta;
import jakarta.validation.Valid;import jakarta.validation.constraints.*;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/contribuyentes") public class ContribuyenteController {
 public record Request(@NotBlank @Email @Size(max=254) String correo,@NotBlank String ruc){}
 private final ContribuyenteService service;public ContribuyenteController(ContribuyenteService service){this.service=service;}
 @PostMapping("/consultar") public ContribuyenteService.Result consultar(@Valid @RequestBody Request request){Input.requireRuc(request.ruc());return service.consultar(request.ruc());}
}
