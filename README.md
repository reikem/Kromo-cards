# Kromacard — Estudio de Photocards 3D, Recuerdos de Concierto y Trueques en Tiempo Real

**Kromacard** es una aplicación web progresiva (PWA) full-stack diseñada para coleccionistas de photocards, cartas conmemorativas deportivas y recuerdos de conciertos. Permite diseñar cartas interactivas con efectos holográficos 3D, organizar álbumes personales, escanear e imprimir códigos QR físicos, sincronizar creaciones con Google Drive y realizar intercambios (trueques y regalos) verificados en tiempo real.

---

## Tabla de Contenidos

1. [Características Principales](#características-principales)
2. [Arquitectura y Stack Tecnológico](#arquitectura-y-stack-tecnológico)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Seguridad e Integridad](#seguridad-e-integridad)
5. [API REST y Tiempo Real (WebSocket)](#api-rest-y-tiempo-real-websocket)
6. [Configuración e Instalación Local](#configuración-e-instalación-local)
7. [Notificaciones Web Push (VAPID)](#notificaciones-web-push-vapid)
8. [Despliegue en Producción y Modo Offline](#despliegue-en-producción-y-modo-offline)

---

## Características Principales

### 1. Bóveda 3D y Álbumes Personales
- Visualización de photocards con inclinación 3D reactiva al puntero, brillo holográfico dinámico, texturas en relieve y reverso interactivo con autógrafo digital, dedicatoria y enlaces musicales.
- Filtrado por colección personal, cartas de amigos, favoritos locales y búsqueda por voz/texto.
- Respaldo offline-first mediante **IndexedDB** (`src/utils/offlineDb.ts`) para consultar cartas y favoritos incluso sin conexión a internet.

### 2. Estudio de Diseño 3D (`StudioView`)
- **Marcos y Formas Personalizables**: Formas geométricas y temáticas (`rectangulo`, `escudo`, `ticket`, `corazon`, `hexagono`, `polaroid`, `arco`, `estrella`, `octagono`, `nube`, `pergamino`, `visor`), temáticas festivas (Navidad, Halloween, San Valentín, Año Nuevo, Cumpleaños, Aniversario, Concierto) y carga de marcos propios en PNG/SVG (`CustomFrameStudio`).
- **Texturas y Efectos Visuales**: Más de 25 texturas holográficas/metálicas y efectos (`sparkle-dust`, `prism-rays`, `aurora-glow`, `scanlines-crt`, `vignette-noir`, `cyber-glitch`, `rainbow-edge`, `confetti-shimmer`), además de generador/subida de texturas personalizadas (`CustomTextureStudio`).
- **Filtros de Imagen y Stickers**: Ajuste fino de brillo, contraste, saturación, matiz, sepia y escala de grises; posicionamiento libre de stickers con escala y rotación, además de un creador propio de stickers (`StickerCreatorView`).
- **Modo Boleto de Concierto**: Integración de datos de gira, asiento/fila, canción favorita, audio ambiental y código QR único en el reverso.

### 3. Mercado de Trueques, Historial, Estadísticas y CSV (`TradeBazaarView`)
- **Escaparate de Trueque**: Publicación de cartas repetidas con notas de búsqueda, categoría comunitaria, rareza (`Mítica`, `Ultra Rara`, `Rara`, `Estándar`) y ofertas con temporizador límite.
- **Intercambio Atómico Verificado**: Cada propuesta genera un código único (`VER-XXXXXX`) y transfiere la propiedad de ambas cartas de forma atómica al aceptarse, o ejecuta regalos directos inmediatos.
- **Historial Detallado y Filtros Visuales Tipo Chip**: Selector visual con conteo en vivo para filtrar instantáneamente por **Todos**, **Aceptados**, **Rechazados** y **Pendientes**, combinado con rango de fechas (hoy, 7 días, 30 días o rango personalizado) y búsqueda textual.
- **Estadísticas de Trueque**: Panel analítico con tasa de aceptación, balance de flujo (enviados vs. recibidos, trueques vs. regalos), tiempo promedio de cierre, ranking de socios principales y gráficos interactivos (**Recharts**) de actividad por fecha y distribución por estado.
- **Exportación a CSV**: Descarga del resumen completo (o de la vista filtrada) en formato `.csv` compatible con Excel y Google Sheets (codificación UTF-8 con BOM y protección contra inyección de fórmulas).

### 4. Escáner QR, Impresión A4 y Carteles de Conciertos
- **Escáner QR (`ScannerModal`)**: Lectura mediante cámara en vivo o imagen subida usando `jsQR`, resolviendo cartas locales o del servidor por `id`, `serialCode` o `ticketCode`.
- **Hoja de Impresión A4 (`PrintSheetModal`)**: Generación de láminas listas para imprimir con frente, reverso y código QR recortable.
- **Carteles y Crónicas (`ConcertsView`)**: Tablero de eventos, setlists, reacciones de artistas y reproducción de audio ambiental (`soundEngine.ts`).

### 5. Chat en Tiempo Real, Autenticación Google y Google Drive
- **Sala de Amigos y Mensajes Directos (`FriendsChatView`)**: Mensajería instantánea vía WebSocket (`/ws`) con capacidad para adjuntar y previsualizar photocards en 3D dentro del chat.
- **Google Sign-In & Exportación a Drive (`googleDriveAuth.ts`, `DriveExportButton.tsx`)**: Inicio de sesión unificado con Firebase Auth (OAuth 2.0) y respaldo directo de creaciones o de la bóveda original hacia la carpeta `FanCard Studio` en Google Drive.

---

## Arquitectura y Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Motion, Lucide React |
| **Gráficos y Multimedia** | Recharts 3, HTML5 Canvas, Web Audio API (`soundEngine`), `qrcode`, `jsqr` |
| **Backend** | Node.js, Express 4, WebSocket (`ws`), `web-push` (VAPID) |
| **Persistencia** | Almacenamiento JSON estructurado en servidor (`data/store.json`) + IndexedDB en cliente |
| **Autenticación y Cloud** | Firebase Authentication, Google Identity Services, Google Drive REST API |
| **PWA y Offline** | `vite-plugin-pwa` (Workbox) + Service Worker personalizado (`public/sw-push.js`) |

---

## Estructura del Proyecto

```text
.
├── data/                         # Persistencia local del servidor (store.json, claves VAPID, suscripciones push)
├── public/                       # Activos estáticos, iconos PWA y sw-push.js (Service Worker de Push)
├── src/
│   ├── assets/                   # Imágenes base para cartas, estadios y fondos
│   ├── components/
│   │   ├── Card3D.tsx            # Renderizado 3D interactivo (frente, reverso, QR, stickers, efectos)
│   │   ├── StudioView.tsx        # Editor completo de photocards, filtros, marcos y boletos
│   │   ├── CustomFrameStudio.tsx # Creador y carga de marcos personalizados
│   │   ├── CustomTextureStudio.tsx # Generador y exportación PNG de texturas
│   │   ├── StickerCreatorView.tsx# Estudio de stickers propios
│   │   ├── TradeBazaarView.tsx   # Mercado de trueques, historial, chips, estadísticas y exportación CSV
│   │   ├── CommunityLibraryView.tsx # Biblioteca comunitaria de cartas, marcos, texturas y fondos
│   │   ├── ConcertsView.tsx      # Carteles y recuerdos de conciertos
│   │   ├── FriendsChatView.tsx   # Chat grupal y mensajes directos en tiempo real
│   │   ├── FriendsProfileView.tsx# Perfil de coleccionista y métricas del fan (FanStatsSection)
│   │   ├── ScannerModal.tsx      # Escáner QR con cámara e importación de imagen
│   │   └── PrintSheetModal.tsx   # Maquetación de hojas A4 imprimibles
│   ├── types/
│   │   └── kromacard.ts          # Contratos TypeScript de dominio (Photocard, TradeOffer, etc.)
│   ├── utils/
│   │   ├── offlineDb.ts          # Capa IndexedDB para snapshots y favoritos offline
│   │   ├── pushNotifications.ts  # Registro del Service Worker y suscripción pushManager
│   │   ├── googleDriveAuth.ts    # Autenticación Google/Firebase y sincronización con Google Drive
│   │   ├── cardExporter.ts       # Exportación de cartas en imagen PNG
│   │   └── frameShapes.ts        # Definición geométrica SVG de formas y categorías
│   ├── App.tsx                   # Orquestador principal, estado global y conexión WebSocket
│   └── main.tsx                  # Punto de entrada React
├── server.ts                     # Servidor Express + WebSocket + Web Push + Vite SSR/SPA middleware
├── vite.config.ts                # Configuración de Vite, Tailwind y VitePWA
├── metadata.json                 # Metadatos y permisos del applet
└── package.json                  # Scripts y dependencias del proyecto
```

---

## Seguridad e Integridad

- **Validación de Imágenes y SVG Anti-XSS**: El servidor inspecciona cada `photoUrl`, firma SVG (`autographDataUrl`), marco o textura (`isSafeImageSource` / `isSafeSvgDataUrl`) bloqueando etiquetas peligrosas (`<script>`, `<foreignObject>`, `<iframe>`, manejadores `on*`, `javascript:`).
- **Validación de Suscripciones Push**: Las suscripciones `pushManager` se validan exigiendo esquema `https:` público y claves criptográficas `p256dh` y `auth` válidas.
- **Protección en Exportación CSV**: Los valores exportados escapan comillas/saltos de línea conforme a RFC 4180 y neutralizan prefijos de inyección de fórmulas (`=`, `+`, `-`, `@`) en hojas de cálculo.
- **Verificación de Identidad Google**: `/api/auth/google` verifica el `idToken` de Firebase o el `accessToken` OAuth contra los endpoints oficiales de Google antes de crear o vincular un perfil de coleccionista.
- **Intercambio Atómico de Cartas**: Al aceptar un trueque, el servidor comprueba que ambos usuarios sigan siendo propietarios de sus respectivas cartas antes de transferirlas simultáneamente.

---

## API REST y Tiempo Real (WebSocket)

### Endpoints Principales (`/api/*`)
- `GET /api/bootstrap` — Carga el estado inicial completo (usuarios, cartas, álbumes, trueques, recursos comunitarios, notificaciones y mensajes).
- `GET /api/cards/lookup?code=...` — Búsqueda de cartas por ID, código serial o código de boleto para el escáner QR.
- `POST /api/cards` · `PUT /api/cards/:id` · `DELETE /api/cards/:id` — Gestión CRUD de photocards.
- `POST /api/albums` · `PUT /api/albums/:id` — Creación y actualización de álbumes.
- `POST /api/frames` · `POST /api/textures` · `POST /api/filters` · `POST /api/stickers` · `POST /api/backdrops` · `POST /api/banners` — Publicación de recursos creativos compartidos.
- `POST /api/trades` — Envío de propuestas de trueque o regalos directos.
- `POST /api/trades/:id/respond` — Aceptación atómica o rechazo de trueques (`action: 'accept' | 'decline'`).
- `POST /api/chat` — Envío de mensajes en sala general o chat privado (`dm:...`) con notificaciones automáticas.
- `POST /api/auth/google` — Verificación de sesión Google/Firebase y sincronización de usuario.
- `GET /api/push/vapid-public-key` · `POST /api/push/subscribe` · `POST /api/push/test` — Gestión de claves VAPID y notificaciones Web Push.
- `POST /api/notifications/read` · `POST /api/notifications/dismiss` — Marcado de lectura y cierre de notificaciones.

### WebSocket (`/ws`)
Emite eventos en vivo a todos los clientes conectados: `card:created`, `card:updated`, `card:deleted`, `trade:created`, `trade:updated`, `chat:message`, `notification:new`, `users:updated`, `asset:liked`, entre otros.

---

## Configuración e Instalación Local

### Requisitos Previos
- **Node.js** >= 20
- **npm** (o **bun**)

### Variables de Entorno
Copia `.env.example` a `.env` y configura las variables necesarias según tu entorno:

```env
GEMINI_API_KEY="TU_GEMINI_API_KEY"
APP_URL="http://localhost:3000"

# Claves VAPID opcionales (si se omiten, server.ts las genera automáticamente en data/vapid-keys.json)
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:notifications@kromacard.app"
```

### Comandos Disponibles

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo (Express + Vite + WebSocket en puerto 3000)
npm run dev

# 3. Verificar tipos TypeScript
npm run lint

# 4. Compilar aplicación cliente para producción
npm run build

# 5. Ejecutar en modo producción
npm start
```

---

## Notificaciones Web Push (VAPID)

Kromacard utiliza el estándar **Web Push (VAPID)** a través de `web-push` en el servidor y `pushManager` en el cliente (`public/sw-push.js`):
1. Al iniciar el servidor, si no existen `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en variables de entorno, se generan automáticamente y se persisten en `data/vapid-keys.json`.
2. El cliente solicita la clave pública en `/api/push/vapid-public-key`, registra el Service Worker y envía la suscripción cifrada a `/api/push/subscribe`.
3. Ante nuevos trueques, respuestas, regalos o mensajes directos, el servidor dispara notificaciones push incluso si la pestaña o el navegador están cerrados.

---

## Despliegue en Producción y Modo Offline

- **Despliegue Full-Stack**: Ejecuta `npm run build` seguido de `npm start` (sirve `dist/`, la API REST y WebSockets en el puerto `3000`).
- **Despliegue Estático / Serverless (ej. Vercel)**: Si la aplicación se sirve únicamente como SPA estática sin el servidor Express activo, `src/App.tsx` detecta automáticamente la ausencia del backend (`/api/bootstrap`), evita errores de WebSocket/VAPID y opera de manera resiliente utilizando datos base locales y almacenamiento en **IndexedDB**.
