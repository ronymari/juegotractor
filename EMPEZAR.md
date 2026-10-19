# Para jugar con un túnel

En esta carpeta, ejecutá:

```powershell
npm run build:local
npm start
```

Las dependencias ya están instaladas. Si movés el proyecto a otra computadora, ejecutá primero `npm ci` con Node.js 24.

1. La **clave docente** es siempre **`docente`**.
2. En otra terminal ejecutá `npm run tunnel`: abre Cloudflare hacia **http://127.0.0.1:3001** y muestra una URL HTTPS.
3. Abrí **http://localhost:3001/docente** en esta computadora.
4. Ingresá la clave y creá una sala.
5. Compartí el QR o el enlace que genera el panel.
6. Cuando estén los estudiantes, tocá **Iniciar jornada**.

Cada estudiante avanza a su ritmo. El docente observa el progreso y al final puede proyectar el ranking.

El panel docente funciona solo en localhost. La dirección pública del túnel se configura como `PUBLIC_ORIGIN` en `.env`; así el panel local genera el QR público. Si cambia el túnel, actualizá esa variable, reiniciá el servidor y recargá el panel. Mantené el servidor y el túnel abiertos durante toda la clase. Conservá `.data`: contiene las partidas y las sesiones.

Los comandos de ejemplo para Cloudflare y ngrok, la configuración de seguridad, la recuperación de sesión y la alternativa Supabase/Vercel están en [README.md](README.md).
