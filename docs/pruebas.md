# Evidencia de verificación · 26 de noviembre de 2026

| Verificación | Resultado |
|---|---|
| Maven / Java 21: cuatro servicios empaquetados | Correcto, BUILD SUCCESS |
| Pruebas de contribuyentes | 5 aprobadas |
| Pruebas de vehículos y rubros | 4 aprobadas |
| Pruebas de licencia, caché y resiliencia | 11 aprobadas |
| Angular, compilación de producción | Correcta; 268,17 kB iniciales antes de compresión |
| Arranque Angular :4200 y cuatro servicios :8080–8083 | Correcto, HTTP 200 |
| Formularios inválidos a través de Gateway y proxy Angular | Los tres servicios devuelven HTTP 400 en ambas rutas |
| CORS desde http://localhost:4200 | Correcto |
| Edge sin ventana, escritorio y móvil de 390 px | Correcto, sin desbordamiento horizontal ni errores JavaScript |
| Flujo visual con fixtures de test | Persona natural, placa, matrícula, cero puntos, respaldo desactualizado y reinicio aprobados |
| IcePanel: JSON Schema oficial con referencias anidadas | Correcto; 21 objetos y 20 conexiones |
| Inspección ANT sin identificación personal | HTTP 401; no se pudo verificar el HTML de puntos |
| Consulta real de un RUC o placa | Pendiente: faltan datos autorizados |
| Redis Cloud real / TLS / lectura y recuperación | Pendiente: faltan credenciales |
| Docker Compose | Pendiente: Docker no instalado |
| GitHub privado | Pendiente: autenticación de usuario |
| Diagramas publicados en IcePanel | No publicados; modelo JSON y cinco diagramas Mermaid disponibles localmente |

Los 20 tests Java utilizan mocks o fixtures exclusivamente de prueba. La prueba del navegador intercepta las tres consultas; no realiza consultas con los identificadores de sus fixtures a los servicios públicos. El entorno normal usa clientes oficiales y nunca sustituye un fallo por datos ficticios.

Las capturas de verificación y resultados HTTP se guardan localmente en `.runtime/`, fuera del repositorio. Los esquemas oficiales y el resultado de su validación están en `docs/arquitectura/`. Para repetir la prueba de navegador, instalar Playwright como herramienta de desarrollo y ejecutar `node scripts/browser-test.cjs` con Edge instalado y el frontend activo. La prueba HTTP es `node scripts/smoke.cjs`.

No se confirma el funcionamiento de Redis Cloud, los formatos reales del SRI ni la extracción real de puntos hasta completar las verificaciones externas pendientes. El parser de rubros rechaza formatos ambiguos y expone el JSON oficial cuando no puede calcular el total.
