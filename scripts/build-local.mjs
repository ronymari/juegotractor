import {spawnSync} from 'node:child_process'
const env={...process.env,VITE_BACKEND:'local'}
for(const [file,args] of [['node_modules/typescript/bin/tsc',['-b']],['node_modules/vite/bin/vite.js',['build']]]){
 const r=spawnSync(process.execPath,[file,...args],{stdio:'inherit',env})
 if(r.status!==0) process.exit(r.status||1)
}
console.log('\nListo para túnel HTTPS: npm start (puerto 3001). Panel docente: http://localhost:3001/docente. PUBLIC_ORIGIN configura el destino público del QR.')
