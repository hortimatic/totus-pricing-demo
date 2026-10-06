-- Totus Central V6 · protección de coherencia entre documento y serie
-- 2026-10-06

begin;

create or replace function public.ops_validate_sales_document_series()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare s public.ops_invoice_series;
begin
  if tg_op='UPDATE'
     and new.series_id is not distinct from old.series_id
     and new.issue_date is not distinct from old.issue_date
     and new.document_type is not distinct from old.document_type
     and new.invoice_kind is not distinct from old.invoice_kind
     and new.store_id is not distinct from old.store_id
  then
    return new;
  end if;

  select * into s from public.ops_invoice_series where id=new.series_id;
  if not found then raise exception 'Serie no encontrada'; end if;
  if not s.active then raise exception 'La serie no está activa'; end if;

  if s.year <> extract(year from new.issue_date)::integer then
    raise exception 'La fecha del documento (%) no corresponde al año de la serie (%)',new.issue_date,s.year;
  end if;

  if s.document_type <> new.document_type then
    raise exception 'La serie no corresponde al tipo de documento';
  end if;

  if new.document_type='factura'
     and coalesce(s.series_kind,'invoice') <> coalesce(new.invoice_kind,'invoice')
  then
    raise exception 'La serie no corresponde al tipo de factura';
  end if;

  if s.store_id is not null and new.store_id is distinct from s.store_id then
    raise exception 'La serie no corresponde al establecimiento seleccionado';
  end if;

  return new;
end;
$function$;

drop trigger if exists ops_validate_sales_document_series_tg on public.ops_sales_invoices;
create trigger ops_validate_sales_document_series_tg
before insert or update on public.ops_sales_invoices
for each row execute function public.ops_validate_sales_document_series();

commit;
