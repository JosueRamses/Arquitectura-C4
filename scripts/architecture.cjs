const fs=require('fs'),path=require('path');const dir=path.join(__dirname,'../docs/arquitectura');fs.mkdirSync(dir,{recursive:true});
const objects=[],connections=[];
function obj(id,name,type,parentId){objects.push({id,name,type,...(parentId?{parentId}:{})});}
function conn(originId,targetId,name){connections.push({id:'conn-'+originId+'-'+targetId,originId,targetId,name,direction:'outgoing'});}
obj('domain-consulta','Consulta Ciudadana','domain');obj('ciudadano','Ciudadano','actor','domain-consulta');obj('consulta','Sistema Consulta Ciudadana','system','domain-consulta');obj('sri','SRI','system','domain-consulta');obj('ant','ANT','system','domain-consulta');
for(const [id,name,type] of [['frontend','Frontend Angular','app'],['gateway','API Gateway · Spring Cloud','app'],['contribuyentes','Microservicio contribuyentes','app'],['vehiculos','Microservicio vehículos','app'],['licencias','Microservicio licencias','app'],['redis','Redis Cloud · TLS','store']])obj(id,name,type,'consulta');
conn('ciudadano','frontend','Consulta mediante navegador');conn('frontend','gateway','HTTP JSON · /api');for(const id of ['contribuyentes','vehiculos','licencias'])conn('gateway',id,'HTTP JSON');conn('contribuyentes','sri','HTTPS REST · contribuyentes');conn('vehiculos','sri','HTTPS REST · vehículos y rubros');conn('licencias','ant','HTTPS HTML · timeout 5 s');conn('licencias','redis','TLS · HMAC SHA256 · respaldo 24 h');
for(const [id,names] of [['contribuyentes',['ContribuyenteController','ContribuyenteService','SriClient']],['vehiculos',['VehiculoController','VehiculoService','SriClient']],['licencias',['LicenciaController','LicenciaService','AntClient','RedisCacheRepository']]]){
 for(const name of names)obj(id+'-'+name,name,'component',id);
 conn(id+'-'+names[0],id+'-'+names[1],'DTO validado');conn(id+'-'+names[1],id+'-'+names[2],id==='licencias'?'Circuit Breaker · 50%, 30 s':'Consulta oficial');
 if(id==='licencias'){conn(id+'-LicenciaService',id+'-RedisCacheRepository','Cache-Aside 15 min · Fallback hasta 24 h');conn(id+'-RedisCacheRepository','redis','GET/SET EX 86400 · claves HMAC');conn(id+'-AntClient','ant','HTTP + Jsoup · selector verificado requerido');}else conn(id+'-SriClient','sri','HTTPS REST');
}
fs.writeFileSync(path.join(dir,'icepanel-import.json'),JSON.stringify({namespace:'consulta-ciudadana-sri-ant',modelObjects:objects,modelConnections:connections},null,2));
const diagrams={
 'C1-contexto.mmd':`flowchart LR
 ciudadano[Ciudadano] --> sistema[Sistema Consulta Ciudadana]
 sistema --> sri[SRI · HTTPS REST]
 sistema --> ant[ANT · HTTPS HTML]
`,
 'C2-contenedores.mmd':`flowchart LR
 ciudadano[Ciudadano] --> frontend[Angular · 4200]
 subgraph consulta[Sistema Consulta Ciudadana]
 frontend --> gateway[Spring Cloud Gateway · 8080]
 gateway --> contribuyentes[Contribuyentes · 8081]
 gateway --> vehiculos[Vehículos · 8082]
 gateway --> licencias[Licencias · 8083]
 licencias --> redis[(Redis Cloud · TLS)]
 end
 contribuyentes --> sri[SRI]
 vehiculos --> sri
 licencias --> ant[ANT]
`};
for(const id of ['contribuyentes','vehiculos','licencias']){const names=objects.filter(o=>o.parentId===id).map(o=>o.name);diagrams['C3-'+id+'.mmd']='flowchart LR\n gateway[API Gateway] --> controller['+names[0]+']\n controller --> service['+names[1]+']\n service -->|'+(id==='licencias'?'Circuit Breaker 50% · 30 s':'HTTPS REST')+'| client['+names[2]+']\n client --> external['+(id==='licencias'?'ANT · Jsoup · timeout 5 s':'SRI')+']\n'+(id==='licencias'?' service -->|Cache-Aside 15 min · Fallback 24 h| cache[RedisCacheRepository]\n cache -->|HMAC · TLS · TTL 24 h| redis[(Redis Cloud)]\n':'');}
for(const[name,data]of Object.entries(diagrams))fs.writeFileSync(path.join(dir,name),data);
fs.writeFileSync(path.join(dir,'diagramas.md'),Object.entries(diagrams).map(([name,data])=>'## '+name.replace('.mmd','')+'\n\n```mermaid\n'+data+'```\n').join('\n'));
console.log('Modelo y cinco diagramas C4 generados');
