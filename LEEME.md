# FuturaTV – app para TV

Funciona en:
- **Caja Android / Chromecast con Google TV / Fire TV Stick** (conectada al TV LG): `dist/FuturaTV.apk`
- **TV LG directo (webOS)**: `dist/com.laboratorio.mitv_1.2.0_all.ipk`

Tiene dos secciones:

- **Apps**: abre YouTube, Netflix, Prime Video, Disney+, Max, Apple TV, Pluto TV, LG Channels, Spotify y el navegador (todas apps oficiales ya instaladas en el TV).
- **Canales en vivo**: casi 500 canales y radios chilenos, por categorías (Nacionales, Regionales, Deportes, Temáticos, Cultura, Música y radios, Religiosos, Más canales).
  - Lista principal: <https://m3u.cl/lista/CL.m3u>, que se descarga cada vez que abres la app para tener los enlaces al día. Si no carga, se usa la copia incluida en `app/channels/chile.m3u`.
  - Lista extra (se cambia en **Ajustes**): canales gratuitos de Chile de [iptv-org](https://github.com/iptv-org/iptv). Los repetidos se omiten.

## Cómo se usa con el control

| Dónde | Botón | Qué hace |
|---|---|---|
| Lista de canales | OK | Ver el canal en pantalla completa (si hay un PiP abierto, cambia el canal del PiP; OK otra vez = pantalla completa) |
| Lista de canales | **Mantener OK** o MENU | Opciones: ver en pantalla completa / **ver en ventana chica (PiP)** / ★ favorito / 🚫 ocultar |
| Canales en vivo | 🔍 Buscar | Teclado en pantalla para buscar por nombre (sin importar tildes); ▼ baja a los resultados |
| Pantalla completa | ▲▼ / CH+ CH- | Canal anterior / siguiente |
| Pantalla completa | OK o ◀ | Abre la **lista de canales a la izquierda** (◀▶ cambia de categoría, OK cambia de canal) |
| Pantalla completa | ATRÁS | **PiP**: el canal sigue en una ventana chica mientras recorres los demás |
| PiP | ATRÁS | Cierra el video |
| Cualquiera | Amarillo / Rojo / Azul | Favorito / Ocultar / PiP ↔ pantalla completa |

- Los **favoritos** aparecen primero, en la categoría ★ Favoritos.
- Los canales **ocultos** desaparecen de las listas. Se recuperan en la categoría 🚫 Ocultos o desde **Ajustes → Mostrar todos los ocultos**.
- Con el puntero del Magic Remote o el mouse: clic derecho sobre un canal abre las opciones.

## Actualizaciones automáticas (sin reinstalar el APK)

La caja Android revisa al abrir la app (y cada 6 horas) si hay una versión nueva de la interfaz en internet.
Si la hay, la descarga en segundo plano y se aplica sola. **Solo hay que reinstalar el APK si cambia la parte Android** (`android/`).

Configuración, una sola vez:
1. Crea un repositorio **público** en GitHub, por ejemplo `futuratv`, y sube esta carpeta (el `.gitignore` deja fuera la clave de firma).
2. En `config.json` pon la dirección de la carpeta `app` del repositorio:
   `"updateUrl": "https://raw.githubusercontent.com/TU_USUARIO/futuratv/main/app/"`
3. Compila e instala el APK **una última vez** (`./build-apk.sh`).

Para publicar una actualización:
1. Cambia lo que quieras en `app/` y sube el número en `app/appinfo.json` (`"version": "1.3.1"`).
2. Ejecuta `python3 make-version.py`.
3. Sube los cambios a GitHub (`git commit` + `git push`). Las cajas se actualizan solas.

> El TV LG (webOS) no puede actualizarse solo: ahí hay que reinstalar el `.ipk`.

## Instalar el APK (caja Android, Google TV o Fire TV)

**Opción 1 – Pendrive** (cajas Android con USB)
1. Copia `dist/FuturaTV.apk` a un pendrive y conéctalo a la caja.
2. En la caja, instala desde Google Play un explorador de archivos, por ejemplo **X-plore File Manager** o **File Commander**.
3. Abre el pendrive con el explorador, selecciona `FuturaTV.apk` y elige **Instalar**.
4. Si aparece un aviso, permite **Instalar apps desconocidas** para ese explorador (Ajustes → Apps → Seguridad).

**Opción 2 – Sin cables** (Chromecast con Google TV, Fire TV, cajas sin USB)
1. En la caja, instala la app **Send Files to TV** desde la tienda (también hay que instalarla en tu celular).
2. Envía `FuturaTV.apk` desde el celular a la caja y ábrelo para instalar.
3. Permite **Instalar apps desconocidas** si lo pide.
   - Fire TV: Ajustes → Mi Fire TV → Opciones para desarrolladores → Apps de origen desconocido.
   - Google TV: Ajustes → Sistema → Acerca de → pulsa 7 veces «Compilación del SO Android TV» para activar el modo desarrollador. Luego, Ajustes → Apps → Seguridad → Apps desconocidas.

"FuturaTV" aparece en la fila de apps de la pantalla de inicio.

Para volver a compilar el APK después de cambiar algo:

```bash
./build-apk.sh
```

Las herramientas (Java 17 y Android SDK 34) quedaron en `~/.local/mitv-android`. La clave de firma es `android/mitv.keystore`: **no la borres**, porque las actualizaciones se tienen que firmar con la misma clave.

## Instalador para TV LG (webOS)

El instalador ya está hecho: **`dist/com.laboratorio.mitv_1.2.0_all.ipk`**.
Si cambias algo en `app/`, vuelve a generarlo con:

```bash
python3 build-ipk.py
```

## Instalar en el TV LG

LG no permite instalar apps desde un pendrive. Las apps propias se instalan por Wi‑Fi con el **Modo Desarrollador**, que es gratis.

### Paso 1 – Preparar el TV (una sola vez)
1. Crea una cuenta gratis en <https://webostv.developer.lge.com> (botón *Sign in*).
2. En el TV abre **LG Content Store**, busca e instala **Developer Mode**.
3. Abre Developer Mode, entra con esa cuenta, activa **Dev Mode Status** (el TV se reinicia) y luego activa **Key Server**.
4. Anota la **IP** y la **Passphrase** que muestra la pantalla.

El Mac y el TV deben estar en la misma red Wi‑Fi.

### Paso 2, opción A – Con programa de ventanas (más fácil)
1. Descarga **webOS Dev Manager** para Mac desde <https://github.com/webosbrew/dev-manager-desktop/releases>.
2. *Add device* → escribe la IP y la Passphrase del TV.
3. Ve a **Apps** → **Install** → elige `dist/com.laboratorio.mitv_1.2.0_all.ipk`.
4. "FuturaTV" aparece en el menú de apps del TV.

### Paso 2, opción B – Con la terminal
Instala la herramienta oficial de LG:

```bash
npm install -g @webos-tools/cli
```

Registra el TV (usa la IP que muestra la app Developer Mode; la passphrase también aparece ahí):

```bash
ares-setup-device --add mitv -i "host=IP_DEL_TV" -i "port=9922" -i "username=prisoner"
```

```bash
ares-novacom --device mitv --getkey
```

Instala y abre la app (desde esta carpeta):

```bash
ares-install --device mitv dist/com.laboratorio.mitv_1.2.0_all.ipk
```

```bash
ares-launch --device mitv com.laboratorio.mitv
```

> El modo desarrollador caduca cada 50 horas; ábrelo de nuevo en el TV y pulsa *Extend* para que la app no se desinstale.

## Personalizar

- **Apps**: lista `APPS` al inicio de `app/app.js`. Si una app no está instalada, aparece un aviso.
- **Otros países**: en Ajustes usa `https://iptv-org.github.io/iptv/countries/XX.m3u` (ar, mx, es, co, pe…), o cualquier lista M3U a la que tengas acceso legal.
- Algunos canales de la lista pública pueden estar caídos o bloqueados por región; con ▲▼ pasas al siguiente.

## Clave de firma del APK (importante)

Los APK de FuturaTV (desde la 1.7.0) están firmados con la clave `android/mitv.keystore`
(alias `mitv`, huella SHA-256 `0E:96:4C:40:48:66:62:F9:14:1F:E1:44:59:70:72:CC:4B:AB:44:DC:89:A9:78:E2:DE:82:FB:C0:5E:15:C6:30`).

- **No se sube a GitHub** (el repositorio es público; el `.gitignore` la deja fuera). Guárdala en un lugar privado
  (pendrive, Google Drive o similar) con el nombre `FuturaTV-clave-firma.keystore`.
- Para armar un APK nuevo que se **instale encima** del que ya está en la TV (sin desinstalar ni perder favoritos),
  copia ese archivo a `android/mitv.keystore` antes de correr `./build-apk.sh`.
- Si se pierde, los APK nuevos tendrán otra firma: habrá que desinstalar la app de la TV y se perderán los favoritos.
