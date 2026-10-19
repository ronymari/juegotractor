import {defineConfig} from '@playwright/test'
const production=process.env.E2E_PRODUCTION==='1'
const url=production?'http://127.0.0.1:3001':'http://127.0.0.1:5173'
export default defineConfig({testDir:'./tests/browser',timeout:90000,workers:1,fullyParallel:false,use:{baseURL:url,trace:'retain-on-failure',screenshot:'only-on-failure'},webServer:{command:production?'npm start':'npm run dev',url,reuseExistingServer:!process.env.CI,timeout:120000},projects:[{name:'chromium-mobile',use:{browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]})
