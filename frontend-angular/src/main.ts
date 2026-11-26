import {Component, inject} from '@angular/core';
import {bootstrapApplication} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient, HttpErrorResponse, provideHttpClient} from '@angular/common/http';

interface Contributor {ruc:string;cedula:string;nombre:string|null;tipo:string;estado:string|null;datos:unknown}
interface Vehicle {vehiculo:Record<string,unknown>;rubros:unknown;conceptos:{concepto:string;valor:number}[]|null;total:number|null;aviso:string}
interface License {puntos:number|null;actualizadoEn:string|null;origen:string|null;desactualizado:boolean;disponibilidad:string;mensaje:string}
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.html'})
class App {
 private http=inject(HttpClient);correo='';ruc='';placa='';gateway='Comprobando';contribuyente:Contributor|null=null;vehiculo:Vehicle|null=null;licencia:License|null=null;cargando=false;cargandoVehiculo=false;cargandoLicencia=false;error='';errorVehiculo='';
 constructor(){this.http.get('/actuator/health').subscribe({next:()=>this.gateway='Conectado',error:()=>this.gateway='No disponible'});}
 get busy(){return this.cargando||this.cargandoVehiculo||this.cargandoLicencia;}
 activity(){const data=this.contribuyente?.datos;if(!data||typeof data!=='object'||Array.isArray(data))return null;const value=(data as Record<string,unknown>)['actividadEconomicaPrincipal'];return typeof value==='string'&&value.trim()?value:null;}
 licenseText(l:License){
  if(l.puntos!==null)return l.desactualizado?'La ANT no está disponible. Mostramos la última consulta válida; los puntos pueden haber cambiado.':l.origen==='Redis Cloud'?'Estos puntos corresponden a una consulta reciente.':'Información obtenida de la Agencia Nacional de Tránsito.';
  if(/401|403|restring|autoriz|captcha/i.test(l.mensaje))return 'La ANT restringió el acceso a esta consulta. Puedes consultar directamente en su portal oficial.';
  if(/selector|estructura|interpret|extraer/i.test(l.mensaje))return 'No pudimos verificar los puntos en la respuesta de la ANT. Puedes revisarlos en su portal oficial.';
  return 'No pudimos obtener los puntos de la ANT y no hay una consulta anterior disponible. Inténtalo más tarde o revisa su portal oficial.';
 }
 validRuc(){const n=this.ruc;if(!/^[0-9]{13}$/.test(n)||!n.endsWith('001'))return false;const province=Number(n.slice(0,2));if(!((province>=1&&province<=24)||province===30)||Number(n[2])>5)return false;let sum=0;for(let i=0;i<9;i++){let v=Number(n[i]);if(i%2===0){v*=2;if(v>9)v-=9;}sum+=v;}return (10-sum%10)%10===Number(n[9]);}
 message(e:HttpErrorResponse){return e.error?.message||'Servicio no disponible. Intenta nuevamente.';}
 consultar(){if(!this.validRuc()||this.cargando)return;this.cargando=true;this.error='';this.http.post<Contributor>('/api/contribuyentes/consultar',{correo:this.correo,ruc:this.ruc}).subscribe({next:c=>{this.contribuyente=c;this.cargando=false;this.consultarLicencia();},error:e=>{this.error=this.message(e);this.cargando=false;}});}
 consultarVehiculo(){if(!this.contribuyente||this.cargandoVehiculo)return;this.cargandoVehiculo=true;this.errorVehiculo='';this.vehiculo=null;this.http.post<Vehicle>('/api/vehiculos/consultar',{placa:this.placa}).subscribe({next:v=>{this.vehiculo=v;this.cargandoVehiculo=false;},error:e=>{this.errorVehiculo=this.message(e);this.cargandoVehiculo=false;}});}
 consultarLicencia(){if(!this.contribuyente||this.cargandoLicencia)return;this.cargandoLicencia=true;this.http.post<License>('/api/licencias/consultar',{ruc:this.contribuyente.ruc}).subscribe({next:l=>{this.licencia=l;this.cargandoLicencia=false;},error:e=>{this.licencia={puntos:null,actualizadoEn:null,origen:null,desactualizado:false,disponibilidad:'NO_DISPONIBLE',mensaje:this.message(e)};this.cargandoLicencia=false;}});}
 vehicleFields(v:Record<string,unknown>){const fields=[{label:'Placa',keys:['numeroPlaca','placa']},{label:'Marca',keys:['descripcionMarca','marca']},{label:'Modelo',keys:['descripcionModelo','modelo']},{label:'Año',keys:['anioAuto','anioModelo','anio']},{label:'Color',keys:['colorVehiculo1','color']},{label:'Clase',keys:['nombreClase','clase']}];return fields.flatMap(field=>{const key=field.keys.find(k=>v[k]!==undefined&&v[k]!==null&&typeof v[k]!=='object');return key?[{label:field.label,value:String(v[key])}]:[];});}
 reset(){this.correo='';this.ruc='';this.placa='';this.contribuyente=null;this.vehiculo=null;this.licencia=null;this.error='';this.errorVehiculo='';window.scrollTo({top:0,behavior:'smooth'});}
}
bootstrapApplication(App,{providers:[provideHttpClient()]}).catch(()=>console.error('No fue posible iniciar la interfaz.'));
