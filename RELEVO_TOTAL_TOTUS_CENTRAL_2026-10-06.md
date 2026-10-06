# RELEVO TOTAL · TOTUS CENTRAL / TOTUS PRICING
**Fecha:** 2026-10-06

## 1. REGLA PRINCIPAL DE CONTINUIDAD
- Continuar sobre lo ya construido hasta dejarlo completo, probado y preparado para uso real.
- Producción `main` debe permanecer intacta hasta aprobación expresa.
- Todo desarrollo se realiza en `desarrollo-v6`.
- No pedir al usuario que haga de tester.
- No detener el trabajo cada pocos pasos para explicar avances.
- No mezclar funciones en pantallas gigantes.
- Interfaz atractiva, intuitiva, rápida, responsive y ordenada.
- Un solo login general para toda la aplicación.
- Pricing aislado como módulo propio.
- No integrar Prestashop/TPV: el usuario quiere introducir los datos manualmente.
- No hace falta IA para la lógica contable.
- No inventar datos históricos.

## 2. REPOSITORIO Y DESPLIEGUE
Repositorio: `hortimatic/totus-pricing-demo`

Producción:
- rama `main`
- web actual: `https://hortimatic.github.io/totus-pricing-demo/`
- NO promover cambios sin aprobación expresa.

Desarrollo:
- rama `desarrollo-v6`
- actualmente 75 commits por delante de `main`
- `main` sigue siendo la versión anterior.

Archivos principales:
- `index.html`
- `app-shell-v6.css`
- `gestion-v6.js`
- `gestion-v6.css`
- `gestion-v6-ext.js`
- `gestion-v6-ext.css`
- `facturacion-v7.js`
- `facturacion-v7.css`
- `fondo_original.png`
- `QA_FINAL_V6.md`
- `migrations/`
- `tests/`
- `.github/`

Conservar la imagen corporativa original.

## 3. BACKEND SUPABASE
Proyecto actual:
- nombre: `totus-pricing`
- project ref: `zwkpmjjuurgjygcrejiw`

Equipo:
- Diego Sequera — Admin / CO — `hortimatic@gmail.com`
- Davinia Hidalgo — Gerente — `davinia.hidalgo@gmail.com`
- Óscar Arminio — Encargado — `oskitarvitara69@gmail.com`

No usar secretos/service-role en navegador.

## 4. ESTRUCTURA FINAL DE NAVEGACIÓN
La navegación debe quedar por áreas principales:
1. Inicio
2. Pricing
3. Cajas
4. Gastos
5. Facturación
6. Documentos
7. Fiscalidad
8. Informes
9. Administración

Login: `TOTUS CENTRAL`, único para toda la aplicación.

Pricing queda aislado con:
- Escritorio
- Catálogo
- Consultas
- fichas
- proveedores
- competencia
- descuentos
- histórico
- notas
- variantes
- buscador propio.

Administración:
- Usuarios
- Configuración general
- Tiendas/cajas
- parámetros sensibles
- series.

## 5. PRICING · FUNCIONALIDAD EXISTENTE A RESPETAR
No degradar Pricing.

Fórmula principal:
- coste proveedor sin IVA/RE
- IVA 21 %
- RE 5,2 %
- coste real = coste neto × 1,262 + portes/otros
- venta final = PVP × (1 - descuento)
- ganancia bruta = venta final - coste real
- margen % = ganancia / venta final × 100

Impuesto especial de líquidos normalmente ya está en el coste proveedor: NO sumarlo otra vez.

Ejemplos:
- sales 0/10 mg: coste 3,20 €, PVP 5,70 €
- 20 mg: coste 3,70 €, PVP 6,30 €

Requisitos Pricing:
- consultas rápidas
- reabrir/editar/guardar
- convertir consulta a producto
- marca → familia → producto
- múltiples proveedores
- competencia completa
- descuentos 0–50 %
- break-even
- histórico
- variantes genéricas
- búsqueda global
- responsive
- coma/punto decimal
- no perder foco
- escaping
- Save / Save & Next.

## 6. ESTABLECIMIENTOS
Hortimatic:
- Caja Vape
- Caja Head

NewOldSmok:
- Caja Vape

No conectar Prestashop/TPV.

## 7. CAJAS
Registrar por fecha/tienda:
- apertura
- efectivo
- tarjeta
- Bizum
- online
- otras entradas
- salida efectivo
- gastos desde caja
- caja física final
- caja esperada
- diferencia
- notas
- usuario
- estado.

El cierre anterior ayuda a la apertura siguiente.

Permisos:
- Admin/Gerente pueden corregir según reglas.
- Encargado no modifica cierre cerrado.

Datos de Chat usados como referencia:
NewOldSmok:
- 29 sep: caja 141,41 / salida 200 / tarjeta 284
- 30 sep: caja 181,21 / salida 0 / tarjeta 333,31
- 1 oct: caja 84,66 / salida 200 / tarjeta 300,55
- 2 oct: caja 130,21 / salida 50 / tarjeta 321,45
- 3 oct: caja 191,21 / salida 0 / tarjeta 254,85

Hortimatic:
- 30 sep: vape 149,09 / head 127,21 / salida 150 / tarjeta 390,55
- 1 oct: vape 209,84 / head 151,41 / salida 50 / tarjeta 230,59
- 2 oct: vape 205,29 / head 151,41 / salida 200 / tarjeta 293,85
- 3 oct: vape 232,44 / head 151,41 / salida 50 / tarjeta 316,04

## 8. GASTOS
Categorías:
- mercancía
- RETA
- sueldos
- Seguridad Social empresa
- alquileres
- suministros
- gestoría/profesionales
- software
- infraestructura física
- infraestructura digital
- reparaciones
- transporte
- seguros
- bancos
- publicidad
- tasas
- otros.

Campos:
- proveedor
- NIF
- nº factura
- fecha
- tienda
- concepto
- método pago
- estado pago
- base
- IVA
- recargo
- retenciones
- modelo 111/115
- varias líneas
- inmovilizado/amortización
- documento adjunto.

### Gasto fiscal vs gasto interno
Muy importante:
- horas extra
- pagos de 300 € del almacén
pueden ser `Solo control interno`.

Efectos:
- cuentan en resultado real
- NO cuentan en fiscalidad
- NO van a gestoría
- sus documentos tampoco van al paquete gestor.

Categorías creadas:
- `INTERNAL_OVERTIME`
- `INTERNAL_WAREHOUSE`

Atajos:
- Almacén 300 €
- Horas extra

No inventar gastos no documentados.

## 9. DOCUMENTOS
Subida de:
- PDF
- JPG/PNG/WebP
- XLS/XLSX
- CSV

Guardar archivo + metadatos:
- fecha
- tienda
- tipo
- proveedor/cliente
- NIF
- nº factura
- categoría
- estado
- notas
- usuario
- relación con gasto/factura.

Estados:
- pendiente
- pagada
- revisada
- preparada gestor
- entregada gestor
- archivada.

Organización automática:
`AÑO / TRIMESTRE / MES / TIENDA / TIPO / PROVEEDOR-O-CLIENTE / archivo`

Buckets privados:
- `business-documents`
- `business-assets`

QA storage:
- subir
- descargar
- comparar bytes
- borrar

Debe existir contador de espacio con avisos 70/85/95 %.

## 10. FACTURACIÓN
Referencia conceptual: experiencia tipo ERP/Holded, limpia y profesional.

Debe incluir:
- factura normal
- rectificativa
- factura Totus
- factura creada fuera
- numeración anual
- series por tienda/año
- bloqueo tras emisión
- marcar cobrada
- PDF.

Proformas:
- crear
- editar en borrador
- estados
- convertir a factura.

Plantillas:
- Moderna
- Minimal
- Clásica
- duplicar
- subir logo
- mostrar/ocultar logo
- posición/ancho
- colores
- título factura
- título proforma
- cabecera
- pie
- condiciones
- datos bancarios
- notas
- predeterminada factura
- predeterminada proforma.

Al emitir:
- correlativo
- snapshot diseño
- hash
- impedir reescritura de datos esenciales.

Permisos:
- Admin/Gerente: crear/editar/emitir/convertir/cobrar.
- Encargado: consulta.
- Series: Admin.

## 11. DATOS EMPRESA
Cargados:
- SEQUERA BAREA DIEGO
- NIF 03134012D
- CL VALLADOLID 2, 19200 AZUQUECA DE HENARES, GUADALAJARA
- hortimatic@gmail.com

No modificar sin confirmación.

## 12. FISCALIDAD
Usuario:
- autónomo
- Recargo de Equivalencia
- RE 5,2 %
- IVA normal 21 %

Objetivos:
- contador trimestre
- ingresos
- gastos fiscales
- gastos internos separados
- beneficio fiscal
- beneficio real
- previsión IRPF
- 111/115
- pagos
- reserva recomendada
- simulación de gasto
- RETA/tramo.

No tratar IVA como régimen general cobrado-soportado.

La app es previsión, no sustituto del gestor.

RETA 2026 cargado por tramos y configurable por año.

## 13. HISTÓRICO 2026
Fuentes facilitadas:
1. documentos del gestor
2. Excel diarios de ambas tiendas
3. capturas de Google Chat.

Tablas de trazabilidad:
- `ops_import_batches`
- `ops_legacy_daily_rows`
- `ops_gestor_source_rows`
- `ops_gestor_quarter_summary`
- `ops_fiscal_reference_periods`
- `ops_historical_income_periods`
- `ops_reconciliation_notes`

Incidencias:
- T1 tiene una línea ambigua de 21 €; se eliminó solo el gasto derivado erróneo, conservando la fuente.
- El informe Enero-Marzo incluye una línea 01/04/2026 de 74,90 €.
- Totus conserva la fuente y explica el descuadre.
- T2 llegó a cuadrar exactamente.

## 14. INFORMES Y DESCARGAS
Por:
- fecha
- día
- mes
- trimestre
- año
- tienda
- proveedor
- categoría
- documentos
- facturas.

Formatos:
- XLSX
- CSV
- PDF
- ZIP.

Paquete gestor:
1. `01_INGRESOS`
2. `02_GASTOS`
3. `03_DIARIOS`
4. `04_RESUMEN`
5. `05_DOCUMENTOS`

Documentos:
año → trimestre → mes → tienda → tipo → proveedor/cliente.

También:
- diarios por tienda
- libro global Totus
- informe fiscal PDF.

## 15. UX
- mantener estética Totus
- fondo corporativo
- navegación clara
- módulos separados
- acciones principales visibles
- avanzado solo cuando aporta
- responsive
- ayudas/tooltips
- sin ruido visual.

## 16. PERMISOS
Admin Diego:
- acceso total
- configuración
- series
- usuarios
- facturación
- correcciones.

Gerente Davinia:
- operativa
- gastos
- cierres
- facturación
- plantillas
- correcciones permitidas.

Encargado Óscar:
- consulta/operativa
- no modificar cierre cerrado
- facturación consulta
- no configuración sensible.

RLS probado por roles.

## 17. QA DOCUMENTADO
Archivo: `QA_FINAL_V6.md`

Incluye:
- navegación
- login único
- factura normal
- rectificativa
- proforma
- proforma→factura
- numeración
- bloqueo
- factura externa
- plantillas
- logo/colores
- snapshot/hash
- PDF
- cajas
- gastos
- informes
- storage
- RLS
- integridad DB
- Playwright/GitHub Actions
- responsive.

Workflow: `Totus Central QA`.

Las simulaciones SQL deben usar ROLLBACK cuando proceda.

## 18. AVISO DE SEGURIDAD
Pendiente:
- Leaked Password Protection de Supabase Auth estaba desactivado.

No afirmar seguridad cerrada mientras siga pendiente.

## 19. ESTADO TÉCNICO ACTUAL
- `desarrollo-v6` está 75 commits por delante de `main`.
- `main` sigue siendo producción anterior.
- Hay 26 tablas `ops_*` actuales.
- La implementación ha evolucionado: no asumir que tablas antiguas sigan existiendo.
- Verificar esquema actual antes de tocar SQL.

Revisar primero:
1. `QA_FINAL_V6.md`
2. `index.html`
3. `gestion-v6.js`
4. `gestion-v6-ext.js`
5. `facturacion-v7.js`
6. `app-shell-v6.css`
7. `migrations/`
8. `tests/`

## 20. CONTINUIDAD PARA NUEVO CHAT
1. Leer este relevo.
2. Leer `QA_FINAL_V6.md`.
3. Verificar HEAD de `desarrollo-v6`.
4. Inspeccionar Supabase actual.
5. No tocar `main`.
6. Repetir QA completo UI/DB/RLS/storage/informes.
7. Confirmar separación de módulos tras `gestion-v6-ext.js`.
8. Verificar handlers.
9. Probar factura normal, externa, rectificativa y proforma→factura.
10. Probar logo/plantillas/PDF.
11. Probar documentos y ZIP.
12. Probar paquete gestor.
13. Probar gastos internos fuera de fiscalidad.
14. Probar histórico 2026 y reconciliaciones.
15. Probar responsive.
16. Corregir fallos sin pedir al usuario que haga de tester.
17. Solo después presentar desarrollo para revisión visual.
18. No promover a `main` sin aprobación.

Intención del usuario:
“Termina la construcción, llévalo hasta el final y prueba hasta el último rincón. Yo soy usuario, no tester.”

## 21. NO HACER
- no crear otra herramienta paralela
- no reiniciar desde cero
- no conectar Prestashop/TPV
- no mezclar módulos
- no sumar impuesto especial otra vez
- no meter gastos internos en gestoría
- no inventar histórico
- no modificar `main`
- no pedir contraseñas
- no afirmar pruebas no realizadas
- no detenerse para pedir permiso sobre decisiones ya fijadas.

## 22. RESULTADO FINAL
Totus Central debe sustituir:
- Excel diarios
- Google Chat de cierres
- carpetas dispersas
- preparación manual para gestoría
- cálculo manual trimestre
- control manual de numeración
- dispersión entre herramientas.

Con:
- login general
- módulos separados
- datos centralizados
- documentos
- fiscalidad
- facturación
- informes
- histórico
- roles
- descargas gestoría
- Pricing intacto.

**No promover `desarrollo-v6` a producción sin aprobación expresa.**