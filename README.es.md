# claude-sesiones — todas tus conversaciones de Claude Code en una terminal

[English](README.md) · **Español**

Un navegador de terminal para tus conversaciones de Claude Code de **todas las carpetas
y todas las cuentas**, como la barra lateral de claude.ai pero en la CLI. Eliges una y
se abre en su carpeta y con su cuenta, sin tener que acordarte de dónde estabas.

```
 ✻ cses                                                                                cuenta ▸ trabajo · tu@empresa.com ·auto
  ⌕ ▏escribe para buscar conversaciones
╭────────────────────────────╮╭────────────────────────────────────────────────╮╭────────────────────────────────────────────╮
│ Carpetas                   ││ Todas · 41                                     ││ Vista previa                               │
│ ▌ Todas                 41 ││ Hoy                                            ││ Migración de la base de datos              │
│  ★ Favoritas               ││ ▌● Migración de la base de…  api-pagos   12:31 ││ proyectos/api-pagos  ⎇ main                │
│    api-pagos             8 ││    Nueva portada de la web   web-tienda  11:22 ││ 20 oct 20:15 → hoy 12:31 · 36 mensajes     │
│  Carpetas                  ││ Ayer                                           ││ ● Abierta ahora en otra terminal           │
│  ▾ proyectos            33 ││    Fallo de login en Andro…  app-movil    ayer ││ cuenta ▸ trabajo · tu@empresa.com          │
│    ▸ api-pagos           8 ││    Informe trimestral        clientes     ayer ││ ────────────────────────────────────────── │
│    ▸ web-tienda         12 ││ Últimos 7 días                                 ││ ❯ Tú  hoy 12:20                            │
│      app-movil           5 ││    Caché de imágenes         web-tienda    lun ││   ¿y si la hacemos por lotes?              │
│  ▸ clientes              8 ││    Tests de integración      api-pagos     dom ││ ✻ Claude  hoy 12:21                        │
╰────────────────────────────╯╰────────────────────────────────────────────────╯╰────────────────────────────────────────────╯
 ↵ abrir  ^T pestaña  ^N nueva  ^F copia  ^E favorita  ^G su carpeta  ^A cuenta  esc atrás
```

## Por qué

`claude --resume` va atado a la carpeta en la que empezaste la conversación. Con muchos
proyectos (y más de una cuenta), encontrar la de ayer obliga a adivinar antes la
carpeta. `cses` lee el historial que Claude Code ya guarda en el disco y te deja
recorrerlo entero.

## Qué hace

- **Tres columnas**: carpetas | conversaciones | vista previa. `←` `→` pasan de una a otra.
- **Árbol de carpetas** con el número de conversaciones. Se puede desplegar cualquier
  carpeta del disco, no solo las que tienen historial, y empezar ahí una conversación.
- **Escribir para buscar** en la columna activa, sin importar mayúsculas ni tildes.
- **Favoritas** (`Ctrl+E`), conversaciones y carpetas, siempre arriba.
- **Ratón**: clic para elegir, doble clic para abrir o desplegar, rueda para desplazar.
- **Volver con `esc`** a donde estabas antes del último salto.
- **Varias cuentas** (directorios `~/.claude-*`): se cambia con `Ctrl+A` o con reglas
  por carpeta. Con `Ctrl+T` se abre en una pestaña nueva de Windows Terminal o de tmux,
  y puedes tener varias cuentas trabajando a la vez.
- **Sabe qué está abierto**: `●` marca las conversaciones abiertas en otra terminal, y
  `cses` pregunta antes de abrir una dos veces (o abre una copia).
- **Rápido**: el índice incremental solo lee lo que ha cambiado (2,5 GB de historial en
  unos 3 s la primera vez y unos 35 ms después).
- **En castellano y en inglés**, según el idioma del sistema.

## Instalar

Hace falta Node.js 22 o posterior y Claude Code.

```bash
npm install -g claude-sesiones      # o: pnpm add -g / yarn global add / bun add -g
cses                                # o el nombre largo: claude-sesiones
```

Desde el código:

```bash
git clone https://github.com/VolmerES/claude-sesiones.git
cd claude-sesiones
npm install && npm run build && npm link
```

### Quedarte en la carpeta de la conversación al salir

Un programa no puede cambiar la carpeta de la shell que lo lanzó, así que hay que
envolver `cses` en una función. Bash o zsh (Git Bash incluido):

```bash
cses() {
  local f rc d
  f="$(mktemp)"
  CSES_CD="$(command -v cygpath >/dev/null && cygpath -w "$f" || echo "$f")" command cses "$@"
  rc=$?
  d="$(cat "$f" 2>/dev/null)"; rm -f "$f"
  [ -n "$d" ] && command -v cygpath >/dev/null && d="$(cygpath -u "$d")"
  [ -n "$d" ] && [ -d "$d" ] && cd "$d"
  return $rc
}
```

PowerShell:

```powershell
function cses {
  $f = New-TemporaryFile
  $env:CSES_CD = $f.FullName
  try { & (Get-Command cses -CommandType Application | Select-Object -First 1) @args }
  finally {
    Remove-Item Env:CSES_CD
    $d = Get-Content $f -ErrorAction SilentlyContinue
    Remove-Item $f
    if ($d -and (Test-Path $d)) { Set-Location $d }
  }
}
```

## Uso

```
cses                       el navegador
cses .                     empieza en la carpeta actual
cses carpetas              empieza en la columna de carpetas
cses lista [N]             las N últimas, sin interfaz
cses cuentas               cuentas detectadas y si comparten historial
cses cuenta-nueva NOMBRE   crea ~/.claude-NOMBRE compartiendo historial y ajustes
cses login NOMBRE          abre claude con esa cuenta para iniciar sesión
```

Lo que no sea de `cses` se le pasa a `claude`: `cses --model opus`, o `cses -- …` para
pasarlo todo tal cual. También valen los nombres en inglés (`list`, `accounts`,
`new-account`, `folders`).

| Tecla | Carpetas | Conversaciones | Vista previa |
|---|---|---|---|
| escribir | buscar carpetas | buscar conversaciones | |
| `↑` `↓` `RePág` `AvPág` | moverse | moverse | desplazar |
| `→` | desplegar / columna siguiente | vista previa | |
| `←` | plegar / carpeta de arriba | carpetas | conversaciones |
| `↵` | ver sus conversaciones | abrir aquí | abrir aquí |
| `Ctrl+T` | nueva conversación en pestaña | abrir en pestaña nueva | |
| `Ctrl+N` | nueva conversación aquí | nueva conversación en su carpeta | |
| `Ctrl+F` | | abrir una copia (`--fork-session`) | |
| `Ctrl+E` | carpeta favorita | conversación favorita | |
| `Ctrl+G` | | ir a su carpeta | |
| `Ctrl+A` | cambiar de cuenta (y vuelta a la automática) | | |
| `Ctrl+Y` | | copiar el id | |
| `Ctrl+R` | releer | releer | releer |
| `esc` | borrar la búsqueda · atrás · salir | | |
| `Tab` | columna siguiente | | |

Con el ratón activado, para seleccionar texto de la terminal se usa `Mayús`+arrastrar.
Se desactiva con `"raton": false` en la configuración.

## Varias cuentas

Claude Code guarda cada cuenta en su propio directorio de configuración
(`CLAUDE_CONFIG_DIR`). `cses` detecta `~/.claude` (la «principal») y cada
`~/.claude-NOMBRE`, y lanza `claude` con la variable puesta: así pueden ir a la vez
conversaciones de cuentas distintas, cada una en su pestaña.

`cses cuenta-nueva NOMBRE` crea el directorio enlazando a la principal `projects/`,
`skills/`, `plugins/`… y los ajustes: el historial es común, cualquier conversación se
puede retomar con cualquier cuenta, y solo las credenciales van aparte. Si una cuenta no
comparte `projects/`, `cses` abre sus conversaciones con ella y lo avisa.

### Panel de cuentas: cambiar de cuenta sin salir del chat

Si tienes más de una cuenta y `cses` va en Windows Terminal o en tmux, al abrir una
conversación la pestaña se divide: `claude` a la izquierda y una columna estrecha de
cuentas a la derecha.

```
╭─ claude ───────────────────────────────────────╮╭─ Cuentas ─────────────────╮
│ ✻ You've hit your session limit · resets 6pm   ││ ⚠ Límite alcanzado        │
│                                                ││ ● trabajo                 │
│ >                                              ││   tu@empresa.com          │
│                                                ││   ⚠ límite · vuelve 18:00 │
│                                                ││                           │
│                                                ││ ○ personal                │
│                                                ││   tu@gmail.com            │
│                                                ││                           │
│                                                ││ + Añadir cuenta           │
╰────────────────────────────────────────────────╯╰───────────────────────────╯
```

- **Clic en otra cuenta** y la misma conversación se reabre con ella, en el mismo sitio,
  en un par de segundos. Sin `/login`: cada cuenta guarda su sesión. Claude Code no
  puede cambiar de cuenta con una sesión abierta, así que `cses` lo reinicia con
  `--resume`; la conversación está entera y solo se pierde lo que no hubieras enviado.
  Si Claude está a mitad de una respuesta, el panel pregunta antes.
- **Límites de uso**: cuando Claude avisa de que se ha llegado al límite, el panel marca
  esa cuenta con ⚠ y cuándo vuelve, para saber a cuál cambiar.
- **+ Añadir cuenta** crea `~/.claude-NOMBRE` y abre una pestaña para iniciar sesión, una
  sola vez.

Se quita con `"panelCuentas": false`, o se pone con una sola cuenta con `true`.

## Configuración

`~/.cses/config.json` (opcional; también vale con las claves en inglés):

```json
{
  "raices": ["~/proyectos", "~/clientes"],
  "cuentaPorDefecto": "principal",
  "reglas": [{ "carpeta": "~/clientes", "cuenta": "trabajo" }],
  "terminal": "wt",
  "idioma": "es",
  "raton": true
}
```

- **`raices`**: salen arriba del árbol aunque no tengan conversaciones.
- **`reglas`**: qué cuenta se propone para una carpeta (gana la más concreta).
- **`cuentas`**: `[{ "nombre", "dir" }]` si no quieres la detección automática.
- **`terminal`**: `wt` (Windows Terminal, por defecto en Windows), `ventana` o `tmux`.
- **`idioma`**: `es` o `en`. Si no, `CSES_LANG`, luego `LANG` y luego el del sistema.
- **`panelCuentas`**: el panel de cuentas al lado de `claude` (sí por defecto con dos o
  más cuentas).
- `CSES_CLAUDE` (variable de entorno): ruta del ejecutable de `claude`, si no es el del
  `PATH`.

## Cómo funciona y privacidad

`cses` solo lee ficheros de tu equipo: las conversaciones que Claude Code escribe en
`<directorio de configuración>/projects/` y los ficheros de `sessions/` que dicen cuáles
están abiertas. Guarda un índice en `~/.cses/indice.json` (se puede borrar: se rehace),
tus favoritas en `~/.cses/favoritos.json`, los límites de uso que ha visto en
`~/.cses/limites.json` y, mientras hay una conversación abierta, un fichero pequeño en
`~/.cses/paneles/` para el panel de cuentas. No envía nada a ningún sitio.

## Estado

Hecho en Windows 11 con Windows Terminal y Git Bash. Debería funcionar en macOS y
Linux (allí las pestañas nuevas necesitan tmux), pero aún no se ha probado: los avisos
y las PR son muy bienvenidos.

## Contribuir

Issues y pull requests bienvenidas, en castellano o en inglés. Mira
[CONTRIBUTING.md](CONTRIBUTING.md).

## Créditos

Es un fork de [ccresume](https://github.com/sasazame/ccresume), de sasazame (MIT):
conserva su base de Ink/React y el cálculo de anchos de carácter, y rehace el resto.

Sin relación con Anthropic. «Claude» es una marca de Anthropic.

## Licencia

[MIT](LICENSE)
