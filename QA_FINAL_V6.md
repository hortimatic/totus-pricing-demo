# TOTUS CENTRAL · QA DE DESARROLLO

Fecha: 2026-10-06
Rama probada: `desarrollo-v6`
Commit UI QA de referencia: `2feb390a56344d757c753a1e5837f4cabf055431`
HEAD documentado: `ded05d85025a24ac706523fda68fb2485f830ded`
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

## Nota
La rama `main` sigue siendo la versión de producción anterior. No mezclar/promover esta rama hasta aprobación expresa.
