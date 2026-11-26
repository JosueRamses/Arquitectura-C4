// npm install in scripts/ first. Fetches the official schema and all nested references.
const fs=require('fs'),path=require('path'),Ajv=require('ajv'),addFormats=require('ajv-formats');
const dir=path.join(__dirname,'../docs/arquitectura');
async function schema(url){
 const file=path.join(dir,'schemas',new URL(url).pathname.split('/').pop()+'.json');
 let data;if(fs.existsSync(file))data=JSON.parse(fs.readFileSync(file));else{const res=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error('Schema HTTP '+res.status);data=await res.json();fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2));}
 return data;
}
(async()=>{const ajv=new Ajv({strict:false,allErrors:true,loadSchema:schema});addFormats(ajv);const official=await schema('https://api.icepanel.io/v1/schemas/LandscapeImportData');const validate=await ajv.compileAsync(official);const data=JSON.parse(fs.readFileSync(path.join(dir,'icepanel-import.json')));if(!validate(data))throw Error(JSON.stringify(validate.errors,null,2));const ids=new Set(data.modelObjects.map(o=>o.id));for(const c of data.modelConnections)if(!ids.has(c.originId)||!ids.has(c.targetId))throw Error('Referencia inexistente');const result={validatedAt:new Date().toISOString(),schema:official.$id,valid:true,objects:data.modelObjects.length,connections:data.modelConnections.length};fs.writeFileSync(path.join(dir,'validation.json'),JSON.stringify(result,null,2));console.log(result);})().catch(e=>{console.error(e.message);process.exitCode=1;});
