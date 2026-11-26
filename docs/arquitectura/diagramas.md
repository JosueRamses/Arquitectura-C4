## C1-contexto

```mermaid
flowchart LR
  user["Ciudadano · Navegador web"]
  sys["Consulta Ciudadana · Angular + Gateway + tres microservicios"]
  sri["SRI · Servicio externo HTTPS / REST"]
  ant["ANT · Portal externo HTTPS / HTML"]
  user -->|"Consulta información autorizada mediante interfaz web"| sys
  sys -->|"Consulta contribuyente, vehículo y rubros por HTTPS"| sri
  sys -->|"Consulta puntos por HTTPS; indisponibilidad controlada"| ant
```

## C2-contenedores

```mermaid
flowchart LR
  user["Ciudadano · Navegador web"]
  sri["SRI · Servicio externo HTTPS / REST"]
  ant["ANT · Portal externo HTTPS / HTML"]
  web["Frontend Angular · Angular 20.3 / TypeScript 5.9 · HTTP :4200"]
  gateway["API Gateway · Spring Cloud Gateway 2025.0 / Java 21 · HTTP :8080"]
  tax["MS Contribuyentes · Java 21 / Spring Boot 3.5.8 / Maven · HTTP :8081"]
  car["MS Vehículos · Java 21 / Spring Boot 3.5.8 / Maven · HTTP :8082"]
  lic["MS Licencias · Java 21 / Spring Boot 3.5.8 / Maven · HTTP :8083"]
  redis["Redis Cloud DISARQSFT · Redis Cloud · AWS · 30 MB · TCP :16824"]
  gateway -->|"POST JSON · ruta /api correspondiente"| tax
  gateway -->|"POST JSON · ruta /api correspondiente"| car
  gateway -->|"POST JSON · ruta /api correspondiente"| lic
  user -->|"Navegador HTTP local :4200"| web
  web -->|"HTTP JSON /api · proxy Angular o nginx"| gateway
  tax -->|"HTTPS REST · RUC"| sri
  car -->|"HTTPS REST · placa, código real y rubros"| sri
  lic -->|"HTTPS HTML · timeout 5 s; acceso no confirmado"| ant
  lic -->|"RESP TCP sin TLS · puntos válidos y fecha · HMAC · TTL"| redis
```

## C3-contribuyentes

```mermaid
flowchart LR
  sri["SRI · Servicio externo HTTPS / REST"]
  gateway["API Gateway · Spring Cloud Gateway 2025.0 / Java 21 · HTTP :8080"]
  tc["ContribuyenteController · REST controller / DTOs / Jakarta Validation"]
  ts["ContribuyenteService · Lógica de consulta"]
  ta["SriClient · Java HttpClient / Jackson"]
  tax_input["Input · Validación ecuatoriana"]
  tax_errors["Errors · RestControllerAdvice / ApiException"]
  gateway -->|"HTTP JSON · entrada al controlador"| tc
  tc -->|"DTO de solicitud validado"| ts
  tc -->|"Valida RUC y deriva cédula natural"| tax_input
  tax_errors -->|"Advice MVC: transforma excepciones en respuestas HTTP"| tc
  ts -->|"Consulta existencia y datos oficiales"| ta
  ta -->|"HTTPS JSON · SRI oficial"| sri
```

## C3-vehiculos

```mermaid
flowchart LR
  sri["SRI · Servicio externo HTTPS / REST"]
  gateway["API Gateway · Spring Cloud Gateway 2025.0 / Java 21 · HTTP :8080"]
  vc["VehiculoController · REST controller / DTOs / Jakarta Validation"]
  vs["VehiculoService · Lógica de consulta"]
  va["SriClient · Java HttpClient / Jackson"]
  car_errors["Errors · RestControllerAdvice / ApiException"]
  gateway -->|"HTTP JSON · entrada al controlador"| vc
  vc -->|"DTO de solicitud validado"| vs
  car_errors -->|"Advice MVC: transforma excepciones en respuestas HTTP"| vc
  vs -->|"Consulta existencia y datos oficiales"| va
  va -->|"HTTPS JSON · SRI oficial"| sri
```

## C3-licencias

```mermaid
flowchart LR
  ant["ANT · Portal externo HTTPS / HTML"]
  gateway["API Gateway · Spring Cloud Gateway 2025.0 / Java 21 · HTTP :8080"]
  lc["LicenciaController · REST controller / DTOs / Jakarta Validation"]
  ls["LicenciaService · Resilience4j 2.3.0 / Cache-Aside / Fallback"]
  la["AntClient · Java HttpClient / Jsoup 1.21.2"]
  lic_input["Input · Validación ecuatoriana"]
  lic_errors["Errors · RestControllerAdvice / ApiException"]
  lr["RedisCacheRepository · Spring Data Redis / Lettuce / HMAC-SHA256"]
  redis["Redis Cloud DISARQSFT · Redis Cloud · AWS · 30 MB · TCP :16824"]
  gateway -->|"HTTP JSON · entrada al controlador"| lc
  lc -->|"DTO de solicitud validado"| ls
  lc -->|"Valida RUC y deriva cédula natural"| lic_input
  lic_errors -->|"Advice MVC: transforma excepciones en respuestas HTTP"| lc
  ls -->|"Circuit Breaker Resilience4j · consulta si caché no fresca"| la
  la -->|"HTTPS HTML · Jsoup · sin selector aún verificado"| ant
  ls -->|"Cache-Aside 15 min · Fallback hasta 24 h"| lr
  lr -->|"HMAC · TTL restante 24 h · respuestas válidas con o sin TLS"| redis
```
