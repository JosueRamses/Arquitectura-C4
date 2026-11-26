// Run with playwright available via NODE_PATH or npm install --no-save playwright.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4200');await page.getByRole('heading',{name:'Identificación del contribuyente'}).waitFor();
 if(!await page.locator('#placa').isDisabled())throw Error('Formulario vehicular habilitado prematuramente');
 await page.locator('#correo').fill('correo-invalido');await page.locator('#ruc').fill('123');if(!await page.getByRole('button',{name:'Consultar contribuyente'}).isDisabled())throw Error('Entrada inválida aceptada');
 await page.screenshot({path:'.runtime/interfaz-desktop.png',fullPage:true});
 // Network fixtures exist exclusively inside this browser test.
 await page.route('**/api/contribuyentes/consultar',r=>r.fulfill({json:{ruc:'1710034065001',cedula:'1710034065',nombre:'PERSONA DE PRUEBA',tipo:'PERSONA NATURAL',estado:'ACTIVO',datos:{fixture:true}}}));
 await page.route('**/api/licencias/consultar',r=>r.fulfill({json:{puntos:0,actualizadoEn:'2026-11-26T12:00:00Z',origen:'Redis Cloud',desactualizado:true,disponibilidad:'NO_DISPONIBLE',mensaje:'Fixture: respaldo válido ante indisponibilidad.'}}));
 await page.route('**/api/vehiculos/consultar',r=>r.fulfill({json:{vehiculo:{marca:'MARCA DE PRUEBA',numeroPlaca:'ABC1234'},rubros:[],conceptos:[{concepto:'Tasa de prueba',valor:12.5}],total:12.5,aviso:'La consulta no acredita propiedad.'}}));
 await page.locator('#correo').fill('test@example.com');await page.locator('#ruc').fill('1710034065001');await page.getByRole('button',{name:'Consultar contribuyente'}).click();await page.getByText('PERSONA DE PRUEBA',{exact:true}).waitFor();
 if(await page.locator('#placa').isDisabled())throw Error('Formulario progresivo no habilitado');await page.getByText('Información desactualizada',{exact:true}).waitFor();
 if(await page.locator('.points strong').innerText()!=='0')throw Error('Cero puntos confundido con ausencia de datos');
 await page.locator('#placa').fill('abc1234');await page.locator('.inline button').click();await page.getByText('$12.50',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'Nueva consulta'}).click();if(!await page.locator('#placa').isDisabled())throw Error('Nueva consulta no reinicia el flujo');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.runtime/interfaz-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Desbordamiento horizontal móvil');if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: interfaz, formularios, progresión, vehículo, cero puntos, fallback, reinicio, móvil; sin errores JavaScript. Integraciones simuladas únicamente en el test.');await browser.close();})().catch(e=>{console.error(e);process.exitCode=1});
