# Consulta Ciudadana · SRI y ANT

Proyecto de ISWZ2202 — Diseño y Arquitectura de Software. Permite verificar contribuyentes naturales, consultar información vehicular y valores de matrícula del SRI, y consultar puntos de licencia de la ANT con respaldo en Redis Cloud.

- [Repositorio GitHub](https://github.com/JosueRamses/Arquitectura-C4)
- [Diagrama C4 compartido en IcePanel](https://s.icepanel.io/PCNIhUltvHmc9o/AHYs)
- [Landscape IcePanel existente](https://app.icepanel.io/landscapes/lVKZwtzKhdmHBegF2hOi/versions/latest/model/viewer)
- [JSON definitivo de importación C4](docs/arquitectura/icepanel-import.json)

## Arquitectura

| Contenedor | Tecnología | Puerto local |
|---|---|---|
| Interfaz | Angular 20.3, TypeScript 5.9 | 4200 |
| API Gateway | Java 21, Spring Boot 3.5.8, Spring Cloud Gateway | 8080 |
| Contribuyentes | Spring MVC, Java HttpClient, Jakarta Validation | 8081 |
| Vehículos | Spring MVC, Java HttpClient, BigDecimal | 8082 |
| Licencias | Spring MVC, Jsoup, Resilience4j, Spring Data Redis / Lettuce | 8083 |
| Caché externa | Redis Cloud DISARQSFT, AWS, 30 MB | 16824 |

Angular consume exclusivamente el Gateway. Cada servicio tiene su propio `pom.xml`; el POM raíz permite compilar el conjunto.

## Ejecución local

Requisitos: Java 21, Maven 3.9+, Node 22.12+ y npm. Desde la raíz del proyecto, en PowerShell:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Completar las variables Redis en .env, sin publicar sus credenciales.
./scripts/configure-hmac.ps1
./scripts/start.ps1
```

Abrir [http://localhost:4200](http://localhost:4200). El script carga `.env`, compila e inicia los servicios en segundo plano. Con los artefactos ya compilados puede usarse `./scripts/start.ps1 -SkipBuild`. Para detener los procesos de este proyecto: `./scripts/stop.ps1`. Los registros activos y los identificadores de proceso se guardan en `.runtime/`, excluido de Git.

Docker Compose es una alternativa opcional: `docker compose up --build`. La demostración local utiliza los procesos Java y Angular.

## Configuración de caché

Configurar `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_SSL` y `CACHE_HMAC_SECRET` siguiendo `.env.example`. El secreto HMAC se genera con 48 bytes aleatorios mediante `scripts/configure-hmac.ps1`; el script conserva el existente salvo que se indique `-Rotate`. Rotarlo cambia las claves de caché y deja los respaldos anteriores inaccesibles hasta su expiración.

DISARQSFT es el único proveedor de caché. La conexión actual usa `REDIS_SSL=false`, sin cifrado. Por solicitud explícita del responsable del proyecto, se permite almacenar respuestas reales válidas con ese transporte. HMAC-SHA256 oculta la cédula en la clave, pero no cifra la conexión ni el valor almacenado. Los valores contienen únicamente puntos y fecha; los datos de contribuyentes y vehículos no se guardan en Redis. `.env` y los datos de las consultas están excluidos de Git.

`LicenciaService` aplica **Cache-Aside**: primero consulta Redis; una respuesta menor de 15 minutos evita llamar a ANT. Después intenta actualizar mediante **Circuit Breaker**: ventana de 10 llamadas, mínimo 4, umbral de errores del 50 %, apertura durante 30 segundos y dos llamadas en semiabierto. ANT tiene timeout de conexión y solicitud de 5 segundos.

Si ANT falla, **Fallback** devuelve el respaldo válido hasta cumplir 24 horas y lo marca desactualizado. El TTL es el tiempo restante desde la respuesta original; leer o usar fallback no lo prolonga. Sin respaldo devuelve puntos `null`, nunca cero inventado. Los errores, CAPTCHA y HTML inválido no se almacenan. Cero puntos sí es válido. Sin credenciales completas el repositorio queda deshabilitado.

## Consultas y límites externos

La interfaz solicita correo y RUC natural. El correo se valida y no se almacena. El RUC debe tener 13 dígitos, terminar en `001` y superar la validación ecuatoriana. El SRI debe confirmar existencia, mismo RUC y tipo persona natural. La cédula se deriva de los primeros diez dígitos.

La consulta vehicular comprueba existencia, obtiene los datos y utiliza el `codigoVehiculo` recibido para solicitar rubros. Se verificaron respuestas reales con conceptos y total mostrado en Angular. Si el SRI devuelve HTTP 204 al consultar rubros, se conservan los datos del vehículo y el total queda no confirmado. Ese estado no demuestra ausencia de obligaciones. El cálculo decimal conserva valores cero y rechaza subtotales, duplicados y formatos ambiguos. La consulta no acredita propiedad.

La URL ANT sigue siendo la indicada por el docente y enlazada por el portal institucional. Las últimas comprobaciones devolvieron HTTP 502 tanto en Java como en Edge; el 401 inicial no se reprodujo. **La extracción real de puntos sigue pendiente:** `ANT_POINTS_SELECTOR` permanece vacío hasta poder verificar una respuesta HTML adecuada. No se inventa un selector ni se sustituye la integración de producción por simulaciones. Retirar la restricción de caché por TLS no resuelve la indisponibilidad de ANT.

Fuentes oficiales:

- [SRI contribuyentes](https://srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/existePorNumeroRuc?numeroRuc=): existencia y datos por RUC.
- [SRI vehículos](https://srienlinea.sri.gob.ec/sri-matriculacion-vehicular-recaudacion-servicio-internet/rest/BaseVehiculo/existePorNumeroPlaca?numeroPlaca=): existencia, información y rubros mediante `codigoVehiculo`.
- [Portal de consultas ANT](https://consultaweb.ant.gob.ec/PortalWEB/paginas/clientes/clp_criterio_consulta.jsp): la integración usa `clp_grid_citaciones.jsp` con `ps_tipo_identificacion=CED`, `ps_identificacion` y `ps_placa` vacío.

Endpoints propios: `POST /api/contribuyentes/consultar` (`correo`, `ruc`), `POST /api/vehiculos/consultar` (`placa`), `POST /api/licencias/consultar` (`ruc`) y `GET /actuator/health`. Health confirma que el servicio está vivo; no garantiza disponibilidad de ANT o Redis.

## IcePanel

El archivo único de entrega es [docs/arquitectura/icepanel-import.json](docs/arquitectura/icepanel-import.json): un dominio **Consulta Ciudadana SRI-ANT**, 26 objetos y 31 relaciones C1/C2/C3. Conserva los 21 IDs del JSON aportado y añade los cinco componentes de validación y manejo de errores utilizados. Incluye tecnologías y enlaces GitHub en las propiedades `links` admitidas por el esquema oficial.

En el landscape existente, elegir **Import model → File Upload**, cargar el JSON y abrir **Model viewer**. Mantener los IDs y no activar la eliminación de objetos ajenos al proyecto. El archivo conserva la ausencia de `namespace` del último JSON aportado. No se necesitan MCP ni API de pago para esta entrega por archivo.

Para regenerar y validar el modelo:

```powershell
cd scripts
npm ci
node architecture.cjs
node validate-icepanel.cjs
```

`architecture.cjs` también acepta la ruta de un JSON de origen como argumento y conserva sus IDs y su `namespace`, si lo tiene. La validación utiliza el [esquema oficial LandscapeImportData](https://api.icepanel.io/v1/schemas/LandscapeImportData) y sus referencias conservadas en `docs/arquitectura/schemas/`; comprueba jerarquía, duplicados, relaciones y que los enlaces GitHub correspondan a archivos existentes. Las relaciones C1/C2 agregan las comunicaciones detalladas en C3 y no representan llamadas adicionales.

## Verificación

Se conservan **32 pruebas Java: 28 aisladas y cuatro de Redis Cloud real**. Cubren validación del contribuyente, código vehicular, rubros, caché, cero puntos, expiración, Circuit Breaker, Fallback y los cuatro escenarios ANT: disponible/guardado, indisponible/con respaldo, indisponible/sin respaldo y recuperación/actualización. Las simulaciones existen exclusivamente en tests; las pruebas Cloud usan identificadores ficticios y eliminan o dejan expirar solo sus propias claves, sin `FLUSHDB`.

```powershell
mvn verify
cd frontend-angular
npm run build
cd ..
./scripts/verify-redis.ps1
node scripts/smoke.cjs
```

`verify-redis.ps1` carga `.env` sin mostrar secretos y ejecuta las cuatro pruebas Cloud. `smoke.cjs` requiere los servicios activos y comprueba health, Angular, validación de entradas y CORS. GitHub Actions ejecuta las pruebas aisladas, la compilación Angular y la validación del JSON; las credenciales Cloud no se publican ni se incorporan al workflow.
