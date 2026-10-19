import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
test.beforeAll(async()=>{await mkdir('artifacts/qa',{recursive:true})})
const correct=['vines','cane','tracks','65','work','extra','pull','spin','lift','optimal','off','idle']
async function join(page:Page,code:string,name:string){await page.goto(`/?sala=${code}`);await page.getByLabel('TU NOMBRE O APODO').fill(name);await page.getByRole('button',{name:'INGRESAR AL JUEGO'}).click();await expect(page.getByText('Ya estás en el equipo.')).toBeVisible()}
async function advance(page:Page,seq:number,id:string){
 const intro=page.getByRole('button',{name:'COMENZAR MISIÓN'})
 if([0,2,4,6,9].includes(seq)) await intro.click()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 if(seq>=6&&seq<=8) await page.getByRole('button',{name:seq===6?'Barra de tiro':seq===7?'TDP':'Tres puntos',exact:true}).last().click()
 await page.getByTestId(`option-${id}`).click();await page.getByTestId('confirm-answer').click();await expect(page.getByText('DECISIÓN CONFIRMADA')).toBeVisible();await page.getByRole('button',{name:'SEGUIR LA JORNADA'}).click()
}
test('docente, dos sesiones, 12 desafíos, ranking, recuperación y cierre',async({browser})=>{
 const tc=await browser.newContext({viewport:{width:1440,height:1000}});const sc=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const sc2=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true})
 const teacher=await tc.newPage();const student=await sc.newPage();const second=await sc2.newPage()
 await teacher.goto('/docente');await teacher.getByLabel('CLAVE DOCENTE DEL SERVIDOR LOCAL').fill('docente');await teacher.getByRole('button',{name:'INGRESAR AL PANEL'}).click();await teacher.getByRole('button',{name:'CREAR SALA',exact:true}).click();await expect(teacher.getByText('CÓDIGO DE SALA',{exact:true})).toBeVisible()
 const code=(await teacher.locator('.room-big-code').innerText()).trim()
 await join(student,code,'Ana del campo');await join(second,code,'Bruno');await expect(teacher.locator('.progress-row')).toHaveCount(2)
 await teacher.getByRole('button',{name:'INICIAR JORNADA'}).click();await expect(student.getByRole('button',{name:'COMENZAR MISIÓN'})).toBeVisible();await advance(student,0,correct[0]);await student.reload();await expect(student.getByText('Espacio bajo el chasis',{exact:true})).toBeVisible()
 await expect(second.getByRole('button',{name:'COMENZAR MISIÓN'})).toBeVisible()
 for(let i=1;i<12;i++){
  if(i===4) {await student.getByRole('button',{name:'COMENZAR MISIÓN'}).click();await expect(student.locator('.challenge')).toHaveCSS('opacity','1');await student.screenshot({path:'artifacts/qa/tablero-movil.png',fullPage:true});await student.getByTestId(`option-${correct[i]}`).click();await student.getByTestId('confirm-answer').click();await student.getByRole('button',{name:'SEGUIR LA JORNADA'}).click()}
  else if(i===6){await student.getByRole('button',{name:'COMENZAR MISIÓN'}).click();await expect(student.locator('.challenge')).toHaveCSS('opacity','1');await student.screenshot({path:'artifacts/qa/conexiones-movil.png',fullPage:true});await student.getByRole('button',{name:'Barra de tiro',exact:true}).last().click();await student.getByTestId('option-pull').click();await student.getByTestId('confirm-answer').click();await student.getByRole('button',{name:'SEGUIR LA JORNADA'}).click()}
  else await advance(student,i,correct[i])
 }
 await expect(student.getByText('Jornada cumplida.')).toBeVisible();await expect(student.locator('.result-total')).toContainText('1000');await expect(teacher.locator('.ranking-row')).toHaveCount(1);await expect(teacher.locator('.ranking-row')).toContainText('Ana del campo');await expect(teacher.locator('.progress-row')).toHaveCount(1)
 for(let i=0;i<12;i++){await advance(second,i,i===0?'standard':correct[i])}
 await expect(second.locator('.result-total')).toContainText('900');await expect(teacher.locator('.ranking-row')).toHaveCount(2)
 await teacher.getByRole('button',{name:'FINALIZAR SALA',exact:true}).click();await teacher.getByRole('button',{name:'SÍ, FINALIZAR SALA'}).click();await expect(teacher.getByText('El podio de la potencia')).toBeVisible();await expect(teacher.locator('.podium-1')).toContainText('Ana del campo');await expect(teacher.locator('.podium-1')).toHaveCSS('opacity','1');await teacher.screenshot({path:'artifacts/qa/panel-docente.png',fullPage:true});await student.screenshot({path:'artifacts/qa/resultado-movil.png',fullPage:true})
 for(const page of [student,second]) expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await tc.close();await sc.close();await sc2.close()
})
test('portada legible y sin desborde en 360, 390 y 430 píxeles',async({page})=>{
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:/MISIÓN/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByLabel('TU NOMBRE O APODO')).toHaveCSS('font-size','16px');await page.screenshot({path:`artifacts/qa/inicio-${width}.png`,fullPage:true})}
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');await page.screenshot({path:'artifacts/qa/inicio-escritorio.png',fullPage:true})
})
test('una caída de red conserva la decisión y permite reenviarla una sola vez',async({browser})=>{
 const tc=await browser.newContext();const sc=await browser.newContext({viewport:{width:390,height:844}});const teacher=await tc.newPage();const student=await sc.newPage()
 await teacher.goto('/docente');await teacher.getByLabel('CLAVE DOCENTE DEL SERVIDOR LOCAL').fill('docente');await teacher.getByRole('button',{name:'INGRESAR AL PANEL'}).click();await teacher.getByRole('button',{name:'CREAR SALA',exact:true}).click();const code=(await teacher.locator('.room-big-code').innerText()).trim();await join(student,code,'Conexión móvil');await teacher.getByRole('button',{name:'INICIAR JORNADA'}).click();await student.getByRole('button',{name:'COMENZAR MISIÓN'}).click()
 await student.route('**/api/rpc/submit_answer',r=>r.abort('internetdisconnected'))
 await student.getByTestId('option-vines').click();await student.getByTestId('confirm-answer').click();await expect(student.getByRole('button',{name:'REINTENTAR ENVÍO'})).toBeVisible();await sc.setOffline(true);await expect(student.getByText('Perdiste la conexión.',{exact:false})).toBeVisible()
 await sc.setOffline(false);await student.unroute('**/api/rpc/submit_answer');await student.getByRole('button',{name:'REINTENTAR ENVÍO'}).click();await expect(student.getByText('¡Buena decisión!')).toBeVisible();await student.getByRole('button',{name:'SEGUIR LA JORNADA'}).click();await student.reload();await expect(student.getByText('Espacio bajo el chasis',{exact:true})).toBeVisible();await expect(student.locator('.hud-score')).toContainText('100');await expect(teacher.locator('.partial-score')).toContainText('100')
 await tc.close();await sc.close()
})
