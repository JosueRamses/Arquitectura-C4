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
function connection(originId, targetId, name, level) {
  const previous = (existing.modelConnections || []).find(c => c.originId === originId && c.targetId === targetId);
  connections.push({id:previous?.id || `conn-${originId}-${targetId}`, originId, targetId, name, direction:'outgoing', labels:{vista:level}});
}
object('dom','Consulta ciudadana SRI-ANT','domain',null,'Arquitectura C4','Modelo derivado del código y la configuración efectiva.');
const citizen = object('user','Ciudadano','actor','dom','Navegador web','Ingresa un correo, RUC natural y placa autorizados. La consulta vehicular no acredita propiedad.');
const system = object('sys','Consulta Ciudadana','system','dom','Angular + Gateway + tres microservicios','Validación SRI; datos vehiculares y rubros; consulta ANT con caché y resiliencia.');
if (repository) system.links = [link(repository,'Repositorio GitHub'), link(repository+'/blob/main/README.md','Ejecución y configuración')];
const sri = object('sri','SRI','system','dom','Servicio externo HTTPS / REST','Existencia y datos del contribuyente, vehículo y rubros. No se inventan resultados.');
sri.external = true;
sri.links = [link('https://srienlinea.sri.gob.ec/','SRI en línea')];
const ant = object('ant','ANT','system','dom','Portal externo HTTPS / HTML','Portal oficial de consultas: HTTP 502 confirmado en Edge y cliente HTTP; la web principal ANT responde HTTP 200 y enlaza al mismo portal. El HTTP 401 inicial indicó rechazo de acceso, sin poder determinar su causa interna. Se conserva URL del docente, diagnóstico diferenciado y fallback. Selector real aún sin verificar.');
ant.external = true;
ant.links = [link('https://consultaweb.ant.gob.ec/PortalWEB/','Portal oficial de consultas ANT')];
object('web','Frontend Angular','app','sys','Angular 20.3 / TypeScript 5.9 · HTTP :4200','Formularios progresivos en español, validaciones, datos oficiales, dólares, carga, errores y estado de caché. Consume solo /api del Gateway.','frontend-angular',['Angular','TypeScript']);
object('gateway','API Gateway','app','sys','Spring Cloud Gateway 2025.0 / Java 21 · HTTP :8080','Enrutamiento HTTP a tres microservicios, CORS y health. Configuración real en application.yml.','api-gateway',['Spring Cloud Gateway','Spring Boot','Java']);
const definitions = [
  {id:'tax', folder:'ms-contribuyentes', name:'MS Contribuyentes', port:8081, controller:'ContribuyenteController', service:'ContribuyenteService', client:'SriClient', ids:['tc','ts','ta']},
  {id:'car', folder:'ms-vehiculos', name:'MS Vehículos', port:8082, controller:'VehiculoController', service:'VehiculoService', client:'SriClient', ids:['vc','vs','va']},
  {id:'lic', folder:'ms-licencias', name:'MS Licencias', port:8083, controller:'LicenciaController', service:'LicenciaService', client:'AntClient', ids:['lc','ls','la']}
];
for (const d of definitions) {
  object(d.id,d.name,'app','sys',`Java 21 / Spring Boot 3.5.8 / Maven · HTTP :${d.port}`,
    d.id==='lic'?'Cache-Aside: datos frescos 15 min; respaldo máximo 24 h; circuito Resilience4j 50%, mínimo 4 llamadas, apertura 30 s; Jsoup; timeout ANT 5 s.':d.id==='tax'?'Confirma existencia, RUC coincidente y tipo persona natural según respuesta SRI.':'Confirma placa, obtiene codigoVehiculo real y consulta rubros; BigDecimal; formatos ambiguos no se suman.',d.folder,['Spring Boot','Java','Maven']);
  const base = d.folder+'/src/main/java/ec/consulta/';
  object(d.ids[0],d.controller,'component',d.id,'REST controller / DTOs / Jakarta Validation',
    'Recibe POST /api/'+(d.id==='tax'?'contribuyentes':d.id==='car'?'vehiculos':'licencias')+'/consultar; valida entradas y delega al servicio.',base+d.controller+'.java',['Spring Boot','Java']);
  object(d.ids[1],d.service,'component',d.id,d.id==='lic'?'Resilience4j 2.3.0 / Cache-Aside / Fallback':'Lógica de consulta',
    d.id==='lic'?'Lee Redis antes de ANT. Respuesta válida de cero puntos distinta de error. Ante fallo recupera el respaldo vigente y marca desactualizado; sin respaldo informa indisponibilidad. No prolonga TTL.':'Coordina consultas oficiales, valida la respuesta y devuelve DTOs. No usa fixtures en producción.',base+d.service+'.java',['Java',...(d.id==='lic'?['Resilience4j']:[])]);
  object(d.ids[2],d.client,'component',d.id,d.id==='lic'?'Java HttpClient / Jsoup 1.21.2':'Java HttpClient / Jackson',
    d.id==='lic'?'Consulta la URL oficial ANT por Java HttpClient; distingue 401/403 de 502. Timeout de conexión y solicitud 5 s. Solo interpreta HTML 200 con selector verificado configurado; rechaza restricciones, CAPTCHA y valores inválidos. Las simulaciones HTTP y el selector sintético existen exclusivamente en tests.':'Cliente HTTPS SRI con timeout y comprobación HTTP/JSON; no registra datos personales.',base+d.client+'.java',['Java',...(d.id==='lic'?['Jsoup']:[])]);
  if(d.id!=='car') object(d.id+'-input','Input','component',d.id,'Validación ecuatoriana','Valida RUC natural, cédula y dígito verificador en el backend.',base+'Input.java',['Java']);
  object(d.id+'-errors','Errors','component',d.id,'RestControllerAdvice / ApiException','Manejo centralizado de validación, errores de dominio y fallos externos sin datos personales en mensajes técnicos.',base+'Errors.java',['Spring Boot','Java']);
  connection('gateway',d.id,'POST JSON · ruta /api correspondiente','C2');
  connection('gateway',d.ids[0],'HTTP JSON · entrada al controlador','C3');
  connection(d.ids[0],d.ids[1],'DTO de solicitud validado','C3');
  if(d.id!=='car') connection(d.ids[0],d.id+'-input','Valida RUC y deriva cédula natural','C3');
  // Errors is cross-cutting MVC advice, not a service dependency.
  connection(d.id+'-errors',d.ids[0],'Advice MVC: transforma excepciones en respuestas HTTP','C3');
  connection(d.ids[1],d.ids[2],d.id==='lic'?'Circuit Breaker Resilience4j · consulta si caché no fresca':'Consulta existencia y datos oficiales','C3');
  connection(d.ids[2],d.id==='lic'?'ant':'sri',d.id==='lic'?'HTTPS HTML · Jsoup · sin selector aún verificado':'HTTPS JSON · SRI oficial','C3');
}
object('lr','RedisCacheRepository','component','lic','Spring Data Redis / Lettuce / HMAC-SHA256','Implementa CacheRepository. GET/SET con TTL restante hasta 24 h desde la obtención. Sin TLS solo acepta synthetic:UUID; namespace de pruebas separado. Rechaza cédulas reales antes de acceder a Redis.','ms-licencias/src/main/java/ec/consulta/RedisCacheRepository.java',['Java','Redis']);
object('redis','Redis Cloud DISARQSFT','store','sys','Redis Cloud · AWS · 30 MB · TCP :16824','Servicio Cloud administrado externo. Configuración actual sin TLS: exclusivamente datos sintéticos. Datos personales bloqueados hasta usar transporte cifrado. Caché fresca 15 min, retención máxima 24 h. Host y secretos solo en .env ignorado por Git.',null,['Redis']);
connection('user','sys','Consulta información autorizada mediante interfaz web','C1');
connection('sys','sri','Consulta contribuyente, vehículo y rubros por HTTPS','C1');
connection('sys','ant','Consulta puntos por HTTPS; indisponibilidad controlada','C1');
connection('user','web','Navegador HTTP local :4200','C2');
connection('web','gateway','HTTP JSON /api · proxy Angular o nginx','C2');
connection('tax','sri','HTTPS REST · RUC','C2');
connection('car','sri','HTTPS REST · placa, código real y rubros','C2');
connection('lic','ant','HTTPS HTML · timeout 5 s; acceso no confirmado','C2');
connection('lic','redis','RESP TCP sin TLS: solo pruebas sintéticas','C2');
connection('ls','lr','Cache-Aside 15 min · Fallback hasta 24 h','C3');
connection('lr','redis','HMAC · TTL restante 24 h · bloqueo de datos personales sin TLS','C3');

fs.writeFileSync(target, JSON.stringify({namespace:'consulta-ciudadana-sri-ant',modelObjects:objects,modelConnections:connections},null,2)+'\n');
function mermaid(ids, level) {
  const nodes = objects.filter(o=>ids.includes(o.id));
  const edges = connections.filter(c=>c.labels.vista===level && ids.includes(c.originId) && ids.includes(c.targetId));
  return 'flowchart LR\n'+nodes.map(o=>`  ${o.id.replaceAll('-','_')}["${o.name.replaceAll('"','')}${o.caption?' · '+o.caption:''}"]`).join('\n')+'\n'+edges.map(c=>`  ${c.originId.replaceAll('-','_')} -->|"${c.name}"| ${c.targetId.replaceAll('-','_')}`).join('\n')+'\n';
}
const diagrams = {'C1-contexto.mmd':mermaid(['user','sys','sri','ant'],'C1'), 'C2-contenedores.mmd':mermaid(['user','web','gateway','tax','car','lic','redis','sri','ant'],'C2')};
for (const d of definitions) diagrams['C3-'+({tax:'contribuyentes',car:'vehiculos',lic:'licencias'}[d.id])+'.mmd']=mermaid(['gateway',...objects.filter(o=>o.parentId===d.id).map(o=>o.id),d.id==='lic'?'ant':'sri',...(d.id==='lic'?['redis']:[])],'C3');
for (const [name,content] of Object.entries(diagrams)) fs.writeFileSync(path.join(dir,name),content);
fs.writeFileSync(path.join(dir,'diagramas.md'), Object.entries(diagrams).map(([name,content])=>`## ${name.replace('.mmd','')}\n\n\`\`\`mermaid\n${content}\`\`\`\n`).join('\n'));
console.log(JSON.stringify({objects:objects.length,connections:connections.length,github:repository || 'Pendiente: no hay remoto configurado',preservedIds:(existing.modelObjects||[]).filter(o=>objects.some(n=>n.id===o.id)).length}));
