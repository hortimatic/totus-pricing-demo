
(function(){
'use strict';

const O=window.TotusGestion={
  loaded:false,loading:false,tab:'resumen',
  year:new Date().getFullYear(),quarter:Math.floor(new Date().getMonth()/3)+1,storeId:'all',
  settings:null,stores:[],categories:[],documents:[],expenses:[],expenseLines:[],
  closings:[],drawers:[],closingDrawers:[],series:[],invoices:[],invoiceLines:[],
  taxPayments:[],retaBrackets:[],fiscalAdjustments:[],incomeAdjustments:[],gestorQuarterSummary:[],reconciliationNotes:[],
  closeDraft:null,expenseDraft:null,expenseDraftLines:[],invoiceDraft:null,invoiceDraftLines:[],
  docFilter:{from:'',to:'',store:'all',status:'all',type:'all',q:''},
  reportFrom:'',reportTo:'',plannedSpend:'',
  saving:false
};

function n(v){ return parseNum(v); }
function h(v){ return esc(v); }
function isoToday(){ return new Date().toISOString().slice(0,10); }
function dmy(v){ if(!v)return '—'; const [y,m,d]=String(v).slice(0,10).split('-'); return d+'/'+m+'/'+y; }
function qtrFromDate(v){ const m=+(String(v).slice(5,7)||1); return Math.floor((m-1)/3)+1; }
function periodBounds(year,quarter,accumulated=false){
  const start=accumulated?`${year}-01-01`:`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`;
  const endMonth=quarter*3;
  const end=new Date(year,endMonth,0);
  const endS=`${year}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
  return {start,end:endS};
}
function inRange(date,from,to){ return !!date && date>=from && date<=to; }
function storeName(id){ return O.stores.find(x=>x.id===id)?.name || 'General'; }
function category(id){ return O.categories.find(x=>x.id===id); }
function sum(arr,fn=x=>x){ return arr.reduce((a,x)=>a+(Number(fn(x))||0),0); }
function fmtInt(v){ return new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(v||0); }
function b64Safe(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,''); }
function csvCell(v){ const s=String(v??''); return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function csvDownload(name,rows){
  const txt='\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob([txt],{type:'text/csv;charset=utf-8'});
  dlBlob(blob,name);
}
function dlBlob(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200);
}
function statusBadge(v){
  const good=['pagado','pagada','entregada_gestor','archivada','emitida','cerrado','revisada','aceptada','convertida'];
  const bad=['anulada','rechazada','fallido'];
  return `<span class="badge ${good.includes(v)?'ok':bad.includes(v)?'badb':'warnb'}">${h(String(v||'').replaceAll('_',' '))}</span>`;
}
async function selectAll(table,orderCol=null,asc=false){
  const out=[]; let from=0;
  while(true){
    let req=sb.from(table).select('*');
    if(orderCol)req=req.order(orderCol,{ascending:asc});
    req=req.range(from,from+999);
    const {data,error}=await req;
    if(error)throw new Error(table+': '+error.message);
    out.push(...(data||[]));
    if(!data||data.length<1000)break;
    from+=1000;
  }
  return out;
}
async function audit(area,action,entityId=null,detail={}){
  try{ await sb.from('ops_audit_log').insert({user_id:authSession?.user?.id||null,user_email:authSession?.user?.email||'',area,action,entity_id:entityId,detail}); }catch(e){console.warn(e)}
}
function manager(){ return ['admin','gerente'].includes(currentRole()); }
function adminOnly(){ return currentRole()==='admin'; }

O.core={n,h,isoToday,dmy,periodBounds,inRange,storeName,category,sum,dlBlob,statusBadge,selectAll,audit,manager,adminOnly};

async function load(force=false){
  if(O.loading)return;
  if(O.loaded&&!force)return;
  O.loading=true;
  try{
    const [settings,stores,categories,documents,expenses,expenseLines,closings,drawers,closingDrawers,series,invoices,invoiceLines,taxPayments,retaBrackets,fiscalAdjustments,incomeAdjustments,gestorQuarterSummary,reconciliationNotes]=await Promise.all([
      selectAll('ops_business_settings'),
      selectAll('ops_stores','sort_order',true),
      selectAll('ops_expense_categories','sort_order',true),
      selectAll('ops_documents','created_at',false),
      selectAll('ops_expenses','expense_date',false),
      selectAll('ops_expense_lines','sort_order',true),
      selectAll('ops_daily_closings','business_date',false),
      selectAll('ops_cash_drawers','sort_order',true),
      selectAll('ops_daily_closing_drawers'),
      selectAll('ops_invoice_series','year',false),
      selectAll('ops_sales_invoices','issue_date',false),
      selectAll('ops_sales_invoice_lines','sort_order',true),
      selectAll('ops_tax_payments','created_at',false),
      selectAll('ops_reta_brackets','bracket_order',true),
      selectAll('ops_fiscal_adjustments','adjustment_date',false),
      selectAll('ops_income_adjustments','income_date',false),
      selectAll('ops_gestor_quarter_summary','quarter',true),
      selectAll('ops_reconciliation_notes','created_at',false)
    ]);
    O.settings=settings[0]||{};
    O.stores=stores.filter(x=>x.active!==false);
    O.categories=categories.filter(x=>x.active!==false);
    O.documents=documents; O.expenses=expenses; O.expenseLines=expenseLines;
    O.closings=closings; O.drawers=drawers.filter(x=>x.active!==false); O.closingDrawers=closingDrawers;
    O.series=series; O.invoices=invoices; O.invoiceLines=invoiceLines; O.taxPayments=taxPayments;
    O.retaBrackets=retaBrackets; O.fiscalAdjustments=fiscalAdjustments; O.incomeAdjustments=incomeAdjustments; O.gestorQuarterSummary=gestorQuarterSummary; O.reconciliationNotes=reconciliationNotes.filter(x=>x.active!==false);
    if(!O.year)O.year=O.settings.current_year||new Date().getFullYear();
    if(!O.reportFrom)O.reportFrom=`${O.year}-01-01`;
    if(!O.reportTo)O.reportTo=`${O.year}-12-31`;
    O.loaded=true;
  }finally{O.loading=false}
}
window.opsLoadData=load;

function filteredClosings(from,to,store='all'){
 return O.closings.filter(x=>inRange(x.business_date,from,to)&&(store==='all'||x.store_id===store));
}
function closingCsvRows(from,to){
 return [['Fecha','Establecimiento','Apertura','Efectivo vendido','Tarjeta','Bizum','Online','Otras entradas','Salida caja','Gastos caja','Caja final','Total ventas','Notas'],
  ...filteredClosings(from,to,O.storeId).sort((a,b)=>a.business_date.localeCompare(b.business_date)).map(c=>[
   c.business_date,storeName(c.store_id),c.opening_cash,c.cash_sales,c.card_sales,c.bizum_sales,c.online_sales,c.other_income,
   c.cash_withdrawals,c.cash_expenses_declared,c.actual_cash,
   n(c.cash_sales)+n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income),c.notes||''
  ])];
}
window.opsExportClosings=function(){
 const p=periodBounds(O.year,O.quarter,false);
 csvDownload(`cierres_${p.start}_${p.end}.csv`,closingCsvRows(p.start,p.end));
};
function expenseCsvRows(from,to){
 const lineMap=new Map();O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 const rows=[['Fecha','Establecimiento','Proveedor','NIF/CIF','Factura','Concepto','Base','IVA %','IVA','RE %','RE','Retención %','Retención','Imputable IRPF','Pagado','Interno']];
 O.expenses.filter(e=>inRange(e.expense_date,from,to)&&(O.storeId==='all'||e.store_id===O.storeId)).sort((a,b)=>a.expense_date.localeCompare(b.expense_date)).forEach(e=>{
  const ls=lineMap.get(e.id)||[];
  if(!ls.length)rows.push([e.expense_date,storeName(e.store_id),e.supplier_name,e.supplier_tax_id||'',e.invoice_number||'',e.description||'',e.base_amount||0,0,e.vat_amount||0,0,e.re_amount||0,0,e.withholding_amount||0,e.deductible_irpf===false?0:(e.accounting_amount||e.gross_expense||0),e.amount_paid||0,e.management_only?'Sí':'No']);
  else ls.forEach(l=>rows.push([e.expense_date,storeName(e.store_id),e.supplier_name,e.supplier_tax_id||'',e.invoice_number||'',l.description||category(l.category_id)?.name||'',l.base_amount||0,l.vat_rate||0,l.vat_amount||0,l.re_rate||0,l.re_amount||0,l.withholding_rate||0,l.withholding_amount||0,l.irpf_imputable||0,e.amount_paid||0,e.management_only?'Sí':'No']));
 });
 return rows;
}
window.opsExportExpenses=function(){
 const p=periodBounds(O.year,O.quarter,false);
 csvDownload(`gastos_${p.start}_${p.end}.csv`,expenseCsvRows(p.start,p.end));
};

function sectionMeta(tab=O.tab){
 return ({
  resumen:['Resumen','Visión global','Ventas, gastos, resultado, fiscalidad y servidor.'],
  cajas:['Cajas','Trabajo diario','Aperturas y cierres de Hortimatic y NewOldSmok.'],
  gastos:['Gastos','Compras y pagos','Compras, proveedores, servicios y gastos internos o fiscales.'],
  facturas:['Facturación','Ventas documentadas','Facturas, proformas, series, plantillas, logo y PDF.'],
  documentos:['Documentos','Archivo digital','Facturas y documentos ordenados, localizables y descargables.'],
  fiscal:['Fiscalidad','Control trimestral','IRPF, retenciones, previsiones y tramo RETA.'],
  informes:['Informes','Descargas','Informes por fechas y paquete preparado para gestoría.'],
  config:['Configuración','Administración','Empresa, tiendas, cajas, criterios fiscales y almacenamiento.']
 })[tab]||['Gestión','',''];
}
function headerHtml(){
 const m=sectionMeta();
 return `<div class="head"><div><div class="eyebrow">${m[1]}</div><h1>${m[0]}</h1><p>${m[2]}</p></div><div class="ops-filters"><div><label>Año</label><select onchange="opsSetYear(this.value)">${[2025,2026,2027,2028].map(y=>`<option ${O.year==y?'selected':''}>${y}</option>`).join('')}</select></div><div><label>Trimestre</label><select onchange="opsSetQuarter(this.value)">${[1,2,3,4].map(q=>`<option value="${q}" ${O.quarter==q?'selected':''}>T${q}</option>`).join('')}</select></div><div><label>Establecimiento</label><select onchange="opsSetStore(this.value)"><option value="all">Ambos</option>${O.stores.map(s=>`<option value="${s.id}" ${O.storeId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div></div></div>`;
}
function managementHtml(){
 if(!O.loaded)return `<div class="head"><div><div class="eyebrow">${sectionMeta()[1]}</div><h1>Preparando ${sectionMeta()[0].toLowerCase()}…</h1><p>Un momento.</p></div></div><div class="ops-card">Cargando los datos necesarios…</div>`;
 const moduleBody=window.TotusGestionFeatures?.body?.(O.tab);
 let body=moduleBody??'';
 if(moduleBody==null){
  if(O.tab==='cajas')body=closingsHtml();
  else if(O.tab==='gastos')body=expensesHtml();
  else body='<div class="ops-card">Cargando módulo de gestión…</div>';
 }
 return `<div class="ops-wrap">${headerHtml()}${body}</div>`;
}
window.opsManagementHtml=managementHtml;

function newClosingDraft(){
 const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
 return {id:null,storeId:sid,date:isoToday(),card:'',bizum:'',online:'',other:'',withdrawals:'',cashExpenses:'',notes:'',status:'cerrado',drawers:{}};
}
function closingDrawerState(draft,drawer){
 if(draft.drawers[drawer.id])return draft.drawers[drawer.id];
 let opening=0;
 const prev=O.closings.filter(c=>c.store_id===draft.storeId&&c.business_date<draft.date).sort((a,b)=>b.business_date.localeCompare(a.business_date))[0];
 if(prev){
   const row=O.closingDrawers.find(x=>x.closing_id===prev.id&&x.drawer_id===drawer.id);
   if(row)opening=n(row.closing_cash);
 }
 return draft.drawers[drawer.id]={opening:String(opening||''),closing:''};
}
function closeCalc(){
 const d=O.closeDraft||newClosingDraft();
 const ds=O.drawers.filter(x=>x.store_id===d.storeId);
 let opening=0,closing=0;
 ds.forEach(dr=>{const x=closingDrawerState(d,dr);opening+=n(x.opening);closing+=n(x.closing)});
 const withdrawals=n(d.withdrawals),cashExpenses=n(d.cashExpenses);
 const cashSales=closing+withdrawals+cashExpenses-opening;
 const total=cashSales+n(d.card)+n(d.bizum)+n(d.online)+n(d.other);
 return {opening,closing,withdrawals,cashExpenses,cashSales,total};
}
function closingsHtml(){
 if(!O.closeDraft)O.closeDraft=newClosingDraft();
 const d=O.closeDraft,c=closeCalc(),drawers=O.drawers.filter(x=>x.store_id===d.storeId);
 const pb=periodBounds(O.year,O.quarter,false);
 const rows=filteredClosings(pb.start,pb.end,O.storeId).slice(0,100);
 return `<div class="ops-card">
  <div class="section-head"><div><div class="eyebrow">${d.id?'Editar':'Nuevo'} cierre</div><h3>Cierre diario</h3><div class="small">Mismo flujo que el chat: caja final, salida y tarjeta; con Bizum/online cuando exista.</div></div><div class="ops-actions">${d.id?'<button class="ghost" onclick="opsNewClosing()">Nuevo</button>':''}<button class="primary" onclick="opsSaveClosing('cerrado')">Guardar cierre</button></div></div>
  <div class="ops-form">
   <div><label>Establecimiento</label><select onchange="opsCloseField('storeId',this.value,true)">${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div>
   <div><label>Fecha</label><input type="date" value="${h(d.date)}" onchange="opsCloseField('date',this.value,true)"></div>
   <div><label>Tarjeta</label><input inputmode="decimal" value="${h(d.card)}" oninput="opsCloseField('card',this.value)"></div>
   <div><label>Salida de caja</label><input inputmode="decimal" value="${h(d.withdrawals)}" oninput="opsCloseField('withdrawals',this.value)"></div>
   <div><label>Bizum</label><input inputmode="decimal" value="${h(d.bizum)}" oninput="opsCloseField('bizum',this.value)"></div>
   <div><label>Pedidos online</label><input inputmode="decimal" value="${h(d.online)}" oninput="opsCloseField('online',this.value)"></div>
   <div><label>Otras entradas</label><input inputmode="decimal" value="${h(d.other)}" oninput="opsCloseField('other',this.value)"></div>
   <div><label>Gastos pagados desde caja</label><input inputmode="decimal" value="${h(d.cashExpenses)}" oninput="opsCloseField('cashExpenses',this.value)"></div>
   ${drawers.map(dr=>{const x=closingDrawerState(d,dr);return `<div><label>${h(dr.name)} · apertura</label><input inputmode="decimal" value="${h(x.opening)}" oninput="opsDrawerField('${dr.id}','opening',this.value)"></div><div><label>${h(dr.name)} · queda en caja</label><input inputmode="decimal" value="${h(x.closing)}" oninput="opsDrawerField('${dr.id}','closing',this.value)"></div>`}).join('')}
   <div class="span4"><label>Observaciones</label><textarea oninput="opsCloseField('notes',this.value)">${h(d.notes)}</textarea></div>
  </div>
  <div class="ops-close-summary">
   <div><small>Apertura total</small><b id="ops_close_open">${eur(c.opening)}</b></div>
   <div><small>Venta efectivo calculada</small><b id="ops_close_cashsales">${eur(c.cashSales)}</b></div>
   <div><small>Caja final</small><b id="ops_close_end">${eur(c.closing)}</b></div>
   <div><small>Ventas del día</small><b id="ops_close_total">${eur(c.total)}</b></div>
  </div>
  <div class="ops-note" style="margin-top:10px">Venta en efectivo = caja final + salidas + gastos pagados desde caja − apertura. De esta forma no dependes de volver a contar la apertura al día siguiente.</div>
 </div>
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">T${O.quarter}</div><h3>Histórico de cierres</h3></div><button class="secondary" onclick="opsExportClosings()">CSV</button></div>
 ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Tienda</th><th>Efectivo</th><th>Tarjeta</th><th>Bizum</th><th>Online</th><th>Salida</th><th>Caja final</th><th>Total venta</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td>${dmy(c.business_date)}</td><td>${h(storeName(c.store_id))}</td><td class="num">${eur(c.cash_sales)}</td><td class="num">${eur(c.card_sales)}</td><td class="num">${eur(c.bizum_sales)}</td><td class="num">${eur(c.online_sales)}</td><td class="num">${eur(c.cash_withdrawals)}</td><td class="num">${eur(c.actual_cash)}</td><td class="num"><b>${eur(n(c.cash_sales)+n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income))}</b></td><td><button class="ghost" onclick="opsEditClosing('${c.id}')">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay cierres en este periodo.</div>'}
 </div>`;
}
window.opsCloseField=function(k,v,rerender=false){ if(!O.closeDraft)O.closeDraft=newClosingDraft();O.closeDraft[k]=v;if(rerender){O.closeDraft.drawers={};render()}else updateCloseSummary(); };
window.opsDrawerField=function(id,k,v){if(!O.closeDraft)O.closeDraft=newClosingDraft();const dr=O.drawers.find(x=>x.id===id);const x=closingDrawerState(O.closeDraft,dr);x[k]=v;updateCloseSummary();};
function updateCloseSummary(){const c=closeCalc();[['ops_close_open',c.opening],['ops_close_cashsales',c.cashSales],['ops_close_end',c.closing],['ops_close_total',c.total]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.textContent=eur(v)});}
window.opsNewClosing=function(){O.closeDraft=newClosingDraft();render()};
window.opsEditClosing=function(id){
 const c=O.closings.find(x=>x.id===id); if(!c)return;
 const drawers={};O.closingDrawers.filter(x=>x.closing_id===id).forEach(x=>drawers[x.drawer_id]={opening:String(x.opening_cash??''),closing:String(x.closing_cash??'')});
 O.closeDraft={id:c.id,storeId:c.store_id,date:c.business_date,card:String(c.card_sales||''),bizum:String(c.bizum_sales||''),online:String(c.online_sales||''),other:String(c.other_income||''),withdrawals:String(c.cash_withdrawals||''),cashExpenses:String(c.cash_expenses_declared||''),notes:c.notes||'',status:c.status,drawers};render();window.scrollTo({top:0,behavior:'smooth'});
};
window.opsSaveClosing=async function(status='cerrado'){
 if(O.saving)return; const d=O.closeDraft,c=closeCalc(); if(!d.storeId||!d.date){alert('Tienda y fecha son obligatorias.');return}
 const ds=O.drawers.filter(x=>x.store_id===d.storeId); if(!ds.length){alert('Esta tienda no tiene cajas configuradas.');return}
 if(ds.some(dr=>String(closingDrawerState(d,dr).closing).trim()==='')){alert('Indica cuánto queda en cada caja.');return}
 O.saving=true;
 try{
   const payload={id:d.id||null,store_id:d.storeId,business_date:d.date,card_sales:n(d.card),bizum_sales:n(d.bizum),online_sales:n(d.online),other_income:n(d.other),cash_withdrawals:n(d.withdrawals),cash_expenses_declared:n(d.cashExpenses),notes:d.notes||'',status};
   const drawerRows=ds.map(dr=>{const x=closingDrawerState(d,dr);return{drawer_id:dr.id,opening_cash:n(x.opening),closing_cash:n(x.closing),notes:''}});
   const {data:id,error}=await sb.rpc('ops_save_closing',{p_closing:payload,p_drawers:drawerRows});if(error)throw error;
   await audit('cajas',d.id?'actualizar':'crear',id,{fecha:d.date,tienda:storeName(d.storeId),ventas:c.total});
   await load(true); O.closeDraft=newClosingDraft(); render();
 }catch(e){alert('No se pudo guardar el cierre: '+e.message)}finally{O.saving=false}
};

function defaultExpenseLine(){
 const cat=O.categories.find(c=>c.code==='MERCH')||O.categories[0];
 return {id:null,categoryId:cat?.id||'',description:'',base:'',vat:'21',re:cat?.code==='MERCH'?'5,2':'0',withholding:'0',model:'',deductible:true,fixed:false};
}
function newExpenseDraft(){
 const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
 return {id:null,storeId:sid,date:isoToday(),supplier:'',taxId:'',invoice:'',documentKind:'factura',payment:'transferencia',paidStatus:'pagado',paidDate:isoToday(),amountPaid:'',notes:'',fiscalReviewed:false,managementOnly:false};
}
function expenseLineCalc(l){
 const base=n(l.base),vatRate=n(l.vat),reRate=n(l.re),wRate=n(l.withholding);
 const vat=base*vatRate/100,re=base*reRate/100,withholding=base*wRate/100;
 const accounting=base+vat+re,payable=accounting-withholding;
 const imputable=(l.deductible&&!l.fixed)?accounting:0;
 return {base,vatRate,reRate,wRate,vat,re,withholding,accounting,payable,imputable};
}
function draftExpenseTotals(){
 let accounting=0,payable=0,withholding=0;
 O.expenseDraftLines.forEach(l=>{const x=expenseLineCalc(l);accounting+=x.accounting;payable+=x.payable;withholding+=x.withholding});
 return {accounting,payable,withholding};
}
function expensesHtml(){
 if(!O.expenseDraft){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}
 const d=O.expenseDraft,t=draftExpenseTotals(),pb=periodBounds(O.year,O.quarter,false);
 const rows=O.expenses.filter(e=>inRange(e.expense_date,pb.start,pb.end)&&(O.storeId==='all'||e.store_id===O.storeId)).slice(0,120);
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">${d.id?'Editar':'Registrar'} gasto</div><h3>Compra, suministro o gasto</h3><div class="small">Los impuestos quedan desglosados como en el documento de la gestoría.</div></div><div class="ops-actions">${d.id?'<button class="ghost" onclick="opsNewExpense()">Nuevo</button>':''}<button class="primary" onclick="opsSaveExpense()">Guardar gasto</button></div></div>
 <div class="ops-form">
  <div><label>Fecha</label><input type="date" value="${h(d.date)}" oninput="opsExpenseField('date',this.value)"></div>
  <div><label>Establecimiento</label><select oninput="opsExpenseField('storeId',this.value)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div>
  <div><label>Proveedor / servicio</label><input value="${h(d.supplier)}" oninput="opsExpenseField('supplier',this.value)"></div>
  <div><label>NIF / CIF proveedor</label><input value="${h(d.taxId)}" oninput="opsExpenseField('taxId',this.value)"></div>
  <div><label>Nº factura proveedor</label><input value="${h(d.invoice)}" oninput="opsExpenseField('invoice',this.value)"></div>
  <div><label>Documento</label><select oninput="opsExpenseField('documentKind',this.value)">${[['factura','Factura'],['rectificativa','Rectificativa / abono'],['ticket','Ticket'],['nomina','Nómina'],['seguridad_social','Seguridad Social'],['recibo','Recibo'],['otro','Otro']].map(x=>`<option value="${x[0]}" ${d.documentKind===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
  <div><label>Forma de pago</label><select oninput="opsExpenseField('payment',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>
  <div><label>Estado</label><select oninput="opsExpenseField('paidStatus',this.value)">${['pagado','pendiente','parcial'].map(x=>`<option ${d.paidStatus===x?'selected':''}>${x}</option>`).join('')}</select></div>
  <div><label>Fecha pago</label><input type="date" value="${h(d.paidDate)}" oninput="opsExpenseField('paidDate',this.value)"></div>
  <div><label>Importe realmente pagado</label><input inputmode="decimal" placeholder="${String(t.payable.toFixed(2)).replace('.',',')}" value="${h(d.amountPaid)}" oninput="opsExpenseField('amountPaid',this.value)"></div>
  <div class="span2"><label>Factura / documento adjunto</label><input id="ops_exp_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"></div>
  <div class="span4 bill-check"><input id="ops_management_only" type="checkbox" ${d.managementOnly?'checked':''} onchange="opsExpenseField('managementOnly',this.checked,true)"><label for="ops_management_only">Solo control interno · no incluir en gestoría ni cálculo fiscal.</label></div>
  <div class="span4"><label>Notas</label><textarea oninput="opsExpenseField('notes',this.value)">${h(d.notes)}</textarea></div>
 </div>
 <div class="section-head" style="margin-top:16px"><div><h4>${d.managementOnly?'Desglose interno':'Desglose fiscal'}</h4><div class="small">${d.managementOnly?'Se contará para rentabilidad real, pero quedará fuera de gestoría y fiscalidad.':'Permite facturas con varios tipos de IVA, retenciones y recargo.'}</div></div><div class="ops-actions"><button class="ghost" onclick="opsQuickInternal('warehouse')">Almacén 300 €</button><button class="ghost" onclick="opsQuickInternal('overtime')">Horas extra</button><button class="secondary" onclick="opsAddExpenseLine()">Añadir línea</button></div></div>
 <div class="ops-lines">${O.expenseDraftLines.map((l,i)=>expenseLineHtml(l,i)).join('')}</div>
 <div class="ops-totalbox"><div><small>Base + IVA + RE</small><b>${eur(t.accounting)}</b></div><div><small>Retenciones</small><b>${eur(t.withholding)}</b></div><div><small>A pagar proveedor</small><b>${eur(t.payable)}</b></div><div><small>Pagado indicado</small><b>${d.amountPaid!==''?eur(n(d.amountPaid)):eur(t.payable)}</b></div></div>
 </div>
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">T${O.quarter}</div><h3>Gastos registrados</h3></div><button class="secondary" onclick="opsExportExpenses()">CSV gestoría</button></div>
 ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Tienda</th><th>Proveedor</th><th>Factura</th><th>Tipo</th><th>Contable</th><th>Pagado</th><th>Documento</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td>${dmy(e.expense_date)}</td><td>${h(storeName(e.store_id))}</td><td><b>${h(e.supplier_name)}</b><div class="ops-tiny">${h(e.supplier_tax_id)}</div></td><td>${h(e.invoice_number||'—')}</td><td>${h(e.document_kind||'factura')}${e.management_only?'<div><span class="badge warnb">Interno</span></div>':''}</td><td class="num">${eur(e.accounting_amount||e.gross_expense)}</td><td class="num">${eur(e.amount_paid)}</td><td>${e.document_id?'<span class="badge ok">Adjunta</span>':'<span class="badge warnb">Sin archivo</span>'}</td><td><button class="ghost" onclick="opsEditExpense('${e.id}')">Abrir</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay gastos en este trimestre.</div>'}
 </div>`;
}
function expenseLineHtml(l,i){
 const x=expenseLineCalc(l),cat=category(l.categoryId);
 return `<div class="ops-line">
  <div><label>Concepto / categoría</label><select onchange="opsExpenseLineField(${i},'categoryId',this.value,true)">${O.categories.map(c=>`<option value="${c.id}" ${l.categoryId===c.id?'selected':''}>${h(c.manager_code?c.manager_code+' · '+c.name:c.name)}</option>`).join('')}</select><input style="margin-top:6px" placeholder="Detalle opcional" value="${h(l.description)}" oninput="opsExpenseLineField(${i},'description',this.value)"></div>
  <div><label>Base</label><input inputmode="decimal" value="${h(l.base)}" oninput="opsExpenseLineField(${i},'base',this.value,true)"></div>
  <div><label>IVA %</label><input inputmode="decimal" value="${h(l.vat)}" oninput="opsExpenseLineField(${i},'vat',this.value,true)"></div>
  <div><label>RE %</label><input inputmode="decimal" value="${h(l.re)}" oninput="opsExpenseLineField(${i},'re',this.value,true)"></div>
  <div><label>Retención %</label><input inputmode="decimal" value="${h(l.withholding)}" oninput="opsExpenseLineField(${i},'withholding',this.value,true)"><select style="margin-top:5px" onchange="opsExpenseLineField(${i},'model',this.value)"><option value="">Sin modelo</option><option value="111" ${l.model==='111'?'selected':''}>111</option><option value="115" ${l.model==='115'?'selected':''}>115</option></select></div>
  <button class="ghost" onclick="opsRemoveExpenseLine(${i})" ${O.expenseDraftLines.length===1?'disabled':''}>×</button>
  <div style="grid-column:1/-1" class="small">${h(cat?.aeat_group||'')} · Base ${eur(x.base)} · IVA ${eur(x.vat)} · RE ${eur(x.re)} · Ret. ${eur(x.withholding)} · <b>Imputable IRPF ${eur(x.imputable)}</b></div>
 </div>`;
}
window.opsExpenseField=(k,v,rer=false)=>{O.expenseDraft[k]=v;if(k==='managementOnly'&&v){O.expenseDraftLines.forEach(l=>{l.deductible=false;l.vat='0';l.re='0';l.withholding='0';l.model=''})}if(rer)render();};
window.opsExpenseLineField=function(i,k,v,recalc=false){
 const l=O.expenseDraftLines[i]; if(!l)return;l[k]=v;
 if(k==='categoryId'){
  const c=category(v);
  l.deductible=c?.deductible_default!==false;
  if(c?.code==='MERCH'){l.vat='21';l.re='5,2';l.withholding='0';l.model=''}
  else if(c?.code==='RENT'){l.vat='21';l.re='0';l.withholding='19';l.model='115'}
  else if(['BANK','INSURANCE','RETA','PAYROLL','SOCIAL','INTERNAL_OVERTIME','INTERNAL_WAREHOUSE'].includes(c?.code)){l.vat='0';l.re='0';l.withholding='0';l.model=''}
  if(['INTERNAL_OVERTIME','INTERNAL_WAREHOUSE'].includes(c?.code)) O.expenseDraft.managementOnly=true;
  l.fixed=!!c?.fixed_asset_default;
 }
 if(recalc)render();
};
window.opsAddExpenseLine=function(){O.expenseDraftLines.push(defaultExpenseLine());render()};
window.opsRemoveExpenseLine=function(i){if(O.expenseDraftLines.length>1){O.expenseDraftLines.splice(i,1);render()}};
window.opsQuickInternal=function(kind){
 const d=O.expenseDraft||(O.expenseDraft=newExpenseDraft());
 const code=kind==='warehouse'?'INTERNAL_WAREHOUSE':'INTERNAL_OVERTIME';
 const c=O.categories.find(x=>x.code===code);
 d.managementOnly=true;d.documentKind='otro';d.taxId='';d.invoice='';d.fiscalReviewed=false;d.paidStatus='pagado';d.paidDate=d.date||isoToday();
 d.supplier=kind==='warehouse'?'Almacén':'Horas extra empleados';
 O.expenseDraftLines=[{id:null,categoryId:c?.id||'',description:kind==='warehouse'?'Pago interno de almacén':'Horas extra / pago interno de personal',base:kind==='warehouse'?'300':'',vat:'0',re:'0',withholding:'0',model:'',deductible:false,fixed:false}];
 d.amountPaid=kind==='warehouse'?'300':'';
 render();
};
window.opsNewExpense=function(){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];render()};
window.opsEditExpense=function(id){
 const e=O.expenses.find(x=>x.id===id);if(!e)return;
 O.expenseDraft={id:e.id,storeId:e.store_id||'',date:e.expense_date,supplier:e.supplier_name||'',taxId:e.supplier_tax_id||'',invoice:e.invoice_number||'',documentKind:e.document_kind||'factura',payment:e.payment_method||'transferencia',paidStatus:e.paid_status||'pagado',paidDate:e.paid_date||'',amountPaid:String(e.amount_paid??''),notes:e.notes||'',fiscalReviewed:!!e.fiscal_reviewed,managementOnly:!!e.management_only};
 const lines=O.expenseLines.filter(x=>x.expense_id===id);O.expenseDraftLines=lines.length?lines.map(l=>({id:l.id,categoryId:l.category_id||'',description:l.description||'',base:String(l.base_amount??''),vat:String(l.vat_rate??0).replace('.',','),re:String(l.re_rate??0).replace('.',','),withholding:String(l.withholding_rate??0).replace('.',','),model:l.withholding_model||'',deductible:l.deductible_irpf!==false,fixed:!!l.fixed_asset})): [defaultExpenseLine()];
 render();window.scrollTo({top:0,behavior:'smooth'});
};
async function fileSha256(file){
 const buf=await file.arrayBuffer(); const hash=await crypto.subtle.digest('SHA-256',buf);
 return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function validateDocFile(file){
 if(!file)return true;
 const max=n(O.settings?.document_max_bytes||20971520);
 const ext='.'+String(file.name||'').split('.').pop().toLowerCase();
 const allowedExt=new Set(['.pdf','.jpg','.jpeg','.png','.webp','.xlsx','.xls','.csv']);
 if(file.size>max)throw new Error('El archivo supera el límite de '+Math.round(max/1048576)+' MB.');
 if(!allowedExt.has(ext))throw new Error('Tipo de archivo no permitido. Usa PDF, imagen, Excel o CSV.');
 return true;
}
window.__opsValidateDocumentFile=validateDocFile;
async function uploadDoc(file,meta,linkedType='',linkedId=null){
 if(!file)return null;
 validateDocFile(file);
 const sha=await fileSha256(file);
 const dup=O.documents.find(d=>d.sha256&&d.sha256===sha);
 if(dup&&!confirm('Este archivo parece estar ya guardado como "'+dup.original_name+'". ¿Subirlo otra vez?'))return dup.id;
 const dt=meta.document_date||isoToday(),year=dt.slice(0,4),month=dt.slice(5,7),q='T'+qtrFromDate(dt),sc=meta.store_id?(O.stores.find(s=>s.id===meta.store_id)?.code||'TIENDA'):'GENERAL';
 const kind=b64Safe(meta.doc_type||'otro')||'otro',party=b64Safe(meta.supplier_or_customer||'SIN_PROVEEDOR')||'SIN_PROVEEDOR';
 const path=[year,q,month,sc,kind,party,crypto.randomUUID()+'_'+b64Safe(file.name)].join('/');
 const {error:upErr}=await sb.storage.from('business-documents').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});if(upErr)throw upErr;
 const row={store_id:meta.store_id||null,doc_type:meta.doc_type||'factura_recibida',document_date:dt,supplier_or_customer:meta.supplier_or_customer||'',tax_id:meta.tax_id||'',invoice_number:meta.invoice_number||'',category_code:meta.category_code||'',status:meta.status||'pendiente',storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:sha,linked_entity_type:linkedType,linked_entity_id:linkedId,notes:meta.notes||'',uploaded_by:authSession.user.id};
 const {data,error}=await sb.from('ops_documents').insert(row).select('id').single();if(error){await sb.storage.from('business-documents').remove([path]);throw error}
 return data.id;
}
window.opsSaveExpense=async function(){
 if(O.saving)return;const d=O.expenseDraft;if(!d.date||!d.supplier){alert('Fecha y proveedor son obligatorios.');return}
 if(!O.expenseDraftLines.length||O.expenseDraftLines.every(l=>String(l.base).trim()==='')){alert('Añade al menos una línea con base.');return}
 if(d.invoice){
  const dup=O.expenses.find(e=>e.id!==d.id&&e.supplier_name.trim().toLowerCase()===d.supplier.trim().toLowerCase()&&e.invoice_number.trim().toLowerCase()===d.invoice.trim().toLowerCase());
  if(dup&&!confirm('Ya existe una factura con ese proveedor y número ('+dmy(dup.expense_date)+'). ¿Continuar de todos modos?'))return;
 }
 O.saving=true;
 try{
   const file=document.getElementById('ops_exp_file')?.files?.[0];
   validateDocFile(file);
   const totals=draftExpenseTotals();
   const payload={id:d.id||null,store_id:d.storeId||null,expense_date:d.date,supplier_name:d.supplier.trim(),supplier_tax_id:d.taxId.trim(),invoice_number:d.invoice.trim(),description:O.expenseDraftLines.map(l=>l.description).filter(Boolean).join(' · '),payment_method:d.payment,paid_status:d.paidStatus,paid_date:d.paidStatus==='pendiente'?null:(d.paidDate||d.date),amount_paid:d.amountPaid!==''?n(d.amountPaid):totals.payable,notes:d.notes||'',document_kind:d.documentKind,fiscal_reviewed:d.managementOnly?false:!!d.fiscalReviewed,management_only:!!d.managementOnly};
   const lines=O.expenseDraftLines.map((l,i)=>({sort_order:(i+1)*10,category_id:l.categoryId||null,description:l.description||category(l.categoryId)?.name||'',base_amount:n(l.base),vat_rate:n(l.vat),re_rate:n(l.re),withholding_rate:n(l.withholding),withholding_model:d.managementOnly?null:(l.model||null),deductible_irpf:d.managementOnly?false:l.deductible!==false,deductible_pct:d.managementOnly?0:100,fixed_asset:!!l.fixed,notes:''}));
   const {data:id,error}=await sb.rpc('ops_save_expense',{p_expense:payload,p_lines:lines});if(error)throw error;
   if(file){
     const cat=category(O.expenseDraftLines[0]?.categoryId);
     const docId=await uploadDoc(file,{store_id:d.storeId||null,doc_type:'factura_recibida',document_date:d.date,supplier_or_customer:d.supplier,tax_id:d.taxId,invoice_number:d.invoice,category_code:cat?.manager_code||'',status:d.paidStatus==='pagado'?'pagada':'pendiente',notes:d.notes},'expense',id);
     if(docId)await sb.from('ops_expenses').update({document_id:docId}).eq('id',id);
   }
   await audit('gastos',d.id?'actualizar':'crear',id,{fecha:d.date,proveedor:d.supplier,total:totals.accounting});
   await load(true);O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()];render();
 }catch(e){alert('No se pudo guardar el gasto: '+e.message)}finally{O.saving=false}
};

function docMatches(d){
 const f=O.docFilter;
 return (!f.from||d.document_date>=f.from)&&(!f.to||d.document_date<=f.to)&&(f.store==='all'||d.store_id===f.store)&&(f.status==='all'||d.status===f.status)&&(f.type==='all'||d.doc_type===f.type)&&(!f.q||[d.supplier_or_customer,d.invoice_number,d.original_name,d.notes].join(' ').toLowerCase().includes(f.q.toLowerCase()));
}
window.opsDocFilter=function(k,v,soft=false){O.docFilter[k]=v;if(!soft)render();else{clearTimeout(window.__opsDocTimer);window.__opsDocTimer=setTimeout(render,200)}};
window.opsUploadStandaloneDoc=async function(){
 const file=document.getElementById('ops_doc_file')?.files?.[0];if(!file){alert('Selecciona un archivo.');return}
 try{
  await uploadDoc(file,{store_id:document.getElementById('ops_doc_store').value||null,doc_type:document.getElementById('ops_doc_type').value,document_date:document.getElementById('ops_doc_date').value||isoToday(),supplier_or_customer:document.getElementById('ops_doc_party').value,tax_id:document.getElementById('ops_doc_tax').value,invoice_number:document.getElementById('ops_doc_invoice').value,status:document.getElementById('ops_doc_status').value},'standalone',null);
  await audit('documentos','subir',null,{archivo:file.name});await load(true);render();
 }catch(e){alert('No se pudo subir: '+e.message)}
};
window.opsDownloadDoc=async function(id){
 const d=O.documents.find(x=>x.id===id);if(!d)return;const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);if(error){alert(error.message);return}dlBlob(data,d.original_name);
};
window.opsSetDocStatus=async function(id,status){const {error}=await sb.from('ops_documents').update({status}).eq('id',id);if(error){alert(error.message);return}const d=O.documents.find(x=>x.id===id);if(d)d.status=status;await audit('documentos','estado',id,{status});};

window.opsPlannedSpend=function(v){O.plannedSpend=v;clearTimeout(window.__opsPlanTimer);window.__opsPlanTimer=setTimeout(render,150)};
function docArchiveFolder(d,root='04_DOCUMENTOS'){
 const dt=d.document_date||'sin_fecha',year=dt.slice(0,4)||'SIN_ANO',month=dt.slice(5,7)||'SIN_MES';
 const q=dt&&dt.length>=7?'T'+qtrFromDate(dt):'SIN_TRIMESTRE';
 const store=d.store_id?(O.stores.find(s=>s.id===d.store_id)?.code||'TIENDA'):'GENERAL';
 const type=b64Safe(d.doc_type||'otro')||'otro';
 const party=b64Safe(d.supplier_or_customer||'SIN_PROVEEDOR')||'SIN_PROVEEDOR';
 return [root,year,q,month,store,type,party].join('/');
}
async function zipDocs(docs,zip,root='04_DOCUMENTOS'){
 let done=0;
 const sorted=[...docs].sort((a,b)=>String(a.document_date||'').localeCompare(String(b.document_date||''))||String(a.supplier_or_customer||'').localeCompare(String(b.supplier_or_customer||'')));
 for(const d of sorted){
  const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);if(error)continue;
  const inv=b64Safe(d.invoice_number||'SIN_NUMERO')||'SIN_NUMERO';
  const original=b64Safe(d.original_name||'documento')||'documento';
  const name=`${d.document_date||'sin_fecha'}_${inv}_${original}`;
  zip.file(docArchiveFolder(d,root)+'/'+name,data);done++;
 }
 return done;
}
window.opsZipFilteredDocs=async function(){
 if(!window.JSZip){alert('ZIP no disponible.');return}
 const docs=O.documents.filter(docMatches);if(!docs.length){alert('No hay documentos con esos filtros.');return}
 const z=new JSZip();
 await zipDocs(docs,z,'DOCUMENTOS');
 dlBlob(await z.generateAsync({type:'blob'}),`documentos_filtrados_${isoToday()}.zip`);
};
window.opsZipReportDocs=async function(){
 if(!window.JSZip)return alert('ZIP no disponible.');
 const docs=O.documents.filter(d=>inRange(d.document_date,O.reportFrom,O.reportTo));
 if(!docs.length)return alert('No hay documentos en esa franja.');
 const z=new JSZip();
 await zipDocs(docs,z,'DOCUMENTOS');
 dlBlob(await z.generateAsync({type:'blob'}),`documentos_${O.reportFrom}_${O.reportTo}.zip`);
};
window.opsSaveSettings=async function(){
 if(!adminOnly())return;
 const row={business_name:document.getElementById('ops_set_name').value,business_address:document.getElementById('ops_set_address').value,business_email:document.getElementById('ops_set_email').value,business_phone:document.getElementById('ops_set_phone').value,tax_id:document.getElementById('ops_set_tax').value,actual_reta_monthly:n(document.getElementById('ops_set_reta').value)||null,previous_year_net_income:n(document.getElementById('ops_set_prevnet').value)||null,current_year:O.year};
 const {error}=await sb.from('ops_business_settings').update(row).eq('id',1);if(error){alert(error.message);return}await audit('config','actualizar',null,{});await load(true);render();
};

window.opsTab=function(tab){O.tab=tab;if(tab==='cajas'&&!O.closeDraft)O.closeDraft=newClosingDraft();if(tab==='gastos'&&!O.expenseDraft){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}render();window.scrollTo({top:0,behavior:'smooth'})};
window.opsSetYear=function(v){O.year=+v;O.reportFrom=`${O.year}-01-01`;O.reportTo=`${O.year}-12-31`;O.invoiceDraft=null;render()};
window.opsSetQuarter=function(v){O.quarter=+v;render()};
window.opsSetStore=function(v){O.storeId=v;O.closeDraft=null;O.expenseDraft=null;O.invoiceDraft=null;render()};

window.goOps=async function(tab='resumen'){
 O.tab=tab||'resumen';
 state.page='management';state.familyId=null;state.productId=null;state.dirty=false;
 render();
 try{
   await load();
   await window.TotusGestionFeatures?.load?.();
   if(O.tab==='cajas'&&(!O.closeDraft?.storeId||!O.stores.some(s=>s.id===O.closeDraft.storeId)))O.closeDraft=newClosingDraft();
   if(O.tab==='gastos'&&(!O.expenseDraft?.storeId||!O.stores.some(s=>s.id===O.expenseDraft.storeId))){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}
   render();
 }catch(e){document.getElementById('main').innerHTML=`<div class="head"><div><div class="eyebrow">${sectionMeta()[1]}</div><h1>No se pudo cargar ${sectionMeta()[0].toLowerCase()}</h1><p>${h(e.message)}</p></div></div>`}
};

const pricingRender=render;
render=function(){
 if(state.page==='management'){
   document.querySelectorAll('.nav button').forEach(b=>{
     const active=b.dataset.opsTab===O.tab || (b.dataset.page==='admin'&&O.tab==='config');
     b.classList.toggle('active',active);
   });
   document.querySelector('.search')?.classList.add('hidden');
   document.getElementById('savebar')?.classList.add('hidden');
   const m=document.getElementById('main');if(m)m.innerHTML=managementHtml();
   return;
 }
 pricingRender();
};

})();