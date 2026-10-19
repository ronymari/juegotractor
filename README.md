# MISIÓN TRACTOR · El desafío de la potencia

Videojuego educativo mobile-first en español de Argentina. Cinco misiones, 12 desafíos visuales y táctiles, salas compartidas y avance individual. Máximo 1000 puntos, sin premio por velocidad. El servidor calcula los puntos y habilita únicamente el desafío siguiente. El panel docente inicia y cierra salas; el ranking competitivo incluye solo jornadas completas y comparte posiciones en los empates.

## Usarlo desde tu computadora con un túnel HTTPS

Esta es la modalidad elegida para la microclase. **No requiere Supabase, Vercel, correos ni cuentas de estudiantes.** Todos los celulares usan el mismo servidor de tu computadora, con PostgreSQL embebido (PGlite) persistido en `.data/postgres`. Las mismas funciones SQL se pueden trasladar después a Supabase.

Requisitos: Node.js 24 LTS, npm, Chrome para las pruebas de navegador y el servicio de túnel HTTPS de tu preferencia. Abrí PowerShell en esta carpeta.

### 1. Instalar y compilar

```powershell
npm ci
npm run build:local
```

### 2. Preparar el acceso docente

La clave del panel docente local es siempre **`docente`**, según la configuración solicitada. Se conserva al reiniciar y es independiente del código público de cada sala. No hace falta crear un archivo `.env` para usar el servidor local.

### 3. Iniciar el servidor

```powershell
npm start
```

El servidor escucha en `http://127.0.0.1:3001`. Debe permanecer abierto durante la clase. La compilación local ya incluye el backend correcto; no hace falta ejecutar Vite ni una segunda terminal para el frontend.

### 4. Abrir tu túnel

Apuntá tu túnel a **http://127.0.0.1:3001**. Usá la URL HTTPS que te asigne. Ejemplos si ya tenés estas herramientas instaladas:

```powershell
cloudflared tunnel --url http://127.0.0.1:3001
```

o:

```powershell
ngrok http 3001
```

El cliente oficial de Cloudflare está disponible en `.tools/cloudflared.exe` en esta computadora. Para volver a abrir un túnel, ejecutá `npm run tunnel` en otra terminal mientras el servidor sigue activo. Cada arranque genera una URL nueva. Si copiás el proyecto a otra computadora, descargá primero el cliente desde la [página oficial](https://developers.cloudflare.com/tunnel/downloads/). El ejecutable no se incluye en Git.

En dominios `trycloudflare.com`, el juego usa consultas breves cada 2,5 segundos para sincronizar el inicio y el ranking: los Quick Tunnels [no transportan SSE](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/). En localhost y túneles con soporte SSE se mantienen los eventos. Si tu proveedor muestra una pantalla de aviso, tené en cuenta ese paso al dar acceso a la clase. Si cambia la dirección del túnel, compartí el enlace y el QR actualizados.

Una vez conocida la dirección del túnel, fijá `PUBLIC_ORIGIN=https://TU-DIRECCION-REAL` en `.env`, reiniciá el servidor y recargá el panel local. El servidor verifica el origen de las escrituras. Las cookies de sesión usan HttpOnly, SameSite y Secure en esta modalidad HTTPS.

### 5. Crear la sala y obtener QR

Abrí **http://localhost:3001/docente** en la computadora anfitriona, ingresá `docente` y creá una sala. El panel y su API administrativa están bloqueados desde Internet. Configurá `PUBLIC_ORIGIN` en `.env` con la dirección HTTPS actual del túnel: el QR y el enlace del panel usan esa dirección pública. El campo de enlace permite copiarlo o seleccionarlo manualmente. El código de seis caracteres se genera en el servidor.

### 6. Ingreso de estudiantes

Los estudiantes escanean el QR o abren el enlace `/?sala=CODIGO`. El código se completa automáticamente. Escriben un nombre o apodo de 2–24 caracteres y entran a la espera. No ingresan correo ni contraseña. Para ingresar manualmente, abren la portada y escriben el código.

### 7. Administrar la jornada

Tocá **Iniciar jornada**. Cada estudiante avanza por su cuenta, con explicaciones después de cada decisión. El docente ve puntos parciales, misiones y desafíos completados. La indicación de actividad se basa en una consulta cada 12 segundos; se considera reciente durante 45 segundos. Los cambios también llegan por eventos en tiempo real (SSE en el servidor local).

**Finalizar sala** pide confirmar cuántas personas siguen sin terminar. El cierre bloquea respuestas nuevas y conserva los resultados. El ranking y el podio incluyen solo a quienes completaron las cinco misiones. **Proyectar** amplía los resultados. **Crear otra sala** mantiene la anterior y permite iniciar una nueva.

### 8. Desconexión y persistencia

Las cookies identifican cada sesión y duran 30 días. El progreso confirmado queda en PostgreSQL. Al recargar o reconectar desde el mismo navegador, se recuperan identidad, pregunta, puntaje y última explicación. Una decisión enviada sin confirmación se conserva localmente para reenviarla con el mismo identificador; no puede sumar dos veces.

Si un estudiante borra cookies o cambia de navegador/dispositivo, no se puede demostrar que es la misma persona sin pedirle una credencial adicional; ingresará como otro participante. Un cambio de dominio de túnel también cambia el ámbito de cookies, por eso conviene mantener la misma URL durante toda la clase. Los teléfonos necesitan conectividad para confirmar cada respuesta.

No borres `.data`. Para respaldar las partidas, detené el servidor y copiá ese directorio completo. No abras dos servidores sobre la misma base: hay un bloqueo con PID que impide hacerlo. Detené el servidor con Ctrl+C al terminar. La computadora debe mantenerse encendida, sin suspensión y con conexión durante toda la clase.

## Desarrollo y pruebas

```powershell
npm run dev
npm test
npm run test:e2e
npm run build:local
```

`npm run dev` inicia Vite en 5173 y el servidor en 3001; no lo ejecutes al mismo tiempo que `npm start`. Para E2E, cerrá servidores anteriores: Playwright inicia los suyos y usa la clave docente configurada: `docente`. Las pruebas usan perfiles independientes, un docente y dos estudiantes. Chrome es el navegador predeterminado. Con Chromium descargado mediante `npx playwright install chromium`, se puede usar `$env:PLAYWRIGHT_CHANNEL='chromium'`.

`npm test` ejecuta las funciones SQL reales en PostgreSQL embebido en memoria: puntuación, errores, progreso, empates, reintentos, permisos, aislamiento de salas y recuperación. No necesita credenciales. La evidencia y los límites de la validación están en `docs/PRUEBAS.md`.

## Alternativa: Supabase y Vercel

Esta modalidad permite apagar tu computadora durante el acceso público, pero necesita servicios externos. No está activada en la configuración local elegida.

### 1. Proyecto y autenticación Supabase

Creá un proyecto. En **Authentication → Sign In / Providers**, habilitá los accesos anónimos. Los estudiantes usan `signInAnonymously()` y conservan su sesión en el navegador. Mantené habilitado el proveedor Email para las cuentas docentes. La habilitación docente depende además de una lista de usuarios autorizados en la base.

### 2. Tablas, funciones y políticas

Abrí el SQL Editor y ejecutá **todo** `supabase/migrations/001_game.sql` una vez en un proyecto nuevo. Crea tablas privadas, desafíos, funciones RPC, permisos y RLS, y agrega `room_events` a la publicación de Realtime. El esquema `game_private` **no debe agregarse** a los esquemas expuestos de la Data API.

No abras las tablas a escritura del cliente ni agregues políticas permisivas. Las funciones tienen `search_path` vacío y validan `auth.uid()`, propiedad de sala, membresía, estado y avance. La única tabla legible por clientes es `public.room_events`, y su política restringe las señales a miembros de la sala. No contiene respuestas ni datos de autenticación. Las tablas privadas tienen RLS sin políticas de acceso directo y permisos revocados.

### 3. Cuenta docente

Desde Authentication → Users, creá la cuenta docente con correo confirmado y una contraseña elegida fuera del repositorio. Copiá su UUID real y ejecutá como administrador:

```sql
insert into game_private.teachers(user_id)
values ('REEMPLAZAR-POR-UUID-REAL-DEL-DOCENTE');
```

El UUID se relaciona con `auth.users`. Tener una cuenta o conseguir una clave pública del proyecto no convierte a alguien en docente. Para revocar la posibilidad de crear salas, borrá su registro de `game_private.teachers`; los controles sobre salas existentes corresponden a su propietario.

### 4. Variables de entorno

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REEMPLAZAR
```

Se acepta `VITE_SUPABASE_ANON_KEY` para proyectos con clave pública anterior. **Nunca pongas service_role, una clave secreta ni una contraseña de base en variables VITE.** Las variables VITE se incluyen públicamente en el JavaScript. La seguridad depende de los permisos y las funciones del servidor. No configures `VITE_BACKEND=local` para Vercel.

### 5. Probar y compilar para Supabase

```powershell
npm run dev:web
npm run build
```

Con estas variables, el navegador usa Supabase. Sin configuración, la compilación de producción muestra una indicación de configuración y evita simular partidas. `npm run build:local` es exclusivamente para Node y el túnel.

### 6. Publicar en Vercel

Subí el código a tu repositorio y elegí **Add New → Project** en Vercel. Seleccioná Vite, comando `npm run build`, salida `dist`, e ingresá las dos variables públicas anteriores. `vercel.json` ya configura las rutas SPA y los encabezados. Publicá con **Deploy** y usá **la URL que realmente devuelva Vercel**. No se presupone ningún dominio disponible.

Como alternativa, con Vercel CLI autenticada: `vercel` y luego `vercel --prod`, configurando antes las variables en el proyecto. En Netlify se usa la misma compilación y el `netlify.toml` incluido.

### 7. URL pública y prueba final

Agregá la URL real al Site URL y a la configuración de URLs permitidas de Supabase Auth. Abrí `/docente`, ingresá con la cuenta autorizada, creá una sala y probá el QR en otro navegador. Iniciá y terminá una partida. Comprobá que Realtime notifica cambios; si se desconecta, el cliente sigue consultando cada 12 segundos. El panel y el flujo de administración son los mismos que en el servidor local.

Las guías oficiales usadas para comprobar la configuración son [funciones PostgreSQL](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [accesos anónimos](https://supabase.com/docs/guides/auth/auth-anonymous), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) y [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite).

## Organización

| Ruta | Función |
|---|---|
| `src/` | React, interfaces, SVG y cliente local/Supabase |
| `server/local.mjs` | HTTP, sesiones docentes, eventos y persistencia local |
| `server/database.mjs` | PostgreSQL y ejecución RPC con rol restringido |
| `supabase/migrations/001_game.sql` | Única fuente de verdad para reglas y respuestas |
| `tests/game.test.mjs` | Pruebas sobre PostgreSQL y permisos |
| `tests/browser/` | Pruebas de recorrido y sesiones de navegador |
| `docs/CONTENIDOS.md` | Mapeo de preguntas a Word y PowerPoint |
| `docs/PRUEBAS.md` | Comprobaciones realizadas y límites |

El frontend no incluye la clave de respuestas. La solución y la explicación de cada desafío se entregan solamente después de enviar una respuesta válida. Los apodos se renderizan como texto de React. El sistema no verifica identidad académica: los estudiantes pueden elegir apodos y una sesión nueva puede generar otro participante. Se limita cada sala a 200 participantes; no se ha validado carga con 200 teléfonos reales.
