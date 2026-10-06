-- Totus Central V6 · obligar a usar las rutas atómicas de escritura
-- 2026-10-06

begin;

drop policy if exists ops_closings_insert on public.ops_daily_closings;
create policy ops_closings_insert on public.ops_daily_closings
for insert to authenticated with check (private.is_manager());

drop policy if exists ops_closings_update on public.ops_daily_closings;
create policy ops_closings_update on public.ops_daily_closings
for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_closing_drawers_insert on public.ops_daily_closing_drawers;
create policy ops_closing_drawers_insert on public.ops_daily_closing_drawers
for insert to authenticated with check (private.is_manager());

drop policy if exists ops_closing_drawers_update on public.ops_daily_closing_drawers;
create policy ops_closing_drawers_update on public.ops_daily_closing_drawers
for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_expenses_insert on public.ops_expenses;
create policy ops_expenses_insert on public.ops_expenses
for insert to authenticated with check (private.is_manager());

drop policy if exists ops_expenses_update on public.ops_expenses;
create policy ops_expenses_update on public.ops_expenses
for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_expense_lines_insert on public.ops_expense_lines;
create policy ops_expense_lines_insert on public.ops_expense_lines
for insert to authenticated with check (private.is_manager());

drop policy if exists ops_expense_lines_update on public.ops_expense_lines;
create policy ops_expense_lines_update on public.ops_expense_lines
for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_expense_lines_delete on public.ops_expense_lines;
create policy ops_expense_lines_delete on public.ops_expense_lines
for delete to authenticated using (private.is_manager());

drop policy if exists ops_customers_insert on public.ops_customers;
create policy ops_customers_insert on public.ops_customers
for insert to authenticated with check (private.is_manager());

drop policy if exists ops_customers_update on public.ops_customers;
create policy ops_customers_update on public.ops_customers
for update to authenticated using (private.is_manager()) with check (private.is_manager());

commit;
