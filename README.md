# Consulta Ciudadana · SRI y ANT

Repositorio: [JosueRamses/Arquitectura-C4](https://github.com/JosueRamses/Arquitectura-C4).

Aplicación académica de **ISWZ2202 – Diseño y Arquitectura de Software**, Facultad de Ingeniería y Ciencias Aplicadas. Permite verificar contribuyentes naturales, consultar información vehicular y consultar puntos de licencia mediante fuentes oficiales. Angular utiliza exclusivamente el API Gateway.

## Arquitectura y tecnologías

| Contenedor | Tecnología | Puerto local |
|---|---|---|
| Interfaz | Angular 20, TypeScript, formularios progresivos | 4200 |
| API Gateway | Java 21, Spring Boot 3.5.8, Spring Cloud 2025.0 | 8080 |
| Contribuyentes | Spring MVC, Java HttpClient, Jakarta Validation | 8081 |
| Vehículos | Spring MVC, cálculo decimal conservador | 8082 |
| Licencias | Jsoup, Resilience4j, Spring Data Redis / Lettuce | 8083 |
| Caché externa | Redis Cloud DISARQSFT, AWS, 30 MB; claves HMAC-SHA256 | 16824 |

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

La instancia DISARQSFT está alojada en AWS, tiene 30 MB y usa el puerto 16824. Su endpoint y credenciales se guardan únicamente en `.env`, excluido de Git. La configuración actual es `REDIS_SSL=false`: solo se permite escribir y leer datos sintéticos de pruebas. Para puntos vinculados a personas reales se exige configurar TLS en Redis Cloud y `REDIS_SSL=true`, con certificado válido y el puerto TLS del proveedor.

Configurar `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_SSL` y `CACHE_HMAC_SECRET`. Se generó localmente una clave HMAC con 48 bytes aleatorios (384 bits), sin publicarla. Para regenerarla sin mostrarla: ejecutar `./scripts/configure-hmac.ps1`; conserva la existente salvo que se indique `-Rotate`. Rotar el secreto cambia las claves y deja inaccesibles los respaldos previos hasta que expiren.

Sin configuración completa el repositorio queda deshabilitado. Sin TLS rechaza identificadores personales **antes de cualquier operación Redis**; únicamente acepta en tests el formato reservado `synthetic:UUID`, con namespace separado `licencia:test:v1:`. El controlador público solo acepta RUC válidos y no admite esos identificadores sintéticos. Las respuestas reales de ANT pueden mostrarse sin almacenarse; el mensaje informa el bloqueo del respaldo por ausencia de TLS. `/actuator/health` mide la vida del servicio, no confirma la disponibilidad de ANT o de Redis.

Para repetir las pruebas reales de conexión y resiliencia con datos sintéticos:

```powershell
.\scripts\verify-redis.ps1
```

Estas pruebas verifican PING/PONG, escritura y lectura de cero puntos, expiración real de una clave a los 3 segundos, TTL de respaldo de 24 horas, Cache-Aside, actualización, Fallback desde Redis real tras fallos simulados de ANT y apertura real del Circuit Breaker. La retención de 3 segundos se inyecta exclusivamente en el test; producción conserva 24 horas. Se usan UUID aleatorios sin datos personales y se eliminan solo las claves sintéticas creadas por la prueba, sin usar FLUSHDB. El fallo ANT se simula únicamente en el test; no se modifica el endpoint normal. Las cuatro pruebas Cloud aprobaron el 26/11/2026.

La prueba `RedisCloudTest.fourScenariosThroughRealJavaHttpAndJsoupWithRedisCloud` utiliza un servidor HTTP ligado a `127.0.0.1` dentro de `src/test`: pasa por el `AntClient` real, Java HttpClient y Jsoup, `LicenciaService`, el Circuit Breaker real y `RedisCacheRepository` conectado a Redis Cloud. No sustituye clases ni configura endpoints sintéticos en producción.

| Escenario controlado | Verificación aprobada |
|---|---|
| ANT de pruebas disponible | HTML sintético 200 → Jsoup → almacenamiento en Redis Cloud; una segunda consulta fresca evita llamar a ANT |
| ANT de pruebas indisponible | HTTP 502 → recuperación de la respuesta válida de Redis, marcada desactualizada, sin renovar su fecha |
| ANT de pruebas indisponible sin respaldo | Puntos `null`, disponibilidad negativa y ningún error guardado en Redis; no se inventa cero |
| Recuperación del servicio de pruebas | La misma instancia de servicio consulta el HTML recuperado, actualiza puntos/fecha y TTL en Redis; la siguiente lectura viene de caché |

Los valores de estas fixtures **no son puntos reales de una licencia**. Las claves de prueba se eliminan al finalizar. La apertura del circuito se comprueba además en el test previo, que continúa aprobado.

Las claves son `licencia:v1:<HMAC-SHA256(cédula)>`; el valor contiene únicamente puntos y fecha de obtención. El correo no se guarda ni envía a terceros. La caché no guarda la cédula en claro. No habilitar logs HTTP de depuración sobre datos personales.

## Integraciones y validaciones

- Contribuyentes: correo válido; RUC natural de 13 dígitos con sufijo `001`; validación de provincia, tercer dígito y módulo 10 de cédula. El SRI debe confirmar el mismo RUC y `tipoContribuyente` de persona natural; una sociedad o un tipo desconocido detienen el flujo.
- Vehículos: placa de automóvil o motocicleta validada en frontend y backend. Se consulta existencia, datos y luego rubros mediante el `codigoVehiculo` recibido. No se afirma propiedad del contribuyente.
- Rubros: el total usa `BigDecimal` y únicamente filas planas con `codigoRubro`, descripción y `valorRubro` numérico. Identidades repetidas, subtotales, estructuras anidadas o desconocidas impiden calcular el total; se conserva la respuesta oficial para revisión. **La adaptación de esta estructura está pendiente de una respuesta SRI real autorizada**; no se presume que estos nombres cubran todas las variantes.
- Licencia: cédula derivada de los primeros diez dígitos del RUC validado. ANT devolvió inicialmente HTTP **401** y posteriormente **502**. El cliente ahora realiza la solicitud oficial y distingue esos errores antes de interpretar el HTML. `ANT_POINTS_SELECTOR` sigue vacío: incluso si ANT devuelve 200, no se extraerán puntos hasta verificar su estructura real y configurar el selector correspondiente. No se inventan selectores ni se evaden CAPTCHA. Las pruebas de Jsoup utilizan HTML sintético solo en tests.

Fuentes oficiales (bases completas configuradas en el código):

1. [SRI contribuyentes](https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/existePorNumeroRuc?numeroRuc=): `existePorNumeroRuc` y `obtenerPorNumerosRuc`.
2. [SRI vehículos](https://srienlinea.sri.gob.ec/sri-matriculacion-vehicular-recaudacion-servicio-internet/rest/BaseVehiculo/existePorNumeroPlaca?numeroPlaca=): `existePorNumeroPlaca`, `obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn` y `ConsultaRubros/obtenerPorCodigoVehiculo`.
3. [ANT](https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_grid_citaciones.jsp): identificación `CED`.

Endpoints propios: `POST /api/contribuyentes/consultar` (`correo`, `ruc`), `POST /api/vehiculos/consultar` (`placa`), `POST /api/licencias/consultar` (`ruc`), `GET /actuator/health`.

## Resiliencia

`LicenciaService` implementa Cache-Aside: primero lee Redis. Los datos menores de 15 minutos se devuelven sin contactar ANT. Tras ese tiempo intenta actualizar mediante Circuit Breaker (50 % de errores, ventana de 10 llamadas, mínimo 4 llamadas, circuito abierto 30 segundos). Si falla ANT, devuelve el respaldo con marca de desactualizado hasta cumplir 24 horas. El TTL Redis es **el tiempo restante hasta cumplir 24 horas desde la respuesta válida**, no 15 minutos, y no se prolonga al leer ni al usar fallback. ANT tiene timeout de conexión y de solicitud de 5 segundos. Los errores y HTML inválido nunca se guardan; cero puntos sí es una respuesta válida. Si una lectura viene de caché fresca, el estado de ANT se expresa como no consultado.

## Arquitectura IcePanel

Archivo definitivo: [docs/arquitectura/icepanel-import.json](docs/arquitectura/icepanel-import.json). Conserva los 21 IDs del archivo `Consulta_Ciudadana_IcePanel.json` aportado por el usuario y añade los validadores y el manejo centralizado de errores realmente utilizados. Incluye **26 objetos y 31 relaciones**, clasificadas por C1/C2/C3; no representa clases inexistentes ni llamadas a utilidades que el código no hace. `SriClient` y `RedisCacheRepository` usan sus nombres reales; este último implementa `CacheRepository`.

Las tecnologías Angular, TypeScript, Java, Spring Boot, Spring Cloud Gateway, Redis y Apache Maven utilizan IDs consultados en el catálogo oficial de IcePanel, conservados en `scripts/icepanel-technologies.json`. Jsoup y Resilience4j se indican en captions/labels porque no se encontró una entrada exacta en dicho catálogo; no se inventan IDs. Los enlaces GitHub se generan solo cuando existe una URL canónica de remoto o se proporciona `GITHUB_REPOSITORY_URL`; sin ella no se inventan enlaces ni se asegura publicación. El generador comprueba que los archivos representados existan. Valida [LandscapeImportData](https://api.icepanel.io/v1/schemas/LandscapeImportData) y sus referencias oficiales con `scripts/validate-icepanel.cjs`.

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

**Redis Cloud verificado con datos sintéticos:** PING, escritura, lectura, expiración, Cache-Aside, Circuit Breaker y Fallback reales. La suite completa tiene **28 pruebas aprobadas**: 24 casos locales y cuatro pruebas Cloud con credenciales locales. Conserva las 25 pruebas iniciales y la prueba SRI 204, y añade diagnóstico HTTP ANT y los cuatro escenarios con cliente HTTP real. Modelo C4 actualizado con DISARQSFT/AWS/30 MB, transporte sin TLS limitado a sintéticos y retención máxima de 24 horas; validación oficial mediante `scripts/validate-icepanel.cjs`.

**Pendientes externos:** habilitar TLS para respaldos de personas reales; RUC/placa autorizados para verificar formatos y resultados reales del SRI; acceso autorizado al HTML ANT para fijar su selector; cuenta/autorización IcePanel si se desea publicación remota. No se publican credenciales ni se asegura funcionamiento real de ANT. La evidencia de la ejecución inicial está en [docs/pruebas.md](docs/pruebas.md); los resultados de esta actualización están en este README, sin informes adicionales.

### Revisión final de integraciones

La consulta real autorizada del contribuyente confirmó una persona natural activa. Se verificó y adaptó el campo oficial `estadoContribuyenteRuc`, sin guardar el RUC ni el nombre en el repositorio. La placa autorizada produjo HTTP 204 sin contenido en el endpoint de existencia, por lo que no fue posible confirmar vehículo, obtener su código ni consultar rubros. La aplicación distingue esa respuesta de un fallo de conexión y no la interpreta como vehículo inexistente ni como matrícula de valor cero. Se mantienen los 25 tests previos y se añade una prueba del contrato HTTP 204 con un servidor local controlado.

La revisión del 26/11/2026 de la entrada pública `/PortalWEB/`, la página de criterios y el endpoint de citaciones de ANT devolvió HTTP **502 Bad Gateway**. Se confirmó también en un navegador Edge convencional y en curl. DNS resuelve y la conexión HTTPS obtiene una respuesta HTTP: no es un fallo exclusivo del código Java. El 502 indica que un gateway no pudo obtener una respuesta válida del servicio interno; su causa operativa exacta no puede determinarse sin los registros de ANT. La [web institucional](https://www.ant.gob.ec/) respondió HTTP 200 y enlaza públicamente a `https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_criterio_consulta.jsp`, confirmando que el portal sigue siendo el destino oficial.

El HTTP 401 inicial significa rechazo de acceso/autenticación, pero no se reprodujo en la revisión actual ni se obtuvo una explicación verificable del proveedor. No se atribuye a una contraseña faltante ni se agregan credenciales supuestas. El mecanismo implementado sigue siendo GET HTTPS a la URL del docente mediante Java HttpClient y análisis Jsoup únicamente de HTML válido. No se encontró una API pública alternativa documentada accesible. Si ANT requiere autorización institucional o CAPTCHA, se informa la restricción y se usa el respaldo permitido; no se evaden controles. La indisponibilidad externa no se presenta como resuelta: se ha verificado y corregido la respuesta del sistema ante ella.

Según la [documentación oficial Redis Cloud](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/), el plan gratuito Essentials no incluye TLS. [Upstash ofrece un plan gratuito](https://upstash.com/pricing/redis) de 250 MB y 500.000 comandos mensuales y [documenta conexiones con TLS](https://upstash.com/kb/express-redis-cache-add-upstash-redis-to-any-nodejs-app). Es una alternativa identificada, **sin migrar ni cambiar DISARQSFT**. Para seguir usando datos personales, se requeriría un endpoint TLS autorizado y una nueva verificación; la configuración actual continúa bloqueándolos en Redis.
