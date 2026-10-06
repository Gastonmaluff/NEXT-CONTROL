# Vista Interactiva — RIJAR

## Alcance y acceso

Maqueta industrial navegable con accesos a las pantallas existentes del sistema. La escena no consulta ni modifica datos operativos: sus personas, cargas y vehículos son ambientales. Al abrir un módulo, se navega a su pantalla real. El usuario autorizó su publicación el 6 de octubre de 2026. Sin migraciones ni cambios de infraestructura, entorno, autenticación o reglas de permisos.

La ruta y el ítem del sidebar están disponibles **en desarrollo y producción**, justo entre Reportes y Configuración. Reutilizan el permiso existente de **Control**; los enlaces respetan el permiso del módulo de destino. La vista y el renderer se cargan bajo demanda en chunks separados, no al iniciar sesión. Las iteraciones 1–9 documentadas más abajo se realizaron originalmente como experimento exclusivo de desarrollo; la publicación posterior cambia esa limitación.

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Abrir [Vista Interactiva](http://127.0.0.1:5175/NEXT-CONTROL/vista-interactiva). Iniciar sesión con un perfil que pueda acceder a Control, o usar el botón existente **Entrar en modo demo** y después **Vista Interactiva** en el sidebar. El puerto estricto evita caer silenciosamente en otro proyecto. Si está ocupado, detener únicamente el servidor de este proyecto o elegir otro puerto e indicar ese mismo puerto en el enlace.

`npm run preview` también incluye la vista después del build. Producción conserva el login real y sus permisos; no se habilitó el modo demo al publicarla.

Publicación: el workflow `.github/workflows/deploy.yml` compila y despliega en GitHub Pages cuando se actualiza `main`. El antiguo script `npm run deploy` apunta a `gh-pages`, pero no es el flujo vigente de Pages (configurado como `workflow`). Sitio: [NEXT CONTROL](https://gastonmaluff.github.io/NEXT-CONTROL/).

## Experiencia implementada

- Tinglado completo con cubierta inclinada, estructura metálica, paredes, acceso de personas, dos vehículos logísticos y cuatro vehículos civiles sobre la calle frontal.
- Finanzas de obras en el frente derecho; Avance de obras detrás y oficina de Richard / Control al lado.
- Taller detrás de oficinas con corte de perfiles, mesas, ventanas en armado, caballetes, herramientas y operarios estilizados.
- Materia prima a la izquierda del Taller; perfiles, vidrio y cajas de insumos.
- Racks comerciales abiertos en el lateral izquierdo y el fondo: WPC, SPC, ripados, cielo raso WPC, vidrio y aluminio. Hay pasillos y materiales diferenciados, no habitaciones por producto.
- Doce sectores seleccionables más el camión azul de materia prima. Hover con etiqueta/cursor/contorno discreto; click/tap con selección y panel de acceso al módulo. Los sectores enfocan suavemente la cámara; el camión abre su panel sin perseguir al vehículo. No se muestran métricas ni actividad ficticias.
- Techo continuamente interpolado por zoom. Lejos: 100%; intermedio: parcialmente transparente; cerca: 0%. Las paredes exteriores también se atenúan. La cubierta no intercepta la selección de sectores.
- Cámara ortográfica, zoom/pan/rotación limitados y retorno animado a vista general.
- Actividad coordinada en camión, descarga/carga, abastecimiento, oficinas y máquina de corte, pausable; preferencias de movimiento reducido desactivan la actividad inicial y la entrada animada del panel.
- Lista de accesos en el panel lateral, operable por teclado. Se retiraron los botones superpuestos «Vista general» y «Explorar sectores». Fallback si no se puede crear WebGL2, si se pierde el contexto o si falla la escena; se conservan los enlaces al sistema.
- Pantalla completa nativa con alternativa CSS cuando el navegador no la permite. Escape, foco y scroll se restauran al salir o abrir un módulo.
- En móvil se apilan escena y panel; en pantalla completa el panel seleccionado aparece compacto sobre el borde inferior. Los controles táctiles tienen al menos 44px y el canvas admite pellizco y desplazamiento.

## Controles

| Acción | Control |
| --- | --- |
| Seleccionar | Click/tap sobre un sector, el camión azul o un acceso del panel lateral |
| Zoom | Rueda, pellizco con dos dedos, botones + / − |
| Desplazar | Arrastrar con botón izquierdo o un dedo |
| Rotar | Arrastrar con botón derecho; ángulos limitados |
| Volver al predio | Cerrar el sector o Escape fuera de pantalla completa |
| Pantalla completa | Icono de expandir/contraer; Escape para salir |
| Actividad industrial y civil | «Pausar actividad» / «Activar actividad» |
| Abrir módulo real | Botón explícito del panel; seleccionar un sector no navega |

## Enlaces identificados, sin cambiar sus módulos

| Sector | Ruta existente | Observación |
| --- | --- | --- |
| Oficina de Richard | `/control` | Control del dueño |
| Oficina frontal | `/finanzas-obras` | Finanzas de obras |
| Segunda oficina | `/avance-obras` | Avance de obras |
| Taller | `/produccion` | Conserva la resolución por rol del sistema |
| Materia prima y racks | `/inventario` | Actualmente pantalla reservada, no inventario funcional |
| Entrada / expedición | `/instalaciones` | Acceso relacionado disponible; no existe un módulo de expedición independiente |
| Camión azul de materia prima | `/proveedores` | Selección del vehículo y botón «Abrir Proveedores» |

## Archivos

Nuevo directorio `src/experimental/facility/`:

| Archivo | Responsabilidad |
| --- | --- |
| `InteractiveFacilityView.tsx` | Estado de selección, comandos, carga lazy y límites de error |
| `FacilityScene.tsx` | Canvas, iluminación, recursos, pérdida de contexto y frames ambientales |
| `FacilityBuilding.tsx` | Predio, tinglado, estructura, accesos y pasillos |
| `Neighborhood.tsx` / `neighborhoodConfig.ts` | Propiedades linderas sobre la calle del depósito, siempre opacas y no seleccionables |
| `FacilityRoof.tsx` | Cubierta y transición de opacidad |
| `OfficeBlock.tsx` | Geometría de las tres oficinas |
| `OfficeDoor.tsx` | Paredes con vano real, hojas, marcos, manijas y apertura coordinada |
| `ProductionWorkshop.tsx` | Mesas, aberturas, máquina de corte animada |
| `RawMaterialsWarehouse.tsx` | Zona de abastecimiento |
| `StockRacks.tsx` | Racks abiertos y familias comerciales |
| `Materials.tsx` | Paquetes instanciados, perfiles, ripados y caballetes de vidrio |
| `Workers.tsx`, `Vehicles.tsx` | Figuras operativas procedurales |
| `CivilTraffic.tsx`, `civilTrafficConfig.ts` | Vehículos civiles y calendario de circulación por carriles |
| `Person.tsx` | Figura compartida, pasos, manos, trabajo sentado y gestos |
| `ActivityActor.tsx`, `ActivityCargo.tsx` | Personas sobre recorridos, cargas y carros |
| `ActivityClock.tsx` | Reloj común; pausa total, pestaña oculta y orden de animación |
| `RichardEasterEgg.tsx`, `SecretNeighborWindow.tsx` | Descanso manual de Richard mediante tres clics/toques en la ventana lateral izquierda |
| `ReceivingBay.tsx` | Recepción, señalización y mercadería recibida |
| `activityConfig.ts`, `activityMotion.ts` | Coreografía central y funciones puras de interpolación |
| `CameraController.tsx` | OrbitControls, límites y viajes suaves |
| `AreaSelection.tsx` | Interacciones, contornos y etiquetas |
| `FacilityHUD.tsx` | Zoom, actividad y pantalla completa |
| `FacilityInfoPanel.tsx` | Selección contextual y enlaces explícitos según permisos |
| `useFacilityFullscreen.ts` | Pantalla completa, alternativa CSS, foco, Escape y scroll |
| `Primitives.tsx` | Geometrías/materiales compartidos y elementos reutilizables |
| `facilityConfig.ts` | Dimensiones, sectores, activos, cámara, paleta y curva del techo |
| `facilityAreas.ts` | Metadatos de destinos existentes, sin cifras ficticias |
| `types.ts` | Contratos del experimento |
| `fiber-jsx.d.ts` | Puente JSX mínimo para Fiber 8 con los tipos React 19 ya presentes |
| `facility.css` | Estilos locales y responsive, sin cambios al CSS global |

Otros archivos nuevos: `scripts/facility.test.mjs` y este documento.

Archivos existentes modificados exclusivamente para acceso/dependencias: `src/App.tsx`, `src/data/navigation.ts`, `package.json` y `package-lock.json`. No se modificaron páginas de negocio.

## Dependencias y rendimiento

Agregadas con versiones fijas: `three@0.170.0`, `@react-three/fiber@8.18.0`, `@react-three/drei@9.122.0`, `@types/three@0.170.0` (desarrollo). Fiber 8 corresponde al runtime React 18 existente; no se actualizó React a 19. [Compatibilidad oficial de React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/installation).

La página y el renderer se cargan mediante `React.lazy`. El Canvas usa render bajo demanda, recursos compartidos, instancing en materiales repetidos, geometrías de baja complejidad, contenido estático memoizado, DPR limitado a 1.5 y ninguna sombra dinámica/modelo externo. La actividad ambiental solicita como máximo 30 frames/s y no solicita frames con la pestaña oculta. Al pausarla, solo se renderizan interacciones/transiciones. No hay simulación física, HDRI, fuentes 3D descargadas ni modelos GLTF.

Se siguieron las pautas de React sobre carga condicional y valores transitorios en refs: la interpolación no actualiza estado React por frame. La telemetría HTML se reporta a baja frecuencia y solo cambia el estado si sus valores cambian. Se siguió el flujo Playwright y la revisión de recorrido completo para verificar la escena y el fallback.

## Validación realizada

```powershell
npx tsc --noEmit
npm run test:facility
npm run build
```

- Typecheck: correcto.
- Tests actuales: **30/30**. Cubren techo/layout, continuidad de recorridos/ciclos, pausa, sincronización logística, traslado de perfiles, puertas, pasos por el acceso, salida de vehículos, conservación de ventanas, embarque, trayectos alrededor de equipos, descansos/humo de Richard, ordenamiento y carros, parcelas vecinas, destinos/permisos, circulación civil, Easter egg y posición del acceso publicado justo arriba de Configuración.
- No había scripts ni configuración de lint ni suites de tests del proyecto para ejecutar. No se agregó un linter ni se cambiaron reglas globales.
- Build de producción: correcto. La ruta publicada conserva ModuleGuard de Control. Chunks separados: vista 14,75 kB (gzip 5,16), renderer 901,49 kB (gzip 244,73). El chunk principal pasa de 2.002,64 a 2.004,98 kB; el renderer no se descarga al abrir el login (comprobado en preview).
- Playwright en Chromium, modo demo existente, 1600×1000: acceso desde sidebar, 12 paneles y rutas, selección directa de WPC desde el rack, hover, retorno y opacidad por zoom. Secuencia observada: **100% → 85% → 34% → 0%**.
- Navegación actual comprobada hacia Producción, Control, Avance de obras, Finanzas de obras, Inventario y Proveedores; la revisión inicial de Ventas/Clientes queda reemplazada por estos destinos.
- Chromium con viewport móvil 390×844: panel apilado, sin overflow horizontal, pinch emulado por CDP (100% → 4%) y tap real emulado sobre WPC con panel correcto. Esto no reemplaza una prueba en un teléfono físico.
- Fallback WebGL: probado en la primera iteración simulando pérdida de contexto y deshabilitando creación de WebGL; los accesos HTML no dependen del canvas.
- Sesión normal de la maqueta: **0 errores y 0 warnings de consola**. La pérdida de contexto inducida genera los avisos esperados del renderer en su pestaña de prueba.
- Capturas en `output/playwright/facility/`: overview, taller, SPC, cutaway intermedio, móvil, pinch/tap y fallback.

Warnings separados:

- **Preexistente:** warning de Vite por chunk principal >500kB. Se reprodujo compilando las versiones originales de `App.tsx` y navegación desde HEAD, sin cambiar esos archivos: 2.002,63kB antes y 2.002,64kB después; gzip 541,62kB en ambos. No procede del motor 3D, excluido del build.
- **Preexistentes:** `npm audit` reporta 31 vulnerabilidades (11 moderadas, 19 altas, 1 crítica). Todas corresponden a nodos/versions ya presentes en el lock original; ninguna versión existente fue cambiada ni se eliminó un paquete previo. No se aplicó `audit fix` por estar fuera del alcance.
- **Nuevo aviso de instalación:** deprecación de `three-mesh-bvh@0.7.8`, dependencia transitiva de drei 9. El prototipo no usa BVH. Se deja documentada para revisar junto con una futura actualización coordinada del renderer/React, sin modificar dependencias compartidas ahora.

## Límites actuales y siguiente etapa

- Layout aproximado, no levantamiento arquitectónico. Ajustar `facilityConfig.ts` cuando existan medidas y posiciones verificadas.
- Se retiró la capa de indicadores ficticios. `facilityAreas.ts` contiene únicamente nombres, descripciones y destinos. Los datos operativos se consultan en las pantallas existentes, no dentro de la maqueta.
- Entrada usa Instalaciones: es una equivalencia conceptual de navegación, no un módulo de expedición nuevo.
- Inventario no está implementado en el sistema actual; el panel lo informa.
- Se validó Chromium con emulación móvil; pendientes Safari/Firefox, teléfonos físicos y mediciones de FPS/memoria en el hardware de la empresa.
- No hay movimientos logísticos reales, GPS, persistencia de cámara, sincronización con sistemas externos, edición espacial ni producción real. La animación es una coreografía ambiental, no simulación física ni registro operativo.
- Una integración futura necesitará autorización separada, contratos API, reglas de acceso y pruebas con datos reales. El prototipo no presupone esa autorización.

Las primeras nueve iteraciones no se desplegaron; el usuario autorizó la publicación después de completarlas.

## Segunda iteración — puertas y actividad cotidiana

Sin dependencias adicionales ni cambios a pantallas de negocio:

- Las tres oficinas tienen puerta con apertura física en la pared, marco y manija. Administración y Ventas abren las hojas antes del paso de visitantes; Dirección conserva una hoja entreabierta.
- Cinco personas trabajan en los escritorios, con manos/cabeza en movimiento y gestos de conversación. Dos visitantes entran, se acercan a sus compañeros y regresan por las puertas. No se agregó audio.
- El camión recorre el acceso delantero en un ciclo continuo de 76 segundos. Ingresa, estaciona, abre el portón trasero, descarga vidrio y cajas, recibe paneles, cierra el portón y sale. La furgoneta permanece estacionada.
- Tres operarios con carros realizan la descarga de vidrio hacia Materia Prima, descarga de mercadería hacia Stock y carga de paneles hacia el camión. Los materiales pasan de la caja del camión al carro y después al punto de recepción, en momentos coordinados.
- Un operario va al rack de perfiles de Materia Prima, toma perfiles, cruza el pasillo y los lleva al puesto de corte del Taller; regresa por más material. Ciclo de 38 segundos.
- Corte y armado mantienen actividad de trabajo. Los cuerpos comparten geometrías y materiales; las cargas que no usa un actor no se construyen.
- Un único reloj controla toda la coreografía. Orden: reloj → posiciones/poses → mallas. «Pausar actividad» congela camión, ruedas, puertas, manos, piernas, cargas y máquina incluso al mover la cámara. React no vuelve a renderizar por cada movimiento.
- El reloj no avanza con la pestaña oculta ni recupera de golpe los segundos suspendidos. Las rutas son cerradas y continuas, con velocidades suavizadas; no hay teleport de actores al reiniciar el ciclo.
- Las cantidades mock no cambian por las animaciones. Los lotes visuales se reciclan al comenzar el próximo ciclo; no representan inventario ni despachos reales.

Validaciones de esta iteración: typecheck, build, 11 tests, revisión visual de puertas/personas, inspección del estado renderizado del camión/cargas/operario y comparación de todas las transformaciones de actores antes/después de hacer zoom estando pausados. La pausa dejó **cero actores modificados** y la reanudación volvió a moverlos. Los avisos del bundle grande preexistente permanecen sin incorporar el motor 3D al build productivo.

## Tercera iteración — recepción, retiro de ventanas y Richard

Esta versión reemplaza la coreografía logística de la segunda iteración; continúa siendo exclusivamente ilustrativa y local, sin nuevas dependencias ni escrituras de datos reales.

- Se retiró el cartel flotante «RIJAR / INDUSTRIA · DEPÓSITO» y la figura inmóvil de recepción. Se conserva la etiqueta del acceso.
- Recepción: ciclo de 112 segundos. El camión llega y estaciona antes de que salgan los dos trabajadores con carros desde el interior. Descargan vidrio y cajas, los llevan a Materia Prima/Stock y acomodan materiales allí. El camión sale vacío por la calle, desaparece fuera del predio y vuelve en otro ciclo. El retorno atraviesa únicamente coordenadas exteriores, no el edificio.
- Expedición: el camioncito blanco ahora tiene caja abierta, bastidor para ventanas, conductor y pasajeros. Ciclo independiente de 156 segundos: llega, bajan dos trabajadores, caminan por el pasillo central y transversal trasero hasta el fondo del Taller, retiran dos ventanas cada uno, regresan y cargan cuatro en total. Luego caminan hacia la cabina, suben y salen con el vehículo, que desaparece antes de volver.
- `FinishedWindows.tsx` muestra cuatro ventanas que se acumulan gradualmente en el fondo del Taller. Un único calendario enlaza existencias visuales, cargas en manos y ventanas del vehículo. Desde que termina el lote, la suma permanece en cuatro hasta que sale: no se duplica la carga al transferirla.
- Las paredes opacas de las tres oficinas se redujeron a 1,1 m para mostrar escritorios y personas desde la cámara de corte. Se mantienen las puertas y cristales existentes.
- Richard recorre acceso, pasillo del Taller, pasillo trasero y stock en un circuito de 105 segundos. Figura sin casco, cabello rubio, hombros/torso/brazos algo más robustos; geometría procedural coherente con las demás personas.
- Animación mediante refs y reloj común; no se actualiza estado React por cuadro. «Pausar actividad» sigue congelando todas las figuras y cargas incluso al cambiar la cámara.

Verificación: TypeScript y build; 16 tests; inspección de 19 momentos de los recorridos en la escena renderizada avanzando el reloj de forma controlada (incluye segundo ciclo, salida fuera de vista, acumulación/carga y embarque); capturas de oficinas, camión cargado/Richard y móvil 390×844. La prueba de zoom con pausa no modificó ninguna transformación de los actores. Sin overflow horizontal en móvil. Emulación Chromium, no teléfono físico. Las animaciones no alteran las métricas mock ni representan stock, despachos o personas reales.

## Cuarta iteración — descanso de Richard en la esquina del frente

- Alterna dos vueltas del circuito de 105 segundos y un descanso, luego tres vueltas y otro descanso. El calendario compuesto dura 701 segundos y vuelve a empezar sin saltos ni timestamps duplicados.
- Sale por el acceso, camina por fuera de la fachada y se ubica en `[-17.25, 0, 20.6]`, junto a la esquina frontal izquierda indicada en la referencia. Se apoya hacia la pared, fuma durante 24 segundos y regresa al recorrido. Primer gesto de fumar a los 240 segundos de actividad; segundo a los 643. El descanso completo, incluyendo traslados, dura 88 segundos.
- Cigarrillo procedural con filtro y brasa, mano que sube/baja hacia la boca. `CigaretteSmoke.tsx` reutiliza diez partículas: suben, crecen y pierden opacidad. Materiales privados actualizados en sitio y liberados al desmontar; ninguna nueva imagen, librería o escritura de datos de negocio.
- El efecto respeta el reloj común y las preferencias de movimiento existentes. Oculto fuera de la pose de fumar. No cambia el ritmo de camiones, otros trabajadores ni oficinas.
- Validación: typecheck/build y 18 tests; inspección renderizada del primer y segundo descanso y vuelta siguiente, captura `output/playwright/facility/richard-break.png`; comparación con zoom pausado incluyendo opacidades/escala del humo: todo congelado, con movimiento al reanudar. El motor 3D sigue excluido del build productivo.

## Quinta iteración — carros estacionados y trabajo de ordenamiento

- Los dos descargadores ahora dejan su carro en una posición física independiente al terminar la entrega. El carro permanece visible, vacío y quieto mientras el operario se mueve a pie; no se oculta ni desaparece al soltarlo.
- Acomodan materiales en dos pasadas: el operario de vidrio lleva hojas individuales desde recepción a un pequeño caballete; el de mercadería toma cajas pequeñas y las acerca al rack de WPC. Son materiales ambientales reutilizados, no un conteo de inventario. No cambian las métricas, cantidades reales ni el calendario de despacho de las cuatro ventanas.
- Antes del próximo ciclo regresan al punto de estacionamiento. Retoman el carro a los 18/22 segundos del nuevo ciclo, después de que el camión llega a los 16. Los puntos de enganche/desenganche coinciden con la posición real del carro; las cargas pasan de altura de carro a altura de manos al ordenar.
- Se separaron los puntos de recogida detrás del camión y la aproximación del operario de cajas. Prueba puntual: separación entre cuerpos mayor a 1,5 m durante 30–39 s. Esto **no** es un sistema general de colisiones ni certifica la separación entre carros/cargas o todos los cruces del predio.
- Validación: typecheck/build y 20 tests; inspección de 11 momentos renderizados incluyendo segundo ciclo, capturas `sorting-glass.png` / `sorting-boxes.png`, pausa con zoom de personas **y carros** sin transformaciones modificadas.

### Auditoría para conversar sobre la siguiente mejora (sin implementar todavía)

- `sampleMotion` interpola segmentos rectos con smoothstep: velocidad cero en cada waypoint, dirección objetivo cambia en la esquina y el giro visual se amortigua después. El ritmo de piernas usa tiempo global, no distancia recorrida.
- Cada ruta se evalúa de forma independiente: no hay consulta de vecinos, prioridad, reserva de cruces ni cesión de paso. Un muestreo previo a separar el muelle (0–701 s, paso 0,2 s, centros de operarios dinámicos visibles) detectó superposición exacta entre descargadores y cercanías de 0,06 m entre cargadores de ventanas / 0,10 m entre un cargador y Richard. Es diagnóstico de centros, no física ni cobertura completa de todos los ciclos.
- Propuesta para la próxima etapa: curvas restringidas a pasillos libres; velocidades más parejas y giro anticipado; pasos ligados a distancia; radios distintos para persona/carro/carga y cruces con prioridades, breve espera o desplazamiento lateral. Mantener el reloj y handoffs coordinados para que una espera no duplique material ni haga salir el camión antes de tiempo.
- No se añadieron curvas ni evitación general en esta iteración; se mantiene explícito como trabajo pendiente de conversación.

## Sexta iteración — vecinos decorativos

- Seis construcciones cerradas: dos a la izquierda, dos a la derecha y dos detrás. Paleta discreta, alturas inferiores al depósito, portones y ventanas opacas de fachada. Sin interiores, rótulos, métricas ni sectores nuevos.
- Todas las mallas de `Neighborhood.tsx` utilizan materiales opacos (opacity 1, transparent false), sin callbacks de animación/cámara. No comparten el material privado de `FacilityRoof`: al acercarse, solo se revela el depósito principal. Raycast desactivado en cada malla; no reciben selección ni hover.
- Parcelas fuera del lote principal, separadas entre sí y del corredor frontal de camiones. No se alteraron recorridos, ciclos, inventario ni datos de negocio. El encuadre general se amplió a 102×84 unidades ilustrativas para incluir el entorno; se conservan los límites relativos de zoom y el foco por sector.
- Subárbol React memoizado y geometrías/materiales compartidos. Un prisma triangular reutilizable cierra los frontones de los cuatro techos inclinados y se libera con los demás recursos de la escena.
- Verificación: TypeScript/build y 21 tests. En Chromium renderizado: seis vecinos, 104 mallas de edificios más suelo, todos opacos en vista general, foco y zoom máximo; cero intersecciones de raycast con cada vecino. Techo principal cerrado al volver a vista general y opacidad prácticamente cero al enfocar Materia Prima. Capturas `neighbors-overview.png`, `neighbors-cutaway.png` y `neighbors-mobile.png` en `output/playwright/facility/`. Móvil emulado 390×844 sin overflow horizontal. Sin errores de consola después de recargar la escena completa tras la actualización de recursos compartidos por HMR.
- La maqueta continúa excluida del bundle productivo. Sin dependencias adicionales ni deploy.

## Séptima iteración — corrección de la cuadra y medianeras

Reemplaza la distribución de vecinos de la sexta iteración, siguiendo la corrección del usuario sobre la calle real:

- Se retiró la disposición de dos construcciones aisladas en profundidad a cada lado. Ahora hay una propiedad profunda por costado, con fachada alineada al frente del depósito y portón hacia la misma calle (z=31). Los lotes llegan hasta el borde de esa calle (z=27) y comparten límite lateral con el lote principal (x=±24), sin calles laterales ni pasillos públicos inventados.
- El pavimento frontal se prolonga en una única calle continua, manteniendo las coordenadas de los camiones. Los vecinos tienen pequeñas veredas/entradas y medianeras; ya no hay plataformas aisladas alrededor de cada edificio.
- Las dos propiedades de atrás son linderas al fondo (z=-25), sin calle interna. Se giraron sus construcciones para que hacia el depósito se vean las paredes traseras, no portones que desemboquen en nuestro patio.
- Cuatro edificios decorativos, cerrados y no seleccionables. Se mantienen materiales/geometrías compartidos y el subárbol memoizado, sin nuevos callbacks por cuadro. Sin cambios a logística, métricas, permisos o autenticación.
- Verificación de código: TypeScript/build y 22 tests. El nuevo test exige fachada común, lotes contiguos, contacto directo con la calle y ausencia de dos filas laterales. El bundle conserva el aviso de tamaño preexistente.
- Revisión visual de la distribución con `FacilityScene` montada de forma aislada mediante una respuesta temporal de Playwright (sin ruta ni archivo QA en el proyecto): `output/playwright/facility/neighbors-street-isolated.png`. La sesión normal estaba detenida en «Cargando NEXT CONTROL» tras recargar; no se modificó autenticación para resolverlo. Esta captura comprueba la geometría, no el flujo autenticado completo ni un teléfono físico.

## Octava iteración — tráfico civil, pantalla completa y accesos reales

- Cuatro vehículos civiles circulan en ambos sentidos por la calle frontal. Comparten reloj, pausa y preferencias de movimiento con la actividad industrial. Los pasos se programan fuera de las ventanas de giro de los camiones; esto no implementa una simulación física ni evitación general de colisiones entre personas.
- Se retiraron «Vista general» y «Explorar sectores» del canvas. Se conserva zoom, pausa, cierre de sector y una lista accesible de destinos en el panel lateral.
- Pantalla completa nativa y alternativa CSS para navegadores que rechazan la API. El modo ampliado administra Escape, Tab, foco y scroll; al abrir un módulo se abandona el modo y se restaura la página.
- Oficinas conectadas a Control / Avance de obras / Finanzas de obras; Taller a Producción; familias de stock a Inventario. Sin filtros inventados: Inventario sigue siendo la pantalla reservada del sistema y el panel lo advierte.
- Click/tap sobre el camión azul selecciona Proveedores. El botón explícito «Abrir Proveedores» navega a su ruta real, con el permiso existente del módulo.
- Eliminado `facilityMockData.ts`, que solo contenía datos ficticios de la maqueta. No se eliminó información de negocio ni se modificaron autenticación, permisos, dependencias o pantallas operativas.
- Validación: 25 tests y build correctos; ausencia del experimento en los bundles productivos. En la aplicación autenticada se comprobaron las seis rutas anteriores y la salida de pantalla completa al navegar. Selección real del camión con un click proyectado sobre su malla; no se llamó directamente al handler.
- Chromium: pantalla completa nativa en escritorio y alternativa CSS en móvil 390×844, sin overflow horizontal; Escape restaura el scroll. Consola de la última sesión: cero errores y cero warnings. No reemplaza pruebas en teléfonos físicos.
- Capturas en `output/playwright/facility/`: `navigation-traffic.png`, `fullscreen-workshop.png`, `truck-suppliers.png`, `navigation-mobile.png` y `fullscreen-mobile-fallback.png`.
- Se mantuvieron las pautas de React: subárboles memoizados, recursos compartidos y transformaciones mediante refs, sin estado React por frame. Sin deploy; la ruta sigue siendo exclusiva de desarrollo.

## Novena iteración — ventana secreta y descanso manual de Richard

- La pequeña ventana en la pared lateral del vecino izquierdo, frente al depósito, es la única excepción interactiva entre las propiedades decorativas. Tres clics/toques dentro de 1,8 segundos abren suavemente su hoja; uno/dos clics, gestos incompletos o arrastrar no activan el secreto. Los techos vecinos siguen opacos y el gesto no navega a un módulo.
- Richard interrumpe su recorrido desde su posición actual, sigue los segmentos de pasillo existentes hasta el acceso y realiza el descanso en la esquina frontal izquierda. Se reutilizan la pose, el cigarrillo y las diez partículas de humo. Regresa por esos mismos pasillos al punto interrumpido; no se teletransporta a la esquina ni vuelve a través de racks/oficinas.
- Solo su calendario se suspende durante el desvío. Camiones, mercadería, operarios y tráfico civil conservan su reloj original. Al regresar, Richard continúa su rutina de dos/tres vueltas y descansos automáticos de antes. Clics adicionales durante el desvío no crean colas ni lo reinician. Si ya está fumando automáticamente, solo se abre brevemente la ventana.
- La ventana se cierra al finalizar el desvío. Pausa, pestaña oculta y movimiento reducido mantienen congelado todo el nuevo proceso; si se activa mientras está pausado, se ejecutará al reanudar. Sin dependencias nuevas, cambios de autenticación, escrituras operativas ni deploy.
- Validación: TypeScript/build correctos y 29 tests. Revisión Playwright de la escena real montada aisladamente mediante una respuesta temporal de prueba, porque la sesión normal quedó en «Cargando NEXT CONTROL»; no se alteró el login para resolverlo. Prueba de puntero sobre la malla: dos clics dejan ángulo 0; tercero abre a 1,15 radianes. Richard llega a [-17.25, 0, 20.6], muestra cigarrillo y diez partículas con opacidad; pausa congela posición, hoja y humo; al reanudar termina y la hoja vuelve a 0.
- Triple toque emulado por CDP en Chromium 390×844 también abre la ventana. No reemplaza un teléfono físico ni verifica el acceso autenticado completo. Capturas: `output/playwright/facility/easter-egg-smoking.png` y `easter-egg-mobile.png`. Consola de la última escena: sin errores ni warnings. El experimento permanece excluido del bundle productivo; se conserva el aviso de tamaño preexistente.
