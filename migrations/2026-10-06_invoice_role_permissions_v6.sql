-- Totus Central V6 · permisos de facturación por rol
-- 2026-10-06
-- Facturación: lectura para equipo; escritura y RPC sensibles solo admin/gerente.

begin;

drop policy if exists ops_invoices_insert on public.ops_sales_invoices;
create policy ops_invoices_insert on public.ops_sales_invoices
for insert to authenticated
with check (private.is_manager());

drop policy if exists ops_invoices_update on public.ops_sales_invoices;
create policy ops_invoices_update on public.ops_sales_invoices
for update to authenticated
using (private.is_manager())
with check (private.is_manager());

drop policy if exists ops_invoice_lines_insert on public.ops_sales_invoice_lines;
create policy ops_invoice_lines_insert on public.ops_sales_invoice_lines
for insert to authenticated
with check (private.is_manager());

drop policy if exists ops_invoice_lines_update on public.ops_sales_invoice_lines;
create policy ops_invoice_lines_update on public.ops_sales_invoice_lines
for update to authenticated
using (private.is_manager())
with check (private.is_manager());

drop policy if exists ops_invoice_lines_delete on public.ops_sales_invoice_lines;
create policy ops_invoice_lines_delete on public.ops_sales_invoice_lines
for delete to authenticated
using (private.is_manager());

create or replace function private.ops_finalize_document_internal(p_document_id uuid)
returns public.ops_sales_invoices
language plpgsql
security definer
set search_path to 'public'
as $function$
declare d public.ops_sales_invoices; s public.ops_invoice_series; n integer; prev_hash text; tpl jsonb; new_hash text;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede emitir documentos'; end if;
  select * into d from public.ops_sales_invoices where id=p_document_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if d.status<>'borrador' then return d; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_document_id)
    then raise exception 'El documento no tiene líneas'; end if;

  select * into s from public.ops_invoice_series where id=d.series_id for update;
  if not found or not s.active then raise exception 'Serie no disponible'; end if;
  if s.document_type<>d.document_type then raise exception 'La serie no corresponde al tipo de documento'; end if;
  if d.document_type='factura' and coalesce(s.series_kind,'invoice')<>coalesce(d.invoice_kind,'invoice') then
    raise exception 'La serie no corresponde al tipo de factura';
  end if;

  n=s.next_number;
  update public.ops_invoice_series set next_number=n+1 where id=s.id;

  select to_jsonb(t) into tpl from public.ops_document_templates t where t.id=d.template_id;
  if tpl is null then tpl='{}'::jsonb; end if;

  if d.document_type='factura' then
    select record_hash into prev_hash
      from public.ops_sales_invoices
      where document_type='factura' and status in ('emitida','anulada')
        and series_id=d.series_id and record_hash is not null
      order by issued_at desc nulls last, created_at desc limit 1;
  else
    prev_hash=null;
  end if;

  new_hash=encode(extensions.digest(
    concat_ws('|',d.id::text,d.document_type,s.code,n::text,d.issue_date::text,
              d.customer_tax_id,d.customer_name,d.base_amount::text,d.vat_amount::text,
              d.total_amount::text,coalesce(prev_hash,'')),
    'sha256'),'hex');

  update public.ops_sales_invoices set
    number=n,
    display_number=s.prefix||lpad(n::text,s.padding,'0'),
    status='emitida',
    issued_at=now(),
    design_snapshot=tpl,
    template_snapshot=tpl,
    previous_hash=prev_hash,
    record_hash=new_hash,
    updated_at=now()
  where id=p_document_id returning * into d;
  return d;
end $function$;

create or replace function private.ops_register_external_document_internal(p_document_id uuid, p_number integer)
returns public.ops_sales_invoices
language plpgsql
security definer
set search_path to 'public'
as $function$
declare d public.ops_sales_invoices; s public.ops_invoice_series; tpl jsonb; prev_hash text; new_hash text;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede registrar documentos externos'; end if;
  if p_number is null or p_number < 1 then raise exception 'Número externo no válido'; end if;

  select * into d from public.ops_sales_invoices where id=p_document_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if d.origin<>'externa' then raise exception 'El documento no está marcado como externo'; end if;
  if d.status<>'borrador' then return d; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_document_id)
    then raise exception 'El documento no tiene líneas'; end if;

  select * into s from public.ops_invoice_series where id=d.series_id for update;
  if not found or not s.active then raise exception 'Serie no disponible'; end if;
  if s.document_type<>d.document_type then raise exception 'La serie no corresponde al tipo de documento'; end if;
  if d.document_type='factura' and s.series_kind<>d.invoice_kind
    then raise exception 'La serie no corresponde al tipo de factura'; end if;

  if exists(
    select 1 from public.ops_sales_invoices x
    where x.series_id=d.series_id and x.number=p_number and x.id<>d.id
  ) then
    raise exception 'Ese número ya existe en la serie';
  end if;

  update public.ops_invoice_series
  set next_number=greatest(next_number,p_number+1)
  where id=s.id;

  select to_jsonb(t) into tpl from public.ops_document_templates t where t.id=d.template_id;
  if tpl is null then tpl='{}'::jsonb; end if;

  if d.document_type='factura' then
    select record_hash into prev_hash
    from public.ops_sales_invoices
    where document_type='factura'
      and status in ('emitida','anulada')
      and series_id=d.series_id
      and record_hash is not null
    order by issued_at desc nulls last, created_at desc
    limit 1;
  else
    prev_hash=null;
  end if;

  new_hash=encode(extensions.digest(
    concat_ws('|',d.id::text,d.document_type,s.code,p_number::text,d.issue_date::text,
      d.customer_tax_id,d.customer_name,d.base_amount::text,d.vat_amount::text,
      d.total_amount::text,coalesce(prev_hash,'')),
    'sha256'),'hex');

  update public.ops_sales_invoices set
    number=p_number,
    display_number=s.prefix||lpad(p_number::text,s.padding,'0'),
    external_number_text=p_number::text,
    status='emitida',
    issued_at=now(),
    design_snapshot=tpl,
    template_snapshot=tpl,
    previous_hash=prev_hash,
    record_hash=new_hash,
    updated_at=now()
  where id=d.id
  returning * into d;

  return d;
end;
$function$;

create or replace function private.ops_convert_proforma_internal(p_proforma_id uuid, p_invoice_series_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare p public.ops_sales_invoices; iid uuid; ser public.ops_invoice_series;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede convertir proformas'; end if;

  select * into p from public.ops_sales_invoices where id=p_proforma_id for update;
  if not found then raise exception 'Proforma no encontrada'; end if;
  if p.document_type<>'proforma' then raise exception 'El documento indicado no es una proforma'; end if;
  if p.status='convertida' and p.converted_invoice_id is not null then return p.converted_invoice_id; end if;
  if p.status in ('anulada','rechazada') then raise exception 'La proforma no se puede convertir en su estado actual'; end if;
  if p.status not in ('emitida','aceptada') then raise exception 'Emite o acepta la proforma antes de convertirla'; end if;

  select * into ser from public.ops_invoice_series where id=p_invoice_series_id for update;
  if not found or not ser.active or ser.document_type<>'factura' or ser.series_kind<>'invoice'
    then raise exception 'Serie de factura ordinaria no válida'; end if;
  if p.store_id is not null and ser.store_id is not null and p.store_id<>ser.store_id
    then raise exception 'La serie de factura no corresponde al establecimiento de la proforma'; end if;

  insert into public.ops_sales_invoices(
    series_id,store_id,issue_date,due_date,operation_date,origin,status,document_type,invoice_kind,
    customer_id,customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
    paid_status,paid_date,include_in_income,template_id,terms_text,footer_text,purchase_order_ref,currency,
    notes,created_by,source_proforma_document_id
  ) values(
    p_invoice_series_id,p.store_id,current_date,p.due_date,p.operation_date,'totus','borrador','factura','invoice',
    p.customer_id,p.customer_name,p.customer_tax_id,p.customer_address,p.customer_email,p.concept,p.payment_method,
    'pendiente',null,false,p.template_id,p.terms_text,p.footer_text,p.purchase_order_ref,coalesce(p.currency,'EUR'),
    p.notes,auth.uid(),p.id
  ) returning id into iid;

  insert into public.ops_sales_invoice_lines(
    invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate,
    base_amount,vat_amount,total_amount
  )
  select iid,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate,
         base_amount,vat_amount,total_amount
  from public.ops_sales_invoice_lines
  where invoice_id=p.id
  order by sort_order,id;

  update public.ops_sales_invoices
  set status='convertida',converted_invoice_id=iid,updated_at=now()
  where id=p.id;

  return iid;
end;
$function$;

commit;
