export type Lang = 'es' | 'en';

const es = {
  tagline: 'conversaciones de Claude Code',
  indexing: 'Indexando {n}/{total} conversaciones · {mb} MB',
  reading: 'Leyendo conversaciones…',
  error: 'Error: {msg}',

  colFolders: 'Carpetas',
  colConvs: 'Conversaciones',
  colPreview: 'Vista previa',
  all: 'Todas',
  favorites: '★ Favoritas',
  foldersGroup: 'Carpetas',
  homeFolder: '~ (carpeta personal)',
  inFolder: 'En {path}',
  countOf: '{n} de {total}',
  noMatches: 'Nada coincide',
  nothingSelected: 'Nada seleccionado',
  searchFolders: 'escribe para buscar carpetas',
  searchConvs: 'escribe para buscar conversaciones',

  account: 'cuenta ▸ ',
  accountChosen: 'elegida con ^A',
  accountByFolder: 'por carpeta',
  accountDefault: 'por defecto',
  accountNoSession: 'sin sesión iniciada',
  warnNotShared: '«{a}» no ve esta conversación: se abre con «{b}»',
  warnNoLogin: '«{a}» no tiene sesión iniciada: claude pedirá /login',

  statusAccount: 'Cuenta: {label}',
  statusAccountAuto: 'Cuenta automática: la de la carpeta o la de por defecto',
  statusRefreshing: 'Actualizando…',
  statusRefreshed: '✓ Actualizado',
  statusCopied: '✓ Copiado: {id}',
  statusCopyFailed: 'No se pudo copiar al portapapeles',
  statusFolderMissing: 'La carpeta ya no existe: {path}',
  statusPickFolder: 'Elige una carpeta para empezar una conversación',
  statusFavAdded: '★ Añadida a favoritas',
  statusFavRemoved: 'Quitada de favoritas',
  statusTabOpened: '✓ Abierta en una pestaña nueva: {title} · {account}',
  statusWindowOpened: '✓ Abierta en una ventana nueva: {title} · {account}',
  statusTmuxOpened: '✓ Abierta en una ventana de tmux: {title} · {account}',
  statusNoTabs: 'Sin terminal para abrir pestañas: usa ↵ para abrirla aquí',
  statusOpenFailed: 'No se pudo abrir: {msg}',
  confirmOpen: 'Ya está abierta en otra terminal ({account}). ',
  newTitle: 'nueva · {name}',
  forkTitle: 'copia · {title}',

  kOpen: 'abrir',
  kTab: 'pestaña',
  kNew: 'nueva',
  kFork: 'copia',
  kFav: 'favorita',
  kGoFolder: 'su carpeta',
  kAccount: 'cuenta',
  kBack: 'atrás',
  kQuit: 'salir',
  kExpand: 'desplegar',
  kColumn: 'columna',
  kScroll: 'desplazar',
  kForkOpen: 'abrir una copia',
  kOpenAnyway: 'abrir igualmente',
  kCancel: 'cancelar',
  kSearchClear: 'borrar búsqueda',

  messages: '{n} mensajes',
  message: '1 mensaje',
  openNow: '● Abierta ahora en otra terminal · {account}',
  busy: 'trabajando',
  idle: 'esperando',
  startedWith: 'Empezó con',
  you: 'Tú',
  moreAbove: '↑ {n} líneas más arriba',
  folderMissing: '✗ La carpeta ya no existe',
  conversations: '{n} conversaciones',
  conversation: '1 conversación',
  lastActivity: 'última {date}',
  noConvsYet: 'Sin conversaciones todavía',
  subfolders: 'Subcarpetas',
  allSummary: '{convs} en {folders} carpetas',
  untitled: '(sin título)',

  today: 'hoy',
  yesterday: 'ayer',
  groupToday: 'Hoy',
  groupYesterday: 'Ayer',
  group7: 'Últimos 7 días',
  group30: 'Últimos 30 días',
  days: 'dom,lun,mar,mié,jue,vie,sáb',
  months: 'ene,feb,mar,abr,may,jun,jul,ago,sep,oct,nov,dic',
  locale: 'es-ES',

  cliNeedsTty: 'cses necesita una terminal interactiva (prueba «cses lista»)',
  cliResuming: 'Retomando',
  cliForking: 'Copia de',
  cliNewIn: 'Nueva conversación en',
  cliAccount: 'cuenta',
  cliNoAccount: 'No hay ninguna cuenta «{name}». Mira: cses cuentas',
  cliLogin: 'Iniciando sesión en «{name}» ({dir}). Se abre el navegador; si entra solo en otra cuenta, abre el enlace en una ventana de incógnito.',
  cliNewAccountUsage: 'Uso: cses cuenta-nueva NOMBRE',
  cliNewAccountNext: 'Ahora: cses login {name}',
  cliShared: 'historial compartido con {names}',
  cliLaunchFailed: 'cses: no se pudo lanzar claude: {msg}',
  cliSwitching: 'Siguiendo con la cuenta {name}…',

  setupTitle: 'Configuración',
  setupWelcome: 'Es la primera vez que abres cses. Deja aquí listas tus cuentas de Claude y tus preferencias. Vuelves cuando quieras con ^K o con «cses config».',
  setupAccounts: 'Cuentas de Claude',
  setupAccountsIntro: 'Inicia sesión una vez en cada cuenta. Después cses cambia de una a otra sin volver a hacer /login.',
  setupNoSession: 'sin sesión · ↵ para entrar',
  setupSame: '⚠ misma cuenta que {name}',
  setupChecking: 'comprobando…',
  setupAddAccount: '+ Añadir cuenta',
  setupAccountName: 'Nombre de la cuenta (trabajo, personal…):',
  setupPrefs: 'Preferencias',
  setupDefaultAccount: 'Cuenta por defecto',
  setupLanguage: 'Idioma',
  setupPanel: 'Panel de cuentas junto a claude',
  setupMouse: 'Ratón',
  setupTerminal: 'Pestañas nuevas en',
  setupAuto: 'automático',
  setupYes: 'sí',
  setupNo: 'no',
  setupTermWindow: 'ventana nueva',
  setupRoots: 'Carpetas raíz: salen siempre arriba en el árbol',
  setupAddRoot: '+ Añadir carpeta',
  setupRootPrompt: 'Ruta de la carpeta:',
  setupRules: 'Reglas: con qué cuenta se abre cada carpeta',
  setupAddRule: '+ Añadir regla',
  setupRulePrompt: 'Carpeta de la regla:',
  setupKeys: '↑↓ moverse · ←→ cambiar · ↵ elegir · s cerrar sesión · d quitar · esc guardar y salir',
  setupInputKeys: '↵ aceptar · esc cancelar',
  setupLogoutConfirm: 'Pulsa s otra vez para cerrar la sesión de «{name}»',
  setupNoFolder: 'No existe {path}',
  setupLoggingIn: 'Iniciando sesión en «{name}» ({dir}).',
  setupLoggingInHint: 'Se abre el navegador: entra con la cuenta que quieras usar como «{name}». Si entra solo en otra, abre el enlace en una ventana de incógnito.',
  setupLoggingOut: 'Cerrando la sesión de «{name}»…',
  kConfig: 'ajustes',

  panelTitle: 'Cuentas',
  panelInUse: 'en uso',
  panelBusy: 'respondiendo…',
  panelLimit: '⚠ límite',
  panelResets: 'vuelve {time}',
  panelNoSession: 'sin sesión · clic para entrar',
  panelOwnHistory: 'historial aparte',
  panelAdd: '+ Añadir cuenta',
  panelAddPrompt: 'Nombre de la cuenta nueva:',
  panelAddHint: '↵ crear · esc cancelar',
  panelLoginTab: 'Inicia sesión en la pestaña nueva (se abre el navegador)',
  panelLoginFailed: 'No se pudo abrir otra pestaña. Usa: cses login {name}',
  panelConfirmBusy: 'Claude está respondiendo. Clic otra vez para cortarlo y cambiar',
  panelLimitBanner: '⚠ Límite alcanzado',
  panelLimitHint: 'Clic en otra cuenta para seguir con el mismo chat',
  panelSwitching: 'Cambiando a {name}…',
  panelNotShared: '{name} no comparte el historial: no puede seguir este chat',
  panelWaiting: 'Esperando a claude…',
  panelKeys: '1-9 · clic · n nueva',
  panelUnavailable: 'El panel de cuentas va al lado de claude en Windows Terminal o tmux: abre cses desde ahí (o con ^T) para tenerlo.',

  adminBadName: 'El nombre solo puede llevar letras, números, «-» y «_»',
  adminExists: 'Ya existe {dir}',
  adminCreated: 'Creada {dir}',
  adminSharedDir: '  {name}/ → compartida con la principal',
  adminSharedFile: '  {name} → compartido con la principal',
  adminCopied: '  {name} → copiado (no se pudo enlazar: los cambios no se compartirán)',

  help: `cses — conversaciones de Claude Code, de todas las carpetas y todas las cuentas

Uso:
  cses                       Abre el navegador
  cses .                     Empieza en la carpeta actual
  cses lista [N]             Las N últimas, sin interfaz (20 por defecto)
  cses cuentas               Cuentas detectadas y si comparten historial
  cses cuenta-nueva NOMBRE   Crea ~/.claude-NOMBRE compartiendo historial y ajustes
  cses login NOMBRE          Inicia sesión en esa cuenta (se abre el navegador)
  cses config                Cuentas y preferencias (desde el navegador: ^K)

Lo que no sea de cses (por ejemplo --model opus) se le pasa a claude al abrir.
Con «--» delante se pasa todo tal cual.

Columnas: carpetas | conversaciones | vista previa. ← → cambia de columna.
  escribir   buscar en la columna          esc    borrar la búsqueda / atrás / salir
  ↵          abrir (en carpetas: ver sus conversaciones)
  ^T  abrir en pestaña nueva     ^N  nueva conversación     ^F  abrir una copia (fork)
  ^E  favorita                   ^G  ir a su carpeta        ^A  cambiar de cuenta
  ^Y  copiar el id               ^R  releer                 ^K  cuentas y ajustes
  ^C  salir
  Ratón: clic para elegir, doble clic para abrir, rueda para desplazar.

Configuración: ~/.cses/config.json (ver README)`,
};

export type Messages = typeof es;

const en: Messages = {
  tagline: 'Claude Code conversations',
  indexing: 'Indexing {n}/{total} conversations · {mb} MB',
  reading: 'Reading conversations…',
  error: 'Error: {msg}',

  colFolders: 'Folders',
  colConvs: 'Conversations',
  colPreview: 'Preview',
  all: 'All',
  favorites: '★ Favorites',
  foldersGroup: 'Folders',
  homeFolder: '~ (home folder)',
  inFolder: 'In {path}',
  countOf: '{n} of {total}',
  noMatches: 'No matches',
  nothingSelected: 'Nothing selected',
  searchFolders: 'type to search folders',
  searchConvs: 'type to search conversations',

  account: 'account ▸ ',
  accountChosen: 'picked with ^A',
  accountByFolder: 'by folder',
  accountDefault: 'default',
  accountNoSession: 'not logged in',
  warnNotShared: '"{a}" can\'t see this conversation: opening it with "{b}"',
  warnNoLogin: '"{a}" is not logged in: claude will ask you to /login',

  statusAccount: 'Account: {label}',
  statusAccountAuto: 'Automatic account: the folder\'s or the default one',
  statusRefreshing: 'Refreshing…',
  statusRefreshed: '✓ Refreshed',
  statusCopied: '✓ Copied: {id}',
  statusCopyFailed: 'Could not copy to the clipboard',
  statusFolderMissing: 'Folder no longer exists: {path}',
  statusPickFolder: 'Pick a folder to start a conversation',
  statusFavAdded: '★ Added to favorites',
  statusFavRemoved: 'Removed from favorites',
  statusTabOpened: '✓ Opened in a new tab: {title} · {account}',
  statusWindowOpened: '✓ Opened in a new window: {title} · {account}',
  statusTmuxOpened: '✓ Opened in a tmux window: {title} · {account}',
  statusNoTabs: 'No terminal to open tabs in: press ↵ to open it here',
  statusOpenFailed: 'Could not open: {msg}',
  confirmOpen: 'Already open in another terminal ({account}). ',
  newTitle: 'new · {name}',
  forkTitle: 'fork · {title}',

  kOpen: 'open',
  kTab: 'tab',
  kNew: 'new',
  kFork: 'fork',
  kFav: 'favorite',
  kGoFolder: 'its folder',
  kAccount: 'account',
  kBack: 'back',
  kQuit: 'quit',
  kExpand: 'expand',
  kColumn: 'column',
  kScroll: 'scroll',
  kForkOpen: 'open a fork',
  kOpenAnyway: 'open anyway',
  kCancel: 'cancel',
  kSearchClear: 'clear search',

  messages: '{n} messages',
  message: '1 message',
  openNow: '● Open now in another terminal · {account}',
  busy: 'working',
  idle: 'waiting',
  startedWith: 'Started with',
  you: 'You',
  moreAbove: '↑ {n} more lines above',
  folderMissing: '✗ This folder no longer exists',
  conversations: '{n} conversations',
  conversation: '1 conversation',
  lastActivity: 'last {date}',
  noConvsYet: 'No conversations yet',
  subfolders: 'Subfolders',
  allSummary: '{convs} in {folders} folders',
  untitled: '(untitled)',

  today: 'today',
  yesterday: 'yesterday',
  groupToday: 'Today',
  groupYesterday: 'Yesterday',
  group7: 'Previous 7 days',
  group30: 'Previous 30 days',
  days: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
  months: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec',
  locale: 'en-US',

  cliNeedsTty: 'cses needs an interactive terminal (try "cses list")',
  cliResuming: 'Resuming',
  cliForking: 'Fork of',
  cliNewIn: 'New conversation in',
  cliAccount: 'account',
  cliNoAccount: 'There is no account "{name}". See: cses accounts',
  cliLogin: 'Logging in to "{name}" ({dir}). Your browser opens; if it signs in to another account by itself, open the link in a private window.',
  cliNewAccountUsage: 'Usage: cses new-account NAME',
  cliNewAccountNext: 'Next: cses login {name}',
  cliShared: 'history shared with {names}',
  cliLaunchFailed: 'cses: could not launch claude: {msg}',
  cliSwitching: 'Continuing with account {name}…',

  setupTitle: 'Settings',
  setupWelcome: 'First time with cses: set up your Claude accounts and preferences here. Come back any time with ^K or "cses config".',
  setupAccounts: 'Claude accounts',
  setupAccountsIntro: 'Log in once to each account. After that cses switches between them without /login.',
  setupNoSession: 'not logged in · ↵ to log in',
  setupSame: '⚠ same account as {name}',
  setupChecking: 'checking…',
  setupAddAccount: '+ Add account',
  setupAccountName: 'Account name (work, personal…):',
  setupPrefs: 'Preferences',
  setupDefaultAccount: 'Default account',
  setupLanguage: 'Language',
  setupPanel: 'Accounts panel next to claude',
  setupMouse: 'Mouse',
  setupTerminal: 'Open new tabs in',
  setupAuto: 'automatic',
  setupYes: 'yes',
  setupNo: 'no',
  setupTermWindow: 'new window',
  setupRoots: 'Root folders: always at the top of the tree',
  setupAddRoot: '+ Add folder',
  setupRootPrompt: 'Folder path:',
  setupRules: 'Rules: which account each folder opens with',
  setupAddRule: '+ Add rule',
  setupRulePrompt: 'Folder for the rule:',
  setupKeys: '↑↓ move · ←→ change · ↵ select · s log out · d remove · esc save and exit',
  setupInputKeys: '↵ accept · esc cancel',
  setupLogoutConfirm: 'Press s again to log "{name}" out',
  setupNoFolder: '{path} does not exist',
  setupLoggingIn: 'Logging in to "{name}" ({dir}).',
  setupLoggingInHint: 'Your browser opens: sign in with the account you want as "{name}". If it signs in to another one by itself, open the link in a private window.',
  setupLoggingOut: 'Logging "{name}" out…',
  kConfig: 'settings',

  panelTitle: 'Accounts',
  panelInUse: 'in use',
  panelBusy: 'responding…',
  panelLimit: '⚠ limit',
  panelResets: 'back {time}',
  panelNoSession: 'not logged in · click to log in',
  panelOwnHistory: 'separate history',
  panelAdd: '+ Add account',
  panelAddPrompt: 'New account name:',
  panelAddHint: '↵ create · esc cancel',
  panelLoginTab: 'Log in from the new tab (your browser opens)',
  panelLoginFailed: 'Could not open another tab. Run: cses login {name}',
  panelConfirmBusy: 'Claude is responding. Click again to stop it and switch',
  panelLimitBanner: '⚠ Limit reached',
  panelLimitHint: 'Click another account to keep the same chat going',
  panelSwitching: 'Switching to {name}…',
  panelNotShared: "{name} doesn't share the history: it can't continue this chat",
  panelWaiting: 'Waiting for claude…',
  panelKeys: '1-9 · click · n new',
  panelUnavailable: 'The accounts panel sits next to claude in Windows Terminal or tmux: run cses from there (or use ^T) to get it.',

  adminBadName: 'The name can only contain letters, digits, "-" and "_"',
  adminExists: '{dir} already exists',
  adminCreated: 'Created {dir}',
  adminSharedDir: '  {name}/ → shared with the main account',
  adminSharedFile: '  {name} → shared with the main account',
  adminCopied: '  {name} → copied (could not link it: changes won\'t be shared)',

  help: `cses — Claude Code conversations from every folder and every account

Usage:
  cses                     Open the browser
  cses .                   Start in the current folder
  cses list [N]            The last N, without the UI (20 by default)
  cses accounts            Detected accounts and whether they share history
  cses new-account NAME    Create ~/.claude-NAME sharing history and settings
  cses login NAME          Log in to that account (your browser opens)
  cses config              Accounts and preferences (from the browser: ^K)

Anything that isn't a cses option (e.g. --model opus) is passed to claude.
Put "--" in front to pass everything through as is.

Columns: folders | conversations | preview. ← → switch columns.
  type       search the column             esc    clear search / back / quit
  ↵          open (on a folder: show its conversations)
  ^T  open in a new tab          ^N  new conversation       ^F  open a fork
  ^E  favorite                   ^G  go to its folder       ^A  switch account
  ^Y  copy the id                ^R  refresh                ^K  accounts and settings
  ^C  quit
  Mouse: click to select, double-click to open, wheel to scroll.

Config: ~/.cses/config.json (see README)`,
};

const CATALOG: Record<Lang, Messages> = { es, en };

export function detectLang(): Lang {
  const candidates = [process.env.CSES_LANG, process.env.LC_ALL, process.env.LC_MESSAGES, process.env.LANG];
  for (const c of candidates) {
    if (c && c !== 'C' && c !== 'POSIX') return c.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
  // En Windows no suele haber LANG: se mira el idioma del sistema
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  return locale.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = detectLang();

export function setLang(lang: Lang) {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function t(key: keyof Messages, vars: Record<string, string | number> = {}): string {
  return CATALOG[current][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function plural(n: number, one: keyof Messages, many: keyof Messages): string {
  return n === 1 ? t(one) : t(many, { n });
}
