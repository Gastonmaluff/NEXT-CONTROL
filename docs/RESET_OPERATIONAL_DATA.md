# Reset operativo seguro

Esta herramienta prepara NEXT CONTROL para una entrega limpia: conserva usuarios, roles, permisos, branding y configuracion tecnica, pero elimina datos operativos de prueba.

## Que conserva

- Firebase Authentication.
- Documentos `users/{uid}` con roles, permisos y estado.
- Colecciones de configuracion como `roles`, `permissions`, `configuracion`, `settings`, `empresa`, `branding`, `system` y `systemConfig`.
- Reglas, indices, variables de entorno, GitHub Pages y recursos institucionales.
- Logos o branding guardados fuera de los prefijos operativos de Storage.

## Que limpia

El script inventaria y limpia colecciones operativas conocidas:

- `obras`
- `rubrosAvance`
- `reportesAvance`
- `materialesPendientes`
- `actividadesAvance`
- `movimientosFinancieros`
- `cheques`
- `clientes`
- `proveedores`
- `oportunidades`
- `cobros`
- `actividades`
- `cuadrillas`
- `tareasInstalacion`
- `tareas`
- `jornadasCampo`
- `asignacionesCampo`
- `produccionEventos`
- `instalacionEventos`

Tambien limpia colecciones operativas futuras si existen: `presupuestos`, `inventario`, `reportes`, `notificaciones`, `produccionEtapas`, `registrosInstalacion`, `jornadasInstalacion`, `materiales`, `logsOperativos`, `resumenes` y `dashboardSummaries`.

En Firebase Storage elimina solamente archivos bajo prefijos operativos, actualmente:

- `obras/`

## Credenciales

El script usa Firebase Admin SDK. No subas service accounts al repositorio.

Opciones soportadas:

```bash
GOOGLE_APPLICATION_CREDENTIALS=C:\ruta\service-account.json
FIREBASE_PROJECT_ID=next-control-bb95f
```

Tambien se puede usar:

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=C:\ruta\service-account.json
```

o `FIREBASE_SERVICE_ACCOUNT_JSON` con el JSON completo o en base64.

Por seguridad, Application Default Credentials no se usan de forma implicita. Si queres usarlas, agrega:

```bash
RESET_ALLOW_APPLICATION_DEFAULT=true
```

## Dry-run

Simula el reset, crea inventario y backup, pero no borra nada:

```bash
npm run reset:data:dry-run
```

El backup queda en:

```text
backups/operational-reset-YYYY-MM-DDTHH-MM-SS/
```

Archivos generados:

- `inventory.json`
- `backup.json`
- `README.txt`

## Reset real

Ejecuta el reset real:

```bash
npm run reset:data
```

Antes de borrar pide escribir exactamente:

```text
RESET NEXT CONTROL
```

Sin esa confirmacion no elimina nada.

## Proteccion de proyecto

El script valida que el proyecto objetivo coincida con `VITE_FIREBASE_PROJECT_ID` o `RESET_EXPECTED_FIREBASE_PROJECT_ID`. Si no coincide, se detiene.

Para forzar el proyecto esperado:

```bash
RESET_EXPECTED_FIREBASE_PROJECT_ID=next-control-bb95f npm run reset:data:dry-run
```

## Despues del reset

Verificar:

- Dashboard en cero.
- Avance de obras sin obras.
- Finanzas sin movimientos.
- Clientes y proveedores vacios.
- Cheques sin registros.
- Tareas, jornadas, asignaciones, produccion e instalaciones vacias.
- Usuarios y permisos intactos.

Luego ejecutar:

```bash
npm run build
```
