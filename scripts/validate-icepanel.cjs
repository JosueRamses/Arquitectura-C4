// npm install in scripts/ first. Fetches the official schema and all nested references.
const fs=require('fs'),path=require('path'),Ajv=require('ajv'),addFormats=require('ajv-formats');
const dir=path.join(__dirname,'../docs/arquitectura');
async function schema(url){
 const file=path.join(dir,'schemas',new URL(url).pathname.split('/').pop()+'.json');
 let data;if(fs.existsSync(file))data=JSON.parse(fs.readFileSync(file));else{const res=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Schema HTTP '+res.status);data=await res.json();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2));}
 return data;
}
(async()=>{
 const ajv=new Ajv({strict:false,allErrors:true,loadSchema:schema});addFormats(ajv);
 const official=await schema('https://api.icepanel.io/v1/schemas/LandscapeImportData');
 const validate=await ajv.compileAsync(official);
 const target=process.argv[2]?path.resolve(process.argv[2]):path.join(dir,'icepanel-import.json');
 const data=JSON.parse(fs.readFileSync(target));
 if(!validate(data))throw Error(JSON.stringify(validate.errors,null,2));
 const ids=new Set(data.modelObjects.map(o=>o.id));
 if(ids.size!==data.modelObjects.length)throw Error('IDs de objetos duplicados');
 if(new Set(data.modelConnections.map(c=>c.id)).size!==data.modelConnections.length)throw Error('IDs de relaciones duplicados');
 const objects=new Map(data.modelObjects.map(o=>[o.id,o]));
 const domains=data.modelObjects.filter(o=>o.type==='domain');
 if(domains.length!==1||domains[0].name!=='Consulta Ciudadana SRI-ANT')throw Error('Debe existir únicamente el dominio Consulta Ciudadana SRI-ANT');
 const names=new Set();
 const parents={actor:['domain'],system:['domain'],app:['system'],store:['system'],component:['app','store'],group:['domain','group']};
 for(const o of data.modelObjects){
  const identity=[o.parentId||'',o.type,o.name].join('|');
  if(names.has(identity))throw Error('Objeto duplicado en el mismo padre: '+o.name);
  names.add(identity);
  if(o.type==='domain'){if(o.parentId)throw Error('Domain debe ser raíz');continue;}
  if(!parents[o.type]?.includes(objects.get(o.parentId)?.type))throw Error('Jerarquía C4 inválida: '+o.id);
 }
 const pairs=new Set();
 for(const c of data.modelConnections){
  if(!ids.has(c.originId)||!ids.has(c.targetId))throw Error('Referencia inexistente');
  if(!c.labels?.protocolo||!c.labels?.responsabilidad||!c.description)throw Error('Relación sin protocolo/responsabilidad: '+c.id);
  const pair=[c.originId,c.targetId,c.labels.vista].join('|');
  if(pairs.has(pair))throw Error('Relación duplicada: '+c.id);
  pairs.add(pair);
 }
 const root=path.resolve(__dirname,'..');
 for(const item of [...data.modelObjects,...data.modelConnections])for(const link of item.links||[]){
  const url=new URL(link.url);if(url.hostname!=='github.com')continue;
  const match=url.pathname.match(/^\/JosueRamses\/Arquitectura-C4\/(?:blob|tree)\/main\/(.+)$/);if(!match)continue;
  const source=path.resolve(root,decodeURIComponent(match[1]));
  if(!source.startsWith(root+path.sep)||!fs.existsSync(source))throw Error('Enlace GitHub sin archivo implementado: '+link.url);
 }
 const result={validatedAt:new Date().toISOString(),schema:official.$id,valid:true,objects:data.modelObjects.length,connections:data.modelConnections.length};
 console.log(result);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
