# FanCard Studio (Kromacard) — Documentación Técnica y Guía del Proyecto

> **Estudio interactivo de photocards 3D, recuerdos de conciertos, códigos QR imprimibles, trueques verificados en tiempo real y respaldo en Google Drive.**

---

## 1. Visión General

**FanCard Studio (Kromacard)** es una aplicación web progresiva (PWA) full-stack creada para comunidades de coleccionistas, fans de conciertos y diseñadores de tarjetas digitales y físicas. Combina un estudio de diseño 3D en el navegador con herramientas de verificación física mediante códigos QR, sincronización en la nube con **Google Drive**, comunicación en tiempo real por **WebSocket** y notificaciones **Web Push** en segundo plano.

### Objetivos del Proyecto
- Permitir a cualquier usuario diseñar photocards coleccionables de acabado profesional (holográfico, dorado, cromado, neón, polaroid o con marcos propios).
- Unir el mundo digital y físico mediante reversos con códigos **QR únicos**, hojas de impresión **A4** y un escáner con cámara o imagen.
- Facilitar un ecosistema seguro de intercambio (**trueques bilaterales y regalos directos**) con trazabilidad completa, estadísticas y exportación en **CSV**.
- Funcionar de forma resiliente tanto conectado a un servidor Node.js/Express como en despliegues estáticos u offline mediante **IndexedDB** y **Service Workers**.

---

## 2. Arquitectura del Sistema

La aplicación sigue una arquitectura **Full-Stack React + Express** con sincronización reactiva por eventos y almacenamiento híbrido (servidor + caché local en navegador).

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        CLIENTE (React 19 + Vite 8 + PWA)                │
│                                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │  App.tsx     │  │  StudioView   │  │ TradeBazaar   │  │ Scanner   │ │
│  │ Estado Global│  │ Card3D / SVG  │  │ Chips / CSV   │  │ Modal jsQR│ │
│  └──────┬───────┘  └───────────────┘  └───────────────┘  └───────────┘ │
│         │                                                               │
│  ┌──────┴──────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│  │ IndexedDB           │    │ Service Worker   │    │ Firebase Auth  │  │
│  │ offlineDb.ts        │    │ Workbox+sw-push  │    │ & Google Drive │  │
│  │ (Snapshots/Favs)    │    │ (Cache + Push)   │    │ (OAuth2/GIS)   │  │
│  └─────────────────────┘    └────────┬─────────┘    └───────┬────────┘  │
└──────────────────────────────────────┼──────────────────────┼───────────┘
                                       │ HTTPS / WSS          │ OAuth 2.0
                                       ▼                      ▼
┌────────────────────────────────────────────────────┐  ┌─────────────────┐
│              SERVIDOR (Node.js + server.ts)        │  │  Google Cloud   │
│                                                    │  │                 │
│  • Express REST API (/api/*)                       │  │ • Firebase Auth │
│  • WebSocket Server (/ws) -> Broadcast en vivo     │  │ • Drive API v3  │
│  • web-push (VAPID) -> Notificaciones 2º plano     │  │   Carpeta:      │
│  • Validación XSS SVG/Imágenes & Auth Google       │  │ "FanCard Studio"│
│  • Persistencia: data/store.json & vapid-keys.json │  └─────────────────┘
└────────────────────────────────────────────────────┘
```

### Stack Tecnológico Principal

| Área | Tecnologías |
| :--- | :--- |
| **Interfaz y Estado** | React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React |
| **Visualización de Datos** | Recharts 3 (`BarChart`, `AreaChart`, `PieChart`) |
| **Gráficos, QR y Audio** | HTML5 Canvas, `qrcode`, `jsqr`, Web Audio API (`soundEngine.ts`) |
| **Backend y Tiempo Real** | Express 4, HTTP Server, `ws` (WebSockets), `tsx` |
| **Notificaciones y PWA** | `vite-plugin-pwa` (Workbox), `web-push` (VAPID), `pushManager` |
| **Identidad y Nube** | Firebase Authentication, Google Identity Services (GIS), Google Drive REST API |
| **Persistencia Offline** | IndexedDB (`src/utils/offlineDb.ts`) |

---

## 3. Funcionalidades Clave

### A. Motor 3D y Estudio Creativo (`Card3D`, `StudioView`)
El núcleo visual reside en `src/components/Card3D.tsx` y `src/components/StudioView.tsx`:
- **Inclinación 3D Reactiva (`pointerTilt`)**: Calcula la posición relativa del cursor o toque para rotar la carta en los ejes `X`/`Y` y desplazar dinámicamente los reflejos holográficos y metálicos.
- **Marcos y Formas SVG (`src/utils/frameShapes.ts`)**: Soporta 12 siluetas (`rectangulo`, `escudo`, `ticket`, `corazon`, `hexagono`, `polaroid`, `arco`, `estrella`, `octagono`, `nube`, `pergamino`, `visor`), estilos (`holo`, `gold`, `stadium`, `polaroid`, `neon-cyber`, `royal-velvet`, `sakura-pearl`, `liquid-chrome`, `custom`) y temáticas festivas (Navidad, Halloween, San Valentín, Año Nuevo, Cumpleaños, Aniversario, Concierto).
- **Estudios Modulares**:
  - `CustomFrameStudio.tsx`: Creación de marcos y carga de bordes/superposiciones PNG/SVG propios.
  - `CustomTextureStudio.tsx`: Generador procedural de texturas holográficas, subida de texturas propias y exportación a PNG.
  - `StickerCreatorView.tsx`: Diseño de stickers de texto, emoji o imagen para arrastrar y posicionar libremente sobre la carta.
- **Reverso Interactivo y Boleto de Concierto**: Incluye firma digital SVG (`svgSignature.ts`), dedicatoria, enlace musical, código QR, metadatos de gira/asiento y reproductor de audio ambiental (`soundEngine.ts`).

### B. Ecosistema QR e Impresión Física (`ScannerModal`, `PrintSheetModal`)
- **Generación Automática (`src/utils/cardExporter.ts`)**: Cada carta genera su código QR (`generateCardQRDataUrl`) vinculado a su identificador único y serial (`KRM-XXXX`).
- **Escáner Multi-Pasada (`src/components/ScannerModal.tsx`)**:
  - Funciona con **cámara en vivo** (cambio entre cámara frontal y trasera), **subida de imagen** o **búsqueda manual por código serial/boleto**.
  - Utiliza `jsQR` con una estrategia multi-pasada (`decodeQrMultiPass`): analiza el fotograma completo, el recorte central (64%) y el cuadrante inferior derecho (donde se ubica el QR en láminas exportadas).
  - Resuelve coincidencias localmente o consultando `GET /api/cards/lookup?code=...` para inspeccionar en 3D o clonar recuerdos a un álbum.
- **Impresión A4 (`src/components/PrintSheetModal.tsx`)**: Organiza múltiples cartas con frente, reverso y guías de corte listas para imprimir o guardar en PDF.

### C. Integración con Google y Google Drive (`FanCard Studio`)
Implementada en `src/utils/googleDriveAuth.ts` y `src/components/DriveExportButton.tsx`:
- **Inicio de Sesión Unificado**: Utiliza **Firebase Authentication** (`signInWithPopup` con `GoogleAuthProvider`) como flujo principal para evitar errores de `origin_mismatch`, manteniendo Google Identity Services (GIS) únicamente como respaldo para tokens de Drive cuando es necesario.
- **Sincronización de Coleccionista**: El backend (`POST /api/auth/google`) verifica el `idToken` o `accessToken` con Google y crea o vincula automáticamente el perfil `CollectorUser` y su álbum personal.
- **Carpeta Dedicada `FanCard Studio`**: Con los permisos `drive.readonly` y `drive.file`, el usuario puede importar fotografías desde su Google Drive hacia el Estudio o exportar sus cartas (frente y reverso en PNG), stickers (SVG/PNG), texturas y toda la bóveda original directamente a su nube.
- **Manejo Seguro de Tokens**: El token de acceso de Drive se mantiene estrictamente en memoria (`cachedAccessToken`) sin persistirse en `localStorage` ni `sessionStorage`.

### D. PWA, Modo Offline y Notificaciones Web Push
Implementado en `vite.config.ts`, `public/sw-push.js`, `src/utils/pushNotifications.ts` y `src/utils/offlineDb.ts`:
- **Instalable como App (PWA)**: Configurada mediante `vite-plugin-pwa` (Workbox) con manifiesto completo e iconos adaptables/maskable.
- **Persistencia Offline (IndexedDB)**: Guarda instantáneas completas de la bóveda (`saveBootstrapSnapshot`) y cartas favoritas (`saveFavoriteCard`), permitiendo seguir navegando incluso si el backend no está disponible (por ejemplo, en despliegues estáticos).
- **Web Push en Segundo Plano (VAPID)**:
  - El servidor (`server.ts`) gestiona claves VAPID (por variables de entorno o autogeneradas en `data/vapid-keys.json`) y expone `/api/push/vapid-public-key`, `/api/push/subscribe` y `/api/push/test`.
  - El Service Worker importa `/sw-push.js` para escuchar eventos `push`, mostrar alertas del sistema ante nuevos trueques o mensajes directos incluso con el navegador cerrado, y redirigir al usuario al hacer clic (`notificationclick`).

### E. Mercado de Trueques, Historial, Estadísticas y CSV (`TradeBazaarView`)
- **Escaparate e Intercambios Atómicos**: Filtrado por categoría, rareza (`Mítica`, `Ultra Rara`, `Rara`, `Estándar`), ofertas con tiempo límite y amigos. Cada propuesta genera un código `VER-XXXXXX` y ejecuta el intercambio de dueños de manera atómica en el servidor.
- **Historial con Filtros Visuales Tipo Chip**: Permite alternar instantáneamente entre **Todos**, **Aceptados**, **Rechazados** y **Pendientes** con contadores en tiempo real, rango de fechas y búsqueda.
- **Estadísticas de Trueques (Recharts)**: Calcula tasa de aceptación, balance enviados/recibidos, tiempo medio de cierre, ranking de socios y gráficos de barras por fecha y distribución circular por estado.
- **Exportación CSV Segura**: Exporta el historial completo (o filtrado) en UTF-8 con BOM y sanitización contra inyección de fórmulas (`=`, `+`, `-`, `@`).

---

## 4. Instrucciones de Uso

1. **Explorar la Bóveda**: Al iniciar, verás tus photocards en 3D. Haz clic en cualquier carta para abrir el **Inspector 3D**, girarla, leer la dedicatoria, escuchar su pista de concierto o marcarla como favorita.
2. **Diseñar en el Estudio**: Ve a la pestaña **Estudio** (`StudioView`), sube una foto (desde tu equipo o Google Drive), elige forma, marco, textura holográfica, efecto visual, filtros, stickers y firma digital. Pulsa guardar para añadirla a tu álbum.
3. **Escanear o Imprimir QR**: Usa **Escanear QR** en la barra superior para leer el reverso de una carta física con la cámara o una imagen. Usa **Imprimir A4** para generar una hoja lista para recorte.
4. **Proponer e Inspeccionar Trueques**: En **Trueque** (`TradeBazaarView`), explora cartas disponibles, propón un intercambio o envía un regalo. Consulta la pestaña **Historial** para revisar métricas, filtrar por chips de estado/fecha o descargar el **CSV completo**.
5. **Conectar Google Drive y Activar Push**: Inicia sesión con Google desde el perfil para sincronizar tus creaciones en la carpeta `FanCard Studio` de Drive, y activa las alertas push para recibir notificaciones de ofertas o mensajes directos en segundo plano.

---

## 5. Guía Rápida para Nuevos Desarrolladores

### Requisitos e Instalación
- **Node.js** `>= 20` y **npm** (o **bun**).

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno (opcional si usarás claves propias)
cp .env.example .env

# Levantar entorno de desarrollo (Express + Vite + WebSocket en puerto 3000)
npm run dev
```

### Comandos Principales

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia `tsx server.ts` en puerto `3000` montando `vite.middlewares` y el servidor WebSocket `/ws`. |
| `npm run lint` | Ejecuta verificación estricta de tipos TypeScript (`tsc --noEmit`). |
| `npm run build` | Compila la aplicación cliente en `dist/` generando el Service Worker PWA y copiando `src/assets`. |
| `npm start` | Sirve la aplicación compilada en producción desde `server.ts`. |

### Mapa Rápido del Código Fuente

```text
├── server.ts                      # API REST (/api/*), WebSocket (/ws), Web Push VAPID y store JSON
├── vite.config.ts                 # Configuración Vite, Tailwind v4, VitePWA + sw-push.js
├── public/sw-push.js              # Listener de eventos push y notificationclick del Service Worker
├── src/
│   ├── App.tsx                    # Orquestador global, navegación por pestañas, sync WS y fallback offline
│   ├── types/kromacard.ts         # Interfaces centrales (Photocard, TradeOffer, CollectorUser, etc.)
│   ├── components/
│   │   ├── Card3D.tsx             # Componente visual 3D (frente/reverso, tilt, QR, stickers, efectos)
│   │   ├── StudioView.tsx         # Editor principal de cartas
│   │   ├── TradeBazaarView.tsx    # Bazar, trueques activos, historial con chips, stats Recharts y CSV
│   │   ├── ScannerModal.tsx       # Lector QR multi-pasada con jsQR
│   │   ├── PrintSheetModal.tsx    # Generador de láminas imprimibles A4
│   │   ├── CommunityLibraryView.tsx # Biblioteca pública de marcos, texturas, fondos y cartas
│   │   ├── ConcertsView.tsx       # Crónicas y carteles de conciertos
│   │   ├── FriendsChatView.tsx    # Chat general y DMs en tiempo real
│   │   └── FriendsProfileView.tsx # Perfiles y FanStatsSection
│   └── utils/
│       ├── googleDriveAuth.ts     # Firebase Auth + Drive API ("FanCard Studio")
│       ├── pushNotifications.ts   # Registro SW, fetch VAPID y suscripción pushManager
│       ├── offlineDb.ts           # Persistencia IndexedDB para modo offline
│       ├── cardExporter.ts        # Renderizado Canvas PNG y generación QR
│       ├── frameShapes.ts         # Geometrías SVG de marcos y categorías
│       └── soundEngine.ts         # Sintetizador/reproductor Web Audio
```

### Flujo Recomendado para Añadir Funcionalidades
1. **Modelado de Datos**: Define o actualiza las interfaces en `src/types/kromacard.ts`.
2. **Backend y Tiempo Real**: Agrega el endpoint en `server.ts`, valida entradas (usa `isSafeImageSource` si se reciben URLs o dataURLs SVG/imagen), persiste con `saveStore()` y emite el evento correspondiente con `broadcast(...)`.
3. **Estado en Cliente**: Maneja la actualización optimista o suscripción WebSocket en `src/App.tsx` manteniendo sincronizado el snapshot de `offlineDb.ts`.
4. **Verificación**: Ejecuta siempre `npm run lint` y `npm run build` antes de confirmar cambios.

### Reglas de Seguridad Clave del Repositorio
- **Nunca** almacenes secretos privados (VAPID privada, claves de servidor) en archivos con prefijo `VITE_` ni en `localStorage`.
- **Valida** cualquier SVG o imagen en backend (`isSafeSvgDataUrl` / `isSafeImageSource`) para prevenir XSS almacenado.
- **Protege** cualquier exportación tabular (CSV) escapando celdas y neutralizando prefijos de fórmulas.
- **HMR en Preview**: Mantén la configuración de `DISABLE_HMR` en `vite.config.ts` y `server.ts` para entornos donde el HMR por WebSocket está deshabilitado.
