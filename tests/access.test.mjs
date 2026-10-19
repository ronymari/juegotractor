import test from 'node:test'
import assert from 'node:assert/strict'
import {isLocalTeacherRequest} from '../server/access.mjs'
const request=(headers={},peer='127.0.0.1')=>({headers:{host:'localhost:3001',origin:'http://localhost:3001',...headers},socket:{remoteAddress:peer}})
test('permite el panel directamente en localhost',()=>assert.equal(isLocalTeacherRequest(request(),3001,true),true))
test('bloquea el panel por el dominio público',()=>assert.equal(isLocalTeacherRequest(request({host:'example.trycloudflare.com',origin:'https://example.trycloudflare.com'}),3001,true),false))
test('bloquea encabezados de proxy aunque Host y Origin parezcan locales',()=>{
 for(const header of ['cf-ray','cf-connecting-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto','forwarded','x-real-ip'])assert.equal(isLocalTeacherRequest(request({[header]:'proxy'}),3001,true),false)
})
test('bloquea redes ajenas, otro origen y DNS rebinding',()=>{
 assert.equal(isLocalTeacherRequest(request({},'192.168.1.5'),3001,true),false)
 assert.equal(isLocalTeacherRequest(request({origin:'https://example.com'}),3001,true),false)
 assert.equal(isLocalTeacherRequest(request({host:'example.com:3001'}),3001,true),false)
})
