# Validación realizada

Se probaron las reglas reales de PostgreSQL y la aplicación compilada para el servidor local. La modalidad elegida por el usuario es un servidor local detrás de un túnel HTTPS; no se desplegó en Vercel ni se configuró un proyecto Supabase externo.

## Base de datos y reglas

Comando: `npm test`.

**19 pruebas aprobadas.** Las pruebas ejecutan `supabase/migrations/001_game.sql` sobre PGlite, una implementación de PostgreSQL, y llaman las mismas funciones RPC que la aplicación. Las llamadas se ejecutan con el rol `authenticated` y un `auth.uid()` distinto por participante.

- 1000 puntos exactos, cinco misiones de 200 y distribución 67 + 67 + 66.
- Recorrido con todos los aciertos y recorrido con todos los errores.
- Cero puntos en respuestas incorrectas, explicación posterior y avance permitido.
- Prohibición de adelantar desafíos y de enviar opciones inexistentes.
- Reenvíos idénticos, modificación posterior de una respuesta y solicitudes concurrentes sin duplicar puntos.
- Dos sesiones con ritmos diferentes y aislamiento entre salas.
- Empates con la misma posición y exclusión de resultados parciales del ranking competitivo.
- Identidad, apodo, progreso y última explicación conservados al reingresar.
- Progreso conservado tras cerrar y reabrir una base real en disco.
- Creación y control de salas limitados al docente autorizado.
- Rechazo de lectura directa de soluciones, modificación de puntos y escalada de permisos.
- Política RLS de señales: un usuario ajeno no recibe filas de otra sala.
- Cierre que conserva resultados y bloquea respuestas nuevas; imposibilidad de reabrir una sala cerrada.
- Todas las fronteras de las cuatro clasificaciones individuales.

## Navegador y versión compilada

Comando para la modalidad de túnel:

```powershell
npm run build:local
$env:E2E_PRODUCTION='1'
npm run test:e2e
```

**Tres recorridos automatizados con Chrome y perfiles independientes:**

1. Un docente crea la sala; dos estudiantes se unen. Inicio, cinco misiones y 12 desafíos, conexión por toques, respuestas correctas e incorrectas, 1000 y 900 puntos, avance independiente, recarga de sesión, ranking sincronizado, cierre y podio.
2. Portada en 360, 390 y 430 píxeles, con comprobación de ausencia de desplazamiento horizontal y entradas de 16 píxeles para evitar zoom automático en iPhone. Captura adicional de escritorio a 1440 píxeles.
3. Interrupción de red durante el envío, conservación local de la decisión, aviso de desconexión, reconexión, reenvío único, recarga y verificación de 100 puntos tanto en estudiante como en panel docente.

Se comprueba el ancho de página durante los desafíos. Se generaron capturas de portada, tablero, asociaciones, resultado y panel docente en `artifacts/qa/` para inspección visual. Los navegadores de prueba se cierran al terminar y no equivalen a dispositivos físicos.

## Compilación

`npm run build` y `npm run build:local` completaron TypeScript y Vite. La entrega deja `dist/` preparado con la variante local. React/Motion se separan en archivos cacheables; la variante local elimina el cliente Supabase del código utilizado. Ilustraciones SVG y fuentes locales: no se consultan CDNs, imágenes externas ni APIs de contenidos al jugar.

## Límites de la comprobación

- Se abrió un Quick Tunnel real de Cloudflare: portada, sesión y RPC respondieron HTTP 200. Se probó un docente en localhost y un estudiante por HTTPS público: ingreso, inicio sincronizado, respuesta correcta con 100 puntos, actualización del panel y cierre. Se verificó que no hubiera solicitudes SSE por el Quick Tunnel; la sincronización usa consultas cada 2,5 segundos. No se automatizó el inicio de sesión docente por Internet.
- No se probaron celulares Android o iPhone físicos ni Safari/WebKit. La interfaz se verificó en Chrome con viewport y controles táctiles emulados.
- No se validó carga con 200 participantes simultáneos. El límite de sala es una restricción del servidor, no una certificación de capacidad de la computadora o la conexión.
- La duración de 5–8 minutos es estimada; falta medirla con estudiantes.
- La integración remota de Supabase Auth/Realtime y un despliegue en Vercel están preparados y documentados, pero no se validaron contra servicios externos.
- Las pruebas de navegador crean salas y participantes de prueba en `.data/postgres`. No conocen ni modifican una cuenta real del usuario.
