# TOTUS CENTRAL · QA DE DESARROLLO

Fecha: 2026-10-06
Rama probada: `desarrollo-v6`
Commit de referencia: `ec29060d18a6e4d2c147d8bff6b861accf03f337`
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

## Nota
La rama `main` sigue siendo la versión de producción anterior. No mezclar/promover esta rama hasta aprobación expresa.
