# Consulta Ciudadana · SRI y ANT

Aplicación académica de **ISWZ2202 – Diseño y Arquitectura de Software**, Facultad de Ingeniería y Ciencias Aplicadas. Permite verificar contribuyentes naturales, consultar información vehicular y consultar puntos de licencia mediante fuentes oficiales. Angular utiliza exclusivamente el API Gateway.

## Arquitectura y tecnologías

| Contenedor | Tecnología | Puerto local |
|---|---|---|
| Interfaz | Angular 20, TypeScript, formularios progresivos | 4200 |
| API Gateway | Java 21, Spring Boot 3.5.8, Spring Cloud 2025.0 | 8080 |
| Contribuyentes | Spring MVC, Java HttpClient, Jakarta Validation | 8081 |
| Vehículos | Spring MVC, cálculo decimal conservador | 8082 |
| Licencias | Jsoup, Resilience4j, Spring Data Redis / Lettuce | 8083 |
| Caché externa | Redis Cloud con TLS y claves HMAC-SHA256 | Configurable |

Cada servicio tiene su propio `pom.xml` y puede compilarse independientemente. El POM de la raíz permite compilar los cuatro juntos. Diagramas C1, C2 y tres C3: [docs/arquitectura/diagramas.md](docs/arquitectura/diagramas.md).

## Requisitos e instalación

Java 21, Maven 3.9+, Node 22.12+ y npm. Git para versionar. Docker es una alternativa y no es necesario para ejecutar localmente.

Desde la carpeta `consulta-ciudadana` en PowerShell:

```powershell
Copy-Item .env.example .env
# Completar .env en un editor; no incorporar credenciales al repositorio.
mvn -B -ntp "-Dmaven.repo.local=$PWD\.maven-cache" package
Set-Location frontend-angular
npm ci
npm run build
Set-Location ..
.\scripts\start.ps1 -SkipBuild
```

Abrir **http://localhost:4200**. Para detener los procesos propios: `./scripts/stop.ps1`.
`./scripts/start.ps1` instala y compila antes de arrancar. Los logs se guardan en `.runtime/` y están excluidos de Git. No ejecutar dos veces el arranque sin detener los procesos anteriores.

También pueden ejecutarse los JAR con `java -jar <servicio>/target/<servicio>-1.0.0.jar`, exportando antes las variables de `.env`. Para Angular: `cd frontend-angular` y `npm start`. El proxy local reenvía `/api` y `/actuator` al Gateway. Los puertos de microservicios se enlazan por defecto a loopback.

Con Docker, tras configurar `.env`: `docker compose up --build`. Redis sigue siendo externo; no se crea una base Redis local como sustituto. Docker no estaba instalado en el entorno inicial, por lo que Compose requiere verificación en un equipo con Docker.

## Redis Cloud y privacidad

Configurar `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_SSL=true` y `CACHE_HMAC_SECRET` (secreto aleatorio de al menos 32 caracteres). Usar el endpoint TLS del proveedor, su CA válida y el puerto que indique Redis Cloud. No desactivar la validación de certificados.

Sin configuración completa o sin TLS el repositorio de caché queda deshabilitado. La aplicación continúa mostrando indisponibilidad o respuestas oficiales disponibles. `/actuator/health` mide la vida del servicio, no confirma la disponibilidad de ANT o de Redis. El estado de ANT se informa en cada consulta de licencia.

Las claves son `licencia:v1:<HMAC-SHA256(cédula)>`; el valor contiene únicamente puntos y fecha de obtención. El correo no se guarda ni envía a terceros. La caché no guarda la cédula en claro. No habilitar logs HTTP de depuración sobre datos personales.

## Integraciones y validaciones

- Contribuyentes: correo válido; RUC natural de 13 dígitos con sufijo `001`; validación de provincia, tercer dígito y módulo 10 de cédula. El SRI debe confirmar el mismo RUC y `tipoContribuyente` de persona natural; una sociedad o un tipo desconocido detienen el flujo.
- Vehículos: placa de automóvil o motocicleta validada en frontend y backend. Se consulta existencia, datos y luego rubros mediante el `codigoVehiculo` recibido. No se afirma propiedad del contribuyente.
- Rubros: el total usa `BigDecimal` y únicamente filas planas con `codigoRubro`, descripción y `valorRubro` numérico. Identidades repetidas, subtotales, estructuras anidadas o desconocidas impiden calcular el total; se conserva la respuesta oficial para revisión. **La adaptación de esta estructura está pendiente de una respuesta SRI real autorizada**; no se presume que estos nombres cubran todas las variantes.
- Licencia: cédula derivada de los primeros diez dígitos del RUC validado. ANT devolvió HTTP **401** al inspeccionar su página el 26/11/2026. No fue posible verificar su estructura HTML. Por eso `ANT_POINTS_SELECTOR` queda vacío y el cliente falla de forma explícita hasta que se inspeccione una respuesta autorizada y se configure el selector correspondiente. No se inventan selectores ni se evaden CAPTCHA. Las pruebas de Jsoup utilizan HTML sintético solo en tests.

Fuentes oficiales (bases completas configuradas en el código):

1. [SRI contribuyentes](https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/existePorNumeroRuc?numeroRuc=): `existePorNumeroRuc` y `obtenerPorNumerosRuc`.
2. [SRI vehículos](https://srienlinea.sri.gob.ec/sri-matriculacion-vehicular-recaudacion-servicio-internet/rest/BaseVehiculo/existePorNumeroPlaca?numeroPlaca=): `existePorNumeroPlaca`, `obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn` y `ConsultaRubros/obtenerPorCodigoVehiculo`.
3. [ANT](https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_grid_citaciones.jsp): identificación `CED`.

Endpoints propios: `POST /api/contribuyentes/consultar` (`correo`, `ruc`), `POST /api/vehiculos/consultar` (`placa`), `POST /api/licencias/consultar` (`ruc`), `GET /actuator/health`.

## Resiliencia

`LicenciaService` implementa Cache-Aside: primero lee Redis. Los datos menores de 15 minutos se devuelven sin contactar ANT. Tras ese tiempo intenta actualizar mediante Circuit Breaker (50 % de errores, ventana de 10 llamadas, mínimo 4 llamadas, circuito abierto 30 segundos). Si falla ANT, devuelve el respaldo con marca de desactualizado hasta cumplir 24 horas. El TTL Redis es **24 horas desde la respuesta válida**, no 15 minutos y no se prolonga al leer. ANT tiene timeout de conexión y de solicitud de 5 segundos. Los errores y HTML inválido nunca se guardan; cero puntos sí es una respuesta válida. Si una lectura viene de caché fresca, el estado de ANT se expresa como no consultado.

## Arquitectura IcePanel

Archivo: [docs/arquitectura/icepanel-import.json](docs/arquitectura/icepanel-import.json). IDs estables y namespace propio evitan duplicación en sucesivas importaciones. Validado contra [LandscapeImportData](https://api.icepanel.io/v1/schemas/LandscapeImportData) y sus referencias oficiales; ver `validation.json`. Incluye 21 objetos y 20 conexiones. Los esquemas descargados se conservan en `docs/arquitectura/schemas`.

```powershell
cd scripts
npm ci
node architecture.cjs
node validate-icepanel.cjs
```

Según la [guía oficial](https://developer.icepanel.io/developer-guide/how-to-guides/import-landscapes), abrir un landscape y elegir **Import model → File Upload**, cargar el JSON y conservar IDs en próximas importaciones. Después crear una vista **Context** con Ciudadano, Consulta Ciudadana, SRI y ANT; crear una vista **App** dentro de Consulta Ciudadana con los seis contenedores; crear tres vistas **Component** dentro de cada microservicio con sus controladores, servicios, clientes y repositorio. Añadir los objetos existentes y sus conexiones, y distribuirlos según los archivos Mermaid. La importación del modelo no crea automáticamente estos diagramas visuales. No se ha creado ni publicado un proyecto remoto IcePanel. Para automatizarlo se necesitan cuenta, landscape y autorización.

## Pruebas y estado de entrega

Ejecutar `mvn verify`, `cd frontend-angular; npm run build`, y desde la raíz `node scripts/smoke.cjs` con los procesos activos. GitHub Actions ejecuta compilación Java, pruebas, build Angular y validación de arquitectura.

Las pruebas controladas cubren persona natural/sociedad, RUC discordante, ausencia de contribuyente, código de vehículo recibido, rubros ambiguos y duplicados, caché fresca, actualización, fallback, expiración de 24 h, apertura del circuito, cero puntos, CAPTCHA y HTML ambiguo. Las fixtures no se utilizan como datos de producción ni se consultan en sistemas oficiales.

**Pendientes externos:** credenciales Redis Cloud y su prueba real; RUC/placa autorizados para verificar formatos y resultados reales del SRI; acceso autorizado al HTML ANT para fijar su selector; autenticación GitHub para publicar el repositorio privado; cuenta/autorización IcePanel si se desea publicación remota. Consulte [docs/pruebas.md](docs/pruebas.md) para la evidencia de esta ejecución.
