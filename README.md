# Consulta Ciudadana · SRI y ANT

Repositorio: [JosueRamses/Arquitectura-C4](https://github.com/JosueRamses/Arquitectura-C4).

Landscape IcePanel existente: [Consulta Ciudadana](https://app.icepanel.io/landscapes/lVKZwtzKhdmHBegF2hOi/versions/latest/model/viewer), ID `lVKZwtzKhdmHBegF2hOi`. Se utiliza exclusivamente este landscape y el repositorio anterior.

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
- Vehículos: placa de automóvil o motocicleta validada en frontend y backend. El cliente reconoce la respuesta oficial de existencia `{"mensaje":"La placa existe"}` y conserva compatibilidad con booleanos. Se consultan los datos y luego los rubros mediante el `codigoVehiculo` real recibido. Angular reconoce `descripcionMarca`, `descripcionModelo` y `anioAuto`. No se afirma propiedad del contribuyente.
- Rubros: la consulta real con el código devuelto por el SRI respondió **HTTP 204, sin contenido**. En ese caso se conserva la información del vehículo y se muestra total **no confirmado**, sin inventar cero ni conceptos. Cuando el SRI devuelve filas planas inequívocas con `codigoRubro`, descripción y `valorRubro` numérico, el total usa `BigDecimal`. Identidades repetidas, subtotales o formatos desconocidos impiden calcular el total. La estructura de un listado real no vacío sigue pendiente de respuesta del proveedor; no se presume que los nombres contemplados cubran todas sus variantes.
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

Según la [guía oficial](https://developer.icepanel.io/developer-guide/how-to-guides/import-landscapes), abrir **el landscape existente `lVKZwtzKhdmHBegF2hOi`**, elegir **Import model → File Upload** y cargar `docs/arquitectura/icepanel-import.json`. Mantener los IDs existentes y no activar opciones de eliminación de otros objetos. Después abrir **Model viewer** para recorrer el único dominio **Consulta Ciudadana SRI-ANT**, el contexto, los contenedores y los componentes importados. Los enlaces al código están incluidos en `links` de los objetos y las relaciones. Esta entrega utiliza únicamente el archivo de importación, sin MCP ni automatizaciones de pago.

## Pruebas y estado de entrega

Ejecutar `mvn verify`, `cd frontend-angular; npm run build`, y desde la raíz `node scripts/smoke.cjs` con los procesos activos. GitHub Actions ejecuta compilación Java, pruebas, build Angular y validación de arquitectura.

Las pruebas controladas cubren persona natural/sociedad, RUC discordante, ausencia de contribuyente, código de vehículo recibido, rubros ambiguos y duplicados, caché fresca, actualización, fallback, expiración de 24 h, apertura del circuito, cero puntos, CAPTCHA y HTML ambiguo. Las fixtures no se utilizan como datos de producción ni se consultan en sistemas oficiales.

**Redis Cloud verificado con datos sintéticos:** PING, escritura, lectura, expiración, Cache-Aside, Circuit Breaker y Fallback reales. Se conservan los 28 tests previos y se añaden tres regresiones vehiculares: mensaje oficial de existencia, conservación de datos ante rubros 204 y diferenciación entre consultas obligatorias y opcionales. DISARQSFT continúa siendo el único proveedor de caché; no se añaden servicios ni dependencias. Modelo C4 actualizado, sin TLS limitado a sintéticos y retención máxima de 24 horas; validación oficial mediante `scripts/validate-icepanel.cjs`.

**Limitaciones externas documentadas:** el plan actual de Redis Cloud no tiene TLS y no se usa para almacenar datos personales reales. ANT sigue devolviendo 502 y su selector real no se configura sin inspeccionar una respuesta adecuada. El SRI confirmó contribuyente y vehículo; la consulta de rubros devolvió 204. Se muestra cada situación sin datos inventados. Para demostrar almacenamiento y recuperación se utilizan exclusivamente datos sintéticos en pruebas, manteniendo el proveedor y la arquitectura existentes.

### Revisión final de integraciones

La consulta real autorizada del contribuyente confirmó una persona natural activa. Se verificó el campo oficial `estadoContribuyenteRuc`. Una nueva placa autorizada confirmó el contrato `mensaje: La placa existe`, la información del vehículo y su `codigoVehiculo`. La consulta de rubros con ese código real respondió 204; el sistema mantiene los datos del vehículo y explica que el SRI no devolvió valores. Los identificadores, datos de la persona y datos del vehículo consultados no se guardan en Git ni en Redis sin TLS. Los formatos de respuesta se prueban con fixtures sintéticas que no se envían a sistemas oficiales.

La revisión del 26/11/2026 de la entrada pública `/PortalWEB/`, la página de criterios y el endpoint de citaciones de ANT devolvió HTTP **502 Bad Gateway**. Se confirmó también en un navegador Edge convencional y en curl. DNS resuelve y la conexión HTTPS obtiene una respuesta HTTP: no es un fallo exclusivo del código Java. El 502 indica que un gateway no pudo obtener una respuesta válida del servicio interno; su causa operativa exacta no puede determinarse sin los registros de ANT. La [web institucional](https://www.ant.gob.ec/) respondió HTTP 200 y enlaza públicamente a `https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_criterio_consulta.jsp`, confirmando que el portal sigue siendo el destino oficial.

El HTTP 401 inicial significa rechazo de acceso/autenticación, pero no se reprodujo en la revisión actual ni se obtuvo una explicación verificable del proveedor. No se atribuye a una contraseña faltante ni se agregan credenciales supuestas. El mecanismo implementado sigue siendo GET HTTPS a la URL del docente mediante Java HttpClient y análisis Jsoup únicamente de HTML válido. No se encontró una API pública alternativa documentada accesible. Si ANT requiere autorización institucional o CAPTCHA, se informa la restricción y se usa el respaldo permitido; no se evaden controles. La indisponibilidad externa no se presenta como resuelta: se ha verificado y corregido la respuesta del sistema ante ella.

Según la [documentación oficial Redis Cloud](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/), el plan gratuito Essentials no incluye TLS. Se conserva **Redis Cloud DISARQSFT como único proveedor**, sin migraciones. El repositorio rechaza las operaciones vinculadas a identificadores personales cuando `REDIS_SSL=false`. La demostración académica de Cache-Aside, Circuit Breaker y Fallback usa datos sintéticos en Redis Cloud real. La ausencia de TLS del plan actual es una limitación técnica documentada, no se simula una conexión cifrada ni se presenta como habilitada.
