const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/arquitectura');
const target = path.join(dir, 'icepanel-import.json');
const existing = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : {};
const technologies = JSON.parse(fs.readFileSync(path.join(__dirname, 'icepanel-technologies.json'), 'utf8'));
const objects = [], connections = [];

function repositoryUrl() {
  let remote = process.env.GITHUB_REPOSITORY_URL;
  if (!remote) {
    try { remote = execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'remote', 'get-url', 'origin'], {cwd:root, encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim(); }
    catch { return null; }
  }
  remote = remote.replace(/^git@github.com:/, 'https://github.com/').replace(/\.git$/, '').replace(/\/$/, '');
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(remote)) throw Error('La URL GitHub debe ser canónica y no contener credenciales.');
  return remote;
}
const repository = repositoryUrl();
if(!repository) throw Error('Configura el remoto origin o GITHUB_REPOSITORY_URL para generar enlaces reales de GitHub.');
function link(url, name) {
  return {id:crypto.createHash('sha256').update(url).digest('hex').slice(0,20), url, customName:name};
}
function object(id, name, type, parentId, caption, description, source, tech = []) {
  if (source && !fs.existsSync(path.join(root, source))) throw Error(`No existe el código modelado: ${source}`);
  const previous = (existing.modelObjects || []).find(o => o.id === id);
  const value = {id, name, type, ...(parentId ? {parentId} : {}), caption, description,
    labels:{tecnologias:tech.join(', ') || 'No aplica', ...(source ? {codigo:source} : {})}};
  if (repository && source) value.links = [link(repository + (source.includes('.') ? '/blob/main/' : '/tree/main/') + source, 'Código implementado en GitHub')];
  else if (previous?.links) value.links = previous.links;
  const known = tech.map(name => technologies[name]).filter(t => t && (!t.restrictions?.length || t.restrictions.includes(type)));
  if (known.length) { value.technologyIds = [...new Set(known.map(t => t.id))]; value.icon = {technologyId:known[0].id}; }
  objects.push(value);
  return value;
}
function connection(originId, targetId, name, level, protocol, responsibility, sources, kind = 'invocacion') {
  if(!protocol || !responsibility || !sources?.length) throw Error(`Relación sin contrato completo: ${originId} -> ${targetId}`);
  for(const source of sources) if(!fs.existsSync(path.join(root,source))) throw Error(`Fuente de relación inexistente: ${source}`);
  if(connections.some(c=>c.originId===originId&&c.targetId===targetId&&c.labels.vista===level)) throw Error(`Relación duplicada: ${originId} -> ${targetId}`);
  const previous = (existing.modelConnections || []).find(c => c.originId === originId && c.targetId === targetId);
  const aggregated = level !== 'C3';
  connections.push({
    id:previous?.id || `conn-${originId}-${targetId}`, originId, targetId, name, direction:'outgoing',
    description:responsibility+(aggregated?' Relación agregada de la vista '+level+'; no representa una llamada adicional a las detalladas en niveles inferiores.':'')+' Protocolo: '+protocol+'.',
    labels:{vista:level,protocolo:protocol,responsabilidad:responsibility,tipo:aggregated?'agregacion C4':kind},
    ...(repository?{links:sources.map(source=>link(repository+'/blob/main/'+source,'Implementación de la comunicación'))}:{})
  });
}
object('dom','Consulta Ciudadana SRI-ANT','domain',null,'Dominio único · Arquitectura C4','Contiene el ciudadano, el sistema implementado y sus integraciones externas. C1: contexto; C2: contenedores; C3: componentes. Las relaciones agregadas documentan las mismas comunicaciones a distinta escala, sin duplicar llamadas de ejecución.');
const citizen = object('user','Ciudadano','actor','dom','Navegador web','Ingresa un correo, RUC natural y placa autorizados. La consulta vehicular no acredita propiedad.');
const system = object('sys','Consulta Ciudadana','system','dom','Angular + Gateway + tres microservicios','Validación SRI; datos vehiculares y rubros; consulta ANT con caché y resiliencia.');
system.links = [
  ...(repository ? [link(repository,'Repositorio GitHub'), link(repository+'/blob/main/README.md','Ejecución y configuración')] : []),
  link('https://app.icepanel.io/landscapes/lVKZwtzKhdmHBegF2hOi/versions/latest/model/viewer','Landscape IcePanel existente')
];
const sri = object('sri','SRI','system','dom','Servicio externo HTTPS / REST','Existencia y datos del contribuyente, vehículo y rubros. No se inventan resultados.');
sri.external = true;
sri.links = [link('https://srienlinea.sri.gob.ec/','SRI en línea')];
const ant = object('ant','ANT','system','dom','Sistema externo · HTTPS / HTML','Portal oficial de citaciones y puntos de licencia. Integración conservada en la URL del docente; disponibilidad variable. El cliente diferencia restricciones 401/403 y fallos 502. La extracción solo se permite con HTML válido y selector real verificado, todavía no configurado. La aplicación utiliza el respaldo permitido o informa indisponibilidad.');
ant.external = true;
ant.links = [link('https://consultaweb.ant.gob.ec/PortalWEB/','Portal oficial de consultas ANT')];
object('web','Frontend Angular','app','sys','Angular 20.3 / TypeScript 5.9 · HTTP :4200','Formularios progresivos en español, validaciones, datos oficiales, dólares, carga, errores y estado de caché. Consume solo /api del Gateway.','frontend-angular',['Angular','TypeScript']);
object('gateway','API Gateway','app','sys','Spring Cloud Gateway / Spring Cloud 2025.0 / Java 21 · HTTP :8080','Enrutamiento HTTP a tres microservicios independientes, CORS y health. Las rutas conservan /api/contribuyentes/**, /api/vehiculos/** y /api/licencias/** sin consumo externo directo desde Angular.','api-gateway',['Spring Cloud Gateway','Spring Boot','Java']);
const definitions = [
  {id:'tax', folder:'ms-contribuyentes', name:'MS Contribuyentes', port:8081, controller:'ContribuyenteController', service:'ContribuyenteService', client:'SriClient', ids:['tc','ts','ta']},
  {id:'car', folder:'ms-vehiculos', name:'MS Vehículos', port:8082, controller:'VehiculoController', service:'VehiculoService', client:'SriClient', ids:['vc','vs','va']},
  {id:'lic', folder:'ms-licencias', name:'MS Licencias', port:8083, controller:'LicenciaController', service:'LicenciaService', client:'AntClient', ids:['lc','ls','la']}
];
for (const d of definitions) {
  object(d.id,d.name,'app','sys',`Java 21 / Spring Boot 3.5.8 / Maven · HTTP :${d.port}`,
    d.id==='lic'?'Cache-Aside: datos frescos 15 min; respaldo máximo 24 h; circuito Resilience4j 50%, mínimo 4 llamadas, apertura 30 s; Jsoup; timeout ANT 5 s.':d.id==='tax'?'Confirma existencia, RUC coincidente y tipo persona natural según respuesta SRI.':'Confirma la placa según el mensaje oficial del SRI, obtiene codigoVehiculo y consulta rubros. Conserva los datos del vehículo si los rubros responden 204; no inventa un total cero.',d.folder,['Spring Boot','Java','Maven']);
  const base = d.folder+'/src/main/java/ec/consulta/';
  object(d.ids[0],d.controller,'component',d.id,'REST controller / DTOs / Jakarta Validation',
    'Recibe POST /api/'+(d.id==='tax'?'contribuyentes':d.id==='car'?'vehiculos':'licencias')+'/consultar. '+(d.id==='tax'?'Valida correo y RUC natural; delega la verificación al servicio.':d.id==='car'?'Valida la placa y elimina el guion antes de delegar al servicio.':'Valida el RUC natural, deriva la cédula con sus primeros diez dígitos y la entrega al servicio de licencias.'),base+d.controller+'.java',['Spring Boot','Java']);
  object(d.ids[1],d.service,'component',d.id,d.id==='lic'?'Resilience4j 2.3.0 / Cache-Aside / Fallback':'Lógica de consulta',
    d.id==='lic'?'Cache-Aside: consulta el repositorio antes de ANT; devuelve caché fresca hasta 15 min. Circuit Breaker Resilience4j: ventana 10 llamadas, mínimo 4, umbral 50 %, apertura 30 s, dos llamadas en semiabierto. Fallback: recupera la última respuesta válida hasta 24 h y la marca desactualizada; sin respaldo devuelve puntos null e indisponibilidad. Guarda únicamente respuestas válidas, incluido cero; no prolonga TTL.':d.id==='tax'?'Consulta existencia y datos oficiales SRI; confirma el mismo RUC y tipo PERSONA NATURAL. Devuelve nombre, estadoContribuyenteRuc y demás información disponible; deriva la cédula en el DTO de respuesta.':'Consulta existencia por placa, obtiene codigoVehiculo de la respuesta y consulta rubros con ese código real mediante getOptional. HTTP 204 de rubros conserva el vehículo y devuelve total null con aviso explícito. Calcula BigDecimal únicamente en formatos inequívocos, sin duplicados ni subtotales. No acredita propiedad del vehículo.',base+d.service+'.java',['Java',...(d.id==='lic'?['Resilience4j']:[])]);
  object(d.ids[2],d.client,'component',d.id,d.id==='lic'?'Java HttpClient / Jsoup 1.21.2':'Java HttpClient / Jackson',
    d.id==='lic'?'Consulta la URL oficial ANT por Java HttpClient; distingue 401/403 de 502. Timeout de conexión y solicitud 5 s. Solo interpreta HTML 200 con selector verificado configurado; rechaza restricciones, CAPTCHA y valores inválidos. Las simulaciones HTTP y el selector sintético existen exclusivamente en tests.':d.id==='car'?'Java HttpClient y Jackson. Reconoce el mensaje oficial La placa existe y respuestas booleanas. get exige contenido válido; getOptional permite 204 únicamente para datos opcionales de rubros. No registra datos personales.':'Cliente HTTPS SRI con timeout y comprobación HTTP/JSON; no registra datos personales.',base+d.client+'.java',['Java',...(d.id==='lic'?['Jsoup']:[])]);
  if(d.id!=='car') object(d.id+'-input','Input','component',d.id,'Validación ecuatoriana','Valida RUC natural, cédula y dígito verificador en el backend.',base+'Input.java',['Java']);
  object(d.id+'-errors','Errors','component',d.id,'RestControllerAdvice / ApiException','Manejo centralizado de validación, errores de dominio y fallos externos sin datos personales en mensajes técnicos.',base+'Errors.java',['Spring Boot','Java']);
  const route='/api/'+({tax:'contribuyentes',car:'vehiculos',lic:'licencias'}[d.id])+'/consultar';
  const controller=base+d.controller+'.java', service=base+d.service+'.java', client=base+d.client+'.java';
  const gatewayConfig='api-gateway/src/main/resources/application.yml';
  connection('gateway',d.id,'Enruta POST '+route,'C2','HTTP / JSON · puerto '+d.port,'Conserva la ruta y reenvía la consulta al microservicio correspondiente; propaga la respuesta JSON.',[gatewayConfig,controller]);
  connection('gateway',d.ids[0],'POST '+route,'C3','HTTP / JSON · puerto '+d.port,'La ruta del Gateway entrega la solicitud al controlador REST anotado con @PostMapping; el microservicio valida su DTO.',[gatewayConfig,controller]);
  connection(d.ids[0],d.ids[1],'Invoca consultar con entrada validada','C3','Java en proceso / DTO','El controlador llama a service.consultar con '+(d.id==='tax'?'el RUC validado.':d.id==='car'?'la placa sin guion.':'la cédula derivada del RUC validado.'),[controller,service]);
  if(d.id!=='car') connection(d.ids[0],d.id+'-input','Valida el RUC natural','C3','Java en proceso / llamada estática','Invoca Input.requireRuc: comprueba longitud, provincia, tercer dígito, sufijo 001 y dígito verificador de cédula. La derivación de cédula ocurre fuera de Input.',[controller,base+'Input.java']);
  // Errors is cross-cutting MVC advice, not a service dependency.
  connection(d.id+'-errors',d.ids[0],'Gestiona excepciones del endpoint','C3','Spring MVC / @RestControllerAdvice','Spring aplica los @ExceptionHandler globales al endpoint: errores de validación o JSON generan 400, ApiException conserva su estado HTTP y otros fallos generan 503. No es una llamada directa de Errors al controlador.',[base+'Errors.java',controller],'soporte transversal del framework');
  connection(d.ids[1],d.ids[2],d.id==='lic'?'Consulta ANT protegida por Circuit Breaker':'Solicita datos oficiales del SRI','C3','Java en proceso',d.id==='lic'?'LicenciaService ejecuta ant.consultar mediante circuit.executeSupplier únicamente si no existe caché fresca. Los fallos alimentan el circuito y activan el fallback.':d.id==='tax'?'ContribuyenteService llama a SriClient.get para existePorNumeroRuc y, si existe, obtenerPorNumerosRuc.':'VehiculoService llama a SriClient.get para existencia y datos del vehículo; usa getOptional para rubros con el codigoVehiculo recibido. Los rubros vacíos no descartan la información válida del vehículo.',[service,client]);
  connection(d.ids[2],d.id==='lic'?'ant':'sri',d.id==='lic'?'GET oficial de puntos por cédula':'GET REST oficial del SRI','C3',d.id==='lic'?'HTTPS / GET / HTML; Java HttpClient + Jsoup':'HTTPS / GET / JSON; Java HttpClient + Jackson',d.id==='lic'?'Consulta clp_grid_citaciones.jsp con ps_tipo_identificacion=CED, ps_identificacion y ps_placa vacío. Timeout de conexión y solicitud 5 s. Rechaza 401/403, 502, CAPTCHA y resultados inválidos; requiere selector verificado para extraer puntos.':d.id==='tax'?'Consume ConsolidadoContribuyente/existePorNumeroRuc?numeroRuc y obtenerPorNumerosRuc?ruc. Timeout de conexión 5 s y solicitud 10 s; comprueba estado HTTP y JSON.':'Consume BaseVehiculo/existePorNumeroPlaca?numeroPlaca, obtenerPorNumeroPlacaOPorNumeroCampvOPorNumeroCpn?numeroPlacaCampvCpn y ConsultaRubros/obtenerPorCodigoVehiculo?codigoVehiculo. HTTP 204 se informa como consulta sin contenido, sin inventar resultados.',[client,service]);
}
object('lr','RedisCacheRepository','component','lic','Spring Data Redis / Lettuce / HMAC-SHA256','Implementa CacheRepository. GET/SET con TTL restante hasta 24 h desde la obtención. Sin TLS solo acepta synthetic:UUID; namespace de pruebas separado. Rechaza cédulas reales antes de acceder a Redis.','ms-licencias/src/main/java/ec/consulta/RedisCacheRepository.java',['Java','Redis']);
const redis=object('redis','Redis Cloud DISARQSFT','store','sys','Redis Cloud · AWS · 30 MB · TCP :16824','Caché administrada externamente que pertenece al sistema lógico Consulta Ciudadana. Configuración actual sin TLS: solo datos sintéticos. Datos personales bloqueados hasta usar transporte cifrado. Vigencia fresca 15 min; respaldo máximo 24 h desde la obtención. Claves HMAC-SHA256; valor limitado a puntos y fecha. Host y secretos solo en .env ignorado por Git.',null,['Redis']);
redis.external=true;
const gatewayConfig='api-gateway/src/main/resources/application.yml';
const taxBase='ms-contribuyentes/src/main/java/ec/consulta/';
const carBase='ms-vehiculos/src/main/java/ec/consulta/';
const licenseBase='ms-licencias/src/main/java/ec/consulta/';
const frontend='frontend-angular/src/main.ts';
redis.links=[link(repository+'/blob/main/ms-licencias/src/main/resources/application.yml','Configuración Redis por variables de entorno'),link(repository+'/blob/main/.env.example','Plantilla de configuración sin secretos')];
objects.find(o=>o.id==='lr').links.push(link(repository+'/blob/main/'+licenseBase+'CacheRepository.java','Interfaz CacheRepository implementada'));
connection('user','sys','Consulta contribuyente, vehículo y licencia','C1','Interfaz web / HTTP local','El ciudadano introduce correo, RUC natural y placa en Angular y consulta datos oficiales; la interfaz no acredita propiedad del vehículo.',[frontend]);
connection('sys','sri','Consulta información tributaria y vehicular','C1','HTTPS / GET / REST JSON','Las integraciones de contribuyentes y vehículos consultan exclusivamente los endpoints oficiales SRI.',[taxBase+'SriClient.java',carBase+'SriClient.java']);
connection('sys','ant','Consulta puntos con tolerancia a fallos','C1','HTTPS / GET / HTML','El microservicio de licencias consulta la página ANT; controla indisponibilidad con caché, circuito y fallback.',[licenseBase+'AntClient.java',licenseBase+'LicenciaService.java']);
connection('user','web','Introduce datos y visualiza resultados','C2','HTTP local :4200 / navegador HTML','Formularios progresivos de correo y RUC, placa y puntos; validación, carga, errores, origen y antigüedad del dato.',[frontend]);
connection('web','gateway','POST /api de contribuyentes, vehículos y licencias','C2','HTTP / JSON · Gateway :8080','HttpClient de Angular consume /api; el proxy de desarrollo o nginx reenvían al Gateway. Angular nunca llama directamente al SRI ni a la ANT.',[frontend,'frontend-angular/proxy.conf.json','frontend-angular/nginx.conf',gatewayConfig]);
connection('tax','sri','Verifica RUC natural y obtiene contribuyente','C2','HTTPS / GET / REST JSON','Comprueba existencia, mismo RUC y tipo persona natural; muestra razón social y estado oficial.',[taxBase+'ContribuyenteService.java',taxBase+'SriClient.java']);
connection('car','sri','Verifica placa y consulta vehículo y rubros','C2','HTTPS / GET / REST JSON','Usa la placa solicitada, extrae codigoVehiculo de la respuesta y consulta valores de matrícula con ese código.',[carBase+'VehiculoService.java',carBase+'SriClient.java']);
connection('lic','ant','Consulta puntos por cédula','C2','HTTPS / GET / HTML · timeout 5 s','Llama a la URL del docente; solo acepta HTML válido con puntos verificables. Restricciones o fallos activan la estrategia de respaldo.',[licenseBase+'AntClient.java',licenseBase+'LicenciaService.java']);
connection('lic','redis','Mantiene caché y último respaldo válido','C2','RESP sobre TCP :16824 · sin TLS actual','Aplica Cache-Aside, HMAC, frescura 15 min y retención 24 h. Sin TLS solo se permiten identificadores sintéticos; el almacenamiento de información personal queda bloqueado.',[licenseBase+'LicenciaService.java',licenseBase+'RedisCacheRepository.java']);
connection('ls','lr','Cache-Aside y Fallback sobre CacheRepository','C3','Java en proceso / interfaz CacheRepository','Invoca cache.get antes de consultar ANT. Si la respuesta es fresca, la devuelve; si no, intenta actualizar. Tras una respuesta válida llama cache.save. Si ANT falla, usa el respaldo leído previamente hasta 24 h, sin prolongar su TTL; sin respaldo retorna puntos null.',[licenseBase+'LicenciaService.java',licenseBase+'CacheRepository.java',licenseBase+'RedisCacheRepository.java']);
connection('lr','redis','GET / SET con HMAC y expiración','C3','RESP sobre TCP :16824 · Spring Data Redis / Lettuce','StringRedisTemplate ejecuta GET y SET con TTL restante hasta 24 h desde actualizadoEn. Las claves usan HMAC-SHA256 y namespaces separados. REDIS_SSL admite TLS, pero actualmente es false y se rechazan identificadores personales antes de cualquier operación.',[licenseBase+'RedisCacheRepository.java','ms-licencias/src/main/resources/application.yml']);

fs.writeFileSync(target, JSON.stringify({namespace:'consulta-ciudadana-sri-ant',modelObjects:objects,modelConnections:connections},null,2)+'\n');
console.log(JSON.stringify({objects:objects.length,connections:connections.length,github:repository || 'Pendiente: no hay remoto configurado',preservedIds:(existing.modelObjects||[]).filter(o=>objects.some(n=>n.id===o.id)).length}));
