# NEXT CONTROL Firebase Setup

Esta guia deja NEXT CONTROL listo para trabajar con Firebase real. No subas credenciales reales al repositorio.

## 1. Crear proyecto Firebase

1. Entrar a Firebase Console.
2. Crear un proyecto.
3. Registrar una aplicacion web.
4. Copiar las variables del SDK web al archivo `.env.local`.

Variables esperadas:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

El archivo `.env.example` queda sin secretos. `.env.local` esta ignorado por git.

## 2. Habilitar productos

En Firebase Console:

1. Authentication > Sign-in method > habilitar Email/Password.
2. Firestore Database > crear base en modo production.
3. Storage > crear bucket.
4. Functions > habilitar Cloud Functions.

## 3. Instalar Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use <PROJECT_ID>
```

## 4. Instalar dependencias de Functions

```bash
cd functions
npm install
cd ..
```

## 5. Crear primer administrador

Todavia no existe un admin en el sistema, por eso el primer admin se crea manualmente.

Opcion recomendada:

1. Crear usuario manualmente en Firebase Authentication.
2. Copiar su UID.
3. Descargar un service account local desde Firebase Console.
4. Guardarlo fuera del repo o con un nombre ignorado, por ejemplo `firebase-service-account.local.json`.
5. Ejecutar:

```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\firebase-service-account.local.json"
$env:FIREBASE_PROJECT_ID="tu-proyecto"
$env:ADMIN_UID="uid-del-primer-admin"
$env:ADMIN_NAME="Richard"
node scripts/bootstrap-admin.mjs
```

El script:

- valida el usuario en Firebase Authentication
- crea/actualiza `users/{uid}`
- asigna `role: "admin"`
- asigna custom claim `{ role: "admin" }`

No subas el service account. `.gitignore` ya ignora `serviceAccount*.json` y `firebase-service-account*.json`.

## 6. Desplegar reglas y Functions

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions
```

Si falta billing o permisos, Firebase puede bloquear Functions. En ese caso desplegar primero rules/storage y luego functions cuando el proyecto este habilitado.

## 7. Crear usuarios desde NEXT CONTROL

1. Iniciar sesion con el admin inicial.
2. Ir a `/usuarios`.
3. Crear usuario con:
   - nombre
   - correo
   - contrasena temporal
   - rol
   - obras asignadas
4. Firebase genera automaticamente el UID.
5. La contrasena temporal nunca se guarda en Firestore.

Tambien se puede vincular un usuario existente por UID desde `/usuarios`.

## 8. Roles

Roles disponibles:

- admin
- gerencia
- administracion
- supervisor
- fiscalizador
- encargado
- produccion
- instalador

Permisos principales:

- admin: administra usuarios, obras, finanzas, avance y configuracion
- gerencia: visibilidad amplia y gestion operativa
- administracion: finanzas y creacion de obras
- supervisor/fiscalizador/encargado: obras asignadas y partes de avance
- instalador: tareas e instalacion

## 9. Probar flujo completo

Probar:

- login real
- logout
- recuperacion de contrasena
- crear usuario
- cambiar rol
- activar/desactivar usuario
- asignar obras
- crear/configurar avance de obra
- registrar avance desde `/supervisor`
- revisar `/avance-obras/:obraId`
- cargar material pendiente
- subir fotos cuando Storage este conectado

## 10. Modo demo local

Si Firebase no esta configurado, la app muestra modo demo local para desarrollo.

En produccion, el boton de demo se oculta cuando Firebase esta configurado.
