const results=[];
async function check(name,url,options,expected){const response=await fetch(url,{...options,signal:AbortSignal.timeout(12000)});const body=await response.text();const pass=response.status===expected;results.push({name,status:response.status,expected,pass});if(!pass)throw Error(name+': '+body);return body;}
(async()=>{
for(const port of [8080,8081,8082,8083])await check('health '+port,'http://127.0.0.1:'+port+'/actuator/health',{},200);
await check('Angular HTML','http://127.0.0.1:4200/',{},200);
for(const base of ['http://127.0.0.1:8080','http://127.0.0.1:4200'])for(const [service,data]of [['contribuyentes',{correo:'invalid',ruc:'123'}],['vehiculos',{placa:'invalid!'}],['licencias',{ruc:'123'}]])await check(base+' → '+service,base+'/api/'+service+'/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)},400);
const preflight=await fetch('http://127.0.0.1:8080/api/contribuyentes/consultar',{method:'OPTIONS',headers:{Origin:'http://localhost:4200','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type'}});const cors=preflight.headers.get('access-control-allow-origin')==='http://localhost:4200';results.push({name:'CORS localhost:4200',pass:cors});if(!cors)throw Error('CORS incorrecto');
console.log(results);
})().catch(e=>{console.error(e.message);process.exitCode=1});
