export function isLocalTeacherRequest(req, port, production) {
 const peer=req.socket.remoteAddress
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer))return false
 // El proxy de Cloudflare llega por loopback, pero añade estos encabezados.
 // No se permite usar Host u Origin falsificados para acceder desde el túnel.
 const forwarded=['cf-ray','cf-connecting-ip','x-forwarded-for','x-forwarded-host','x-forwarded-proto','forwarded','x-real-ip']
 if(forwarded.some(key=>req.headers[key]!==undefined))return false
 const ports=production?[port]:[port,5173]
 const hosts=ports.flatMap(p=>[`localhost:${p}`,`127.0.0.1:${p}`,`[::1]:${p}`])
 if(!hosts.includes(req.headers.host))return false
 return !req.headers.origin||hosts.some(host=>req.headers.origin===`http://${host}`)
}
