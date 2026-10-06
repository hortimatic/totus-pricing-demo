# TOTUS CENTRAL · QA DE DESARROLLO

Fecha: 2026-10-06
Rama probada: `desarrollo-v6`
Commit UI QA de referencia: `2feb390a56344d757c753a1e5837f4cabf055431`
HEAD documentado: `67546a4fd1e94352b74ab8f3cc414f711838ecb2`
Producción: `main` NO modificada.

## Navegación
- Inicio
- Pricing
- Cajas
- Gastos
- Facturación
- Documentos
- Fiscalidad
- Informes
- Administración
- Login único para toda la aplicación.
- Pricing conserva su navegación interna y su buscador propio.

## Facturación
Probado:
- factura ordinaria
- factura rectificativa
- proforma
- proforma -> factura
- numeración por series
- bloqueo de líneas tras emisión
- detección de número externo duplicado
- factura creada fuera + avance automático de serie
- plantillas
- logo / colores / títulos / textos / datos de pago
- snapshot de diseño al emitir
- hash de documento emitido
- PDF
- organización de documentos por año/trimestre/mes/tienda/tipo/cliente

## Cajas
Probado:
- Hortimatic: Caja vape + Caja head
- NewOldSmok: Caja vape
- fórmula efectivo: caja final + salidas + gastos de caja - apertura
- permisos sobre cierre cerrado
- gerente puede corregir; encargado no puede modificar un cierre cerrado

## Gastos
- gastos fiscales y gastos internos separados
- horas extra y almacén pueden quedar en control interno
- gastos internos fuera de cálculo fiscal y paquete de gestoría
- IVA / recargo / retenciones / varias líneas
- histórico 2026 importado desde fuentes facilitadas

## Informes
- XLSX de gastos con estructura de gestoría
- XLSX de ingresos con estructura de gestoría
- libros diarios por tienda
- libro global Totus
- PDF fiscal
- ZIP de documentos
- paquete gestor ordenado:
  01_INGRESOS
  02_GASTOS
  03_DIARIOS
  04_RESUMEN
  05_DOCUMENTOS

## Datos / integridad
Consulta de integridad con resultado 0 incidencias en:
- líneas huérfanas
- totales cabecera/líneas desajustados
- cierres duplicados
- referencias de importación duplicadas
- documentos emitidos sin número
- facturas emitidas sin hash
- documentos emitidos sin snapshot
- series retrasadas respecto al último número
- rutas de documentos duplicadas
- hashes documentales duplicados

Las pruebas transaccionales de QA se ejecutan con ROLLBACK y no dejan datos de prueba.

## Storage
Probado en ambos buckets privados:
- subir
- descargar
- comparar bytes
- eliminar
- business-documents
- business-assets

## Navegador
GitHub Actions / Playwright:
- workflow: Totus Central QA
- resultado del commit de referencia: SUCCESS
- módulos recorridos: Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes, Administración
- cálculo Pricing con coma decimal y conservación de foco
- cálculo de caja
- controles de gasto interno
- factura/proforma/rectificativa
- PDF
- subida/descarga documental simulada
- fiscalidad
- XLSX / PDF / ZIP
- configuración
- responsive móvil

## Seguridad
RLS probado por roles:
- Admin
- Gerente
- Encargado

Aviso externo pendiente de configuración del proyecto Supabase:
- Leaked Password Protection está desactivado en Auth.
No es un fallo del código de Totus; debe activarse desde la configuración de Auth antes de considerar cerrada la revisión de seguridad de producción.

## Endurecimiento de permisos de facturación · 2026-10-06

Se detectó y corrigió una discrepancia real entre el modelo de roles y RLS:
- `encargado` mantiene lectura/consulta de facturas, rectificativas y proformas
- creación, edición, emisión, cobro, rectificación y conversión quedan en `admin` / `gerente`
- `ops_sales_invoices` INSERT/UPDATE: `private.is_manager()`
- `ops_sales_invoice_lines` INSERT/UPDATE/DELETE: `private.is_manager()`
- RPC internas de emitir, registrar documento externo y convertir proforma: `private.is_manager()`
- migración versionada: `migrations/2026-10-06_invoice_role_permissions_v6.sql`

Pruebas:
- RLS real con Davinia / rol gerente: creación de borrador permitida dentro de transacción con ROLLBACK
- RLS real con Óscar / rol encargado: INSERT bloqueado por RLS
- UI encargado: Facturación en modo consulta, sin botones de creación/guardado
- GitHub Actions · Totus Central QA · run 27: SUCCESS
- Commit QA: `2feb390a56344d757c753a1e5837f4cabf055431`
- El commit posterior solo versiona la migración SQL y no modifica JS/CSS/tests.


## Cierre técnico adicional · 2026-10-06

Guardados financieros endurecidos:
- cierres guardados de forma atómica mediante `ops_save_closing`
- gastos + líneas guardados de forma atómica mediante `ops_save_expense`
- borradores de factura/proforma + líneas guardados de forma atómica mediante `ops_save_document_draft`
- si falla una línea, no queda una cabecera huérfana
- prueba forzada de error de FK en gasto: 0 residuos tras el fallo
- adjuntos validados antes de guardar: límite configurado y extensiones PDF/JPG/JPEG/PNG/WEBP/XLSX/XLS/CSV
- factura externa: el adjunto se procesa antes de emitir; si falla la subida queda en borrador y no se emite a medias

Seguridad y rutas de escritura:
- escrituras directas de cierres, detalle de cajas, gastos, líneas y clientes endurecidas
- la operativa diaria de encargado pasa por RPC atómicas controladas
- escritura directa por RLS para encargado: denegada
- encargado puede registrar cierre/gasto a través de la RPC prevista
- encargado no puede guardar ni emitir documentos de venta
- admin/gerente mantienen facturación completa

Coherencia de series:
- trigger `ops_validate_sales_document_series_tg`
- impide año de fecha distinto del año de serie
- impide serie de otra tienda
- impide serie de otro tipo de documento/factura
- caso inválido 2028 con serie 2026: bloqueado correctamente
- factura externa válida y proforma -> factura: probadas con transacción y ROLLBACK

QA navegador ampliada:
- GitHub Actions run 36: SUCCESS
- cálculo Pricing y normalización decimal
- guardado de cierre con dos cajas
- guardado de gasto con factura PDF adjunta
- guardado de proforma, emisión, numeración y PDF
- subida y descarga documental
- fiscalidad
- XLSX, PDF y paquete ZIP
- administración
- rol encargado en modo consulta
- responsive móvil

Integridad final de datos modernos:
- 0 líneas de gasto huérfanas
- 0 líneas de factura huérfanas
- 0 descuadres cabecera/líneas de gastos
- 0 descuadres cabecera/líneas de facturas
- 0 cierres modernos duplicados
- 0 cierres modernos fuera de fórmula
- 0 facturas emitidas sin número
- 0 facturas emitidas sin hash
- 0 series retrasadas
- 0 documentos con año de serie incorrecto
- 0 documentos con tienda de serie incorrecta

Histórico:
- existen 9 cierres importados con `legacy_cash_method=true` que no siguen la fórmula moderna.
- se conservan sin modificar porque representan el histórico original importado y están explícitamente marcados como legado.

Avisos Supabase:
- `Leaked Password Protection` sigue desactivado en Auth; requiere configuración del proyecto.
- el linter avisa de 7 RPC `SECURITY DEFINER`. Es intencionado: son las rutas atómicas públicas controladas internamente por `private.is_team_member()` / `private.is_manager()`, con `EXECUTE` revocado a `anon`.
- avisos de índices no usados son informativos con el volumen/uso actual; no se eliminan índices preventivamente sin carga real que lo justifique.

## Nota
La rama `main` sigue siendo la versión de producción anterior. No mezclar/promover esta rama hasta aprobación expresa.
