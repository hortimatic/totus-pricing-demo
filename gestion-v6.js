
(function(){
'use strict';

const O=window.TotusGestion={
  loaded:false,loading:false,tab:'resumen',
  year:new Date().getFullYear(),quarter:Math.floor(new Date().getMonth()/3)+1,storeId:'all',
  settings:null,stores:[],categories:[],documents:[],expenses:[],expenseLines:[],
  closings:[],drawers:[],closingDrawers:[],series:[],invoices:[],invoiceLines:[],
  taxPayments:[],retaBrackets:[],fiscalAdjustments:[],incomeAdjustments:[],
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
  const good=['pagado','pagada','entregada_gestor','archivada','emitida','cerrado','revisada'];
  const bad=['anulada','fallido'];
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

async function load(force=false){
  if(O.loading)return;
  if(O.loaded&&!force)return;
  O.loading=true;
  try{
    const [settings,stores,categories,documents,expenses,expenseLines,closings,drawers,closingDrawers,series,invoices,invoiceLines,taxPayments,retaBrackets,fiscalAdjustments,incomeAdjustments]=await Promise.all([
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
      selectAll('ops_income_adjustments','income_date',false)
    ]);
    O.settings=settings[0]||{};
    O.stores=stores.filter(x=>x.active!==false);
    O.categories=categories.filter(x=>x.active!==false);
    O.documents=documents; O.expenses=expenses; O.expenseLines=expenseLines;
    O.closings=closings; O.drawers=drawers.filter(x=>x.active!==false); O.closingDrawers=closingDrawers;
    O.series=series; O.invoices=invoices; O.invoiceLines=invoiceLines; O.taxPayments=taxPayments;
    O.retaBrackets=retaBrackets; O.fiscalAdjustments=fiscalAdjustments; O.incomeAdjustments=incomeAdjustments;
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
function invoiceIncome(from,to,store='all'){
  return O.invoices.filter(x=>x.status==='emitida'&&x.include_in_income&&inRange(x.issue_date,from,to)&&(store==='all'||x.store_id===store));
}
function extraIncome(from,to,store='all'){
  return O.incomeAdjustments.filter(x=>inRange(x.income_date,from,to)&&(store==='all'||x.store_id===store));
}
function incomeFor(from,to,store='all'){
  return sum(filteredClosings(from,to,store),x=>n(x.cash_sales)+n(x.card_sales)+n(x.bizum_sales)+n(x.online_sales)+n(x.other_income))
    +sum(invoiceIncome(from,to,store),x=>n(x.total_amount))
    +sum(extraIncome(from,to,store),x=>n(x.amount));
}
function expenseLineMap(){ const m=new Map(); O.expenseLines.forEach(l=>{if(!m.has(l.expense_id))m.set(l.expense_id,[]);m.get(l.expense_id).push(l)}); return m; }
function expenseFor(from,to,store='all',onlyDeductible=true){
  const map=expenseLineMap();
  let total=0;
  O.expenses.filter(e=>inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)&&(!onlyDeductible||!e.management_only)).forEach(e=>{
    const lines=map.get(e.id)||[];
    if(lines.length){
      total+=sum(lines,l=>{
        if(onlyDeductible&&!l.deductible_irpf)return 0;
        if(l.fixed_asset)return 0;
        return n(l.irpf_imputable);
      });
    } else {
      if(!onlyDeductible||e.deductible_irpf!==false) total+=n(e.accounting_amount||e.gross_expense);
    }
  });
  O.fiscalAdjustments.filter(a=>inRange(a.adjustment_date,from,to)&&['gasto_deducible_extra','amortizacion'].includes(a.kind))
    .forEach(a=>total+=n(a.amount));
  return total;
}
function managementExpenseFor(from,to,store='all'){
  return O.expenses
    .filter(e=>inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store))
    .reduce((a,e)=>a+n(e.accounting_amount||e.gross_expense||e.amount_paid),0);
}
function internalExpenseFor(from,to,store='all'){
  return O.expenses
    .filter(e=>e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store))
    .reduce((a,e)=>a+n(e.accounting_amount||e.gross_expense||e.amount_paid),0);
}
function retaPaid(from,to){
  const retaCat=O.categories.find(c=>c.code==='RETA');
  if(!retaCat)return 0;
  const map=expenseLineMap(); let total=0;
  O.expenses.filter(e=>inRange(e.expense_date,from,to)).forEach(e=>{
    (map.get(e.id)||[]).filter(l=>l.category_id===retaCat.id).forEach(l=>total+=n(l.irpf_imputable)||n(l.base_amount));
  });
  return total;
}
function taxWithheld(model,from,to){
  const ids=new Set(O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)).map(e=>e.id));
  return sum(O.expenseLines.filter(l=>ids.has(l.expense_id)&&l.withholding_model===model),l=>n(l.withholding_amount));
}
function supportedWithholding(from,to){
  return sum(O.fiscalAdjustments.filter(a=>a.kind==='retencion_soportada'&&inRange(a.adjustment_date,from,to)),a=>n(a.amount));
}
function difficultExpense(pre){
  if(!O.settings?.difficult_expense_enabled||pre<=0)return 0;
  return Math.min(pre*(n(O.settings.difficult_expense_pct||5)/100),n(O.settings.difficult_expense_annual_cap||2000));
}
function fiscal(year=O.year,quarter=O.quarter,planned=0){
  const acc=periodBounds(year,quarter,true),cur=periodBounds(year,quarter,false);
  const incomeAcc=incomeFor(acc.start,acc.end,'all');
  const expRaw=expenseFor(acc.start,acc.end,'all')+n(planned);
  const pre=Math.max(0,incomeAcc-expRaw);
  const difficult=difficultExpense(pre);
  const deductible=expRaw+difficult;
  const net=incomeAcc-deductible;
  const box4=Math.max(net,0)*(n(O.settings?.irpf_prepayment_rate||20)/100);
  const previous=sum(O.taxPayments.filter(t=>t.tax_type==='130'&&t.fiscal_year===year&&n(t.quarter)<quarter&&t.status==='pagado'),t=>n(t.amount));
  const ret=supportedWithholding(acc.start,acc.end);
  const box7=box4-previous-ret;
  const payable=Math.max(0,box7);
  const qIncome=incomeFor(cur.start,cur.end,'all'),qExpense=expenseFor(cur.start,cur.end,'all');
  const m111=taxWithheld('111',cur.start,cur.end),m115=taxWithheld('115',cur.start,cur.end);
  const reserve=payable+m111+m115;
  return {acc,cur,incomeAcc,expRaw,difficult,deductible,net,box4,previous,ret,box7,payable,qIncome,qExpense,m111,m115,reserve};
}
function currentCutoff(){
  const now=new Date(), y=O.year, q=O.quarter, pb=periodBounds(y,q,false);
  if(y===now.getFullYear()&&q===Math.floor(now.getMonth()/3)+1)return isoToday();
  return pb.end;
}
function retaEstimate(){
  const from=`${O.year}-01-01`, cutoff=currentCutoff();
  const inc=incomeFor(from,cutoff,'all'),exp=expenseFor(from,cutoff,'all');
  const pre=Math.max(0,inc-exp),dif=difficultExpense(pre),irpfNet=inc-exp-dif;
  const paidReta=retaPaid(from,cutoff);
  const start=new Date(from+'T00:00:00'),end=new Date(cutoff+'T00:00:00');
  const days=Math.max(1,Math.round((end-start)/86400000)+1);
  const yearDays=((O.year%4===0&&O.year%100!==0)||O.year%400===0)?366:365;
  const projectedIrpfNet=(irpfNet/days)*yearDays;
  const projectedReta=(paidReta/days)*yearDays;
  const computable=(projectedIrpfNet+projectedReta)*(1-n(O.settings?.reta_generic_deduction_pct||7)/100);
  const monthly=computable/12;
  const brackets=O.retaBrackets.filter(b=>b.year===O.year);
  const bracket=brackets.find(b=>{
    const lo=b.min_net_monthly==null||monthly>n(b.min_net_monthly)||(b.min_inclusive&&monthly>=n(b.min_net_monthly));
    const hi=b.max_net_monthly==null||monthly<n(b.max_net_monthly)||(b.max_inclusive&&monthly<=n(b.max_net_monthly));
    return lo&&hi;
  })||brackets[brackets.length-1];
  const rate=n(O.settings?.reta_total_rate||31.5)/100;
  return {monthly,computable,projectedIrpfNet,projectedReta,bracket,minQuota:bracket?n(bracket.min_base)*rate:0,maxQuota:bracket?n(bracket.max_base)*rate:0,actual:n(O.settings?.actual_reta_monthly)};
}

function navHtml(){
 const tabs=[['resumen','Resumen'],['cajas','Cajas'],['gastos','Gastos'],['facturas','Facturas'],['documentos','Documentos'],['fiscal','Fiscalidad'],['informes','Informes'],['config','Configuración']];
 return `<div class="ops-tabs">${tabs.map(([id,t])=>`<button class="${O.tab===id?'active':''}" onclick="opsTab('${id}')">${t}</button>`).join('')}</div>`;
}
function headerHtml(){
 return `<div class="head"><div><div class="eyebrow">Operativa y contabilidad</div><h1>Gestión</h1><p>Cajas, gastos, facturas, fiscalidad e informes de Hortimatic y NewOldSmok en un solo sitio.</p></div><div class="ops-filters"><div><label>Año</label><select onchange="opsSetYear(this.value)">${[2025,2026,2027,2028].map(y=>`<option ${O.year==y?'selected':''}>${y}</option>`).join('')}</select></div><div><label>Trimestre</label><select onchange="opsSetQuarter(this.value)">${[1,2,3,4].map(q=>`<option value="${q}" ${O.quarter==q?'selected':''}>T${q}</option>`).join('')}</select></div><div><label>Establecimiento</label><select onchange="opsSetStore(this.value)"><option value="all">Ambos</option>${O.stores.map(s=>`<option value="${s.id}" ${O.storeId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div></div></div>`;
}
function managementHtml(){
 if(!O.loaded)return `<div class="head"><div><div class="eyebrow">Gestión</div><h1>Preparando datos…</h1><p>Un momento.</p></div></div><div class="ops-card">Cargando cajas, gastos, documentos y fiscalidad…</div>`;
 let body='';
 if(O.tab==='resumen')body=dashboardHtml();
 if(O.tab==='cajas')body=closingsHtml();
 if(O.tab==='gastos')body=expensesHtml();
 if(O.tab==='facturas')body=window.BillingV7?window.BillingV7.html():invoicesHtml();
 if(O.tab==='documentos')body=documentsHtml();
 if(O.tab==='fiscal')body=fiscalHtml();
 if(O.tab==='informes')body=reportsHtml();
 if(O.tab==='config')body=configHtml();
 return `<div class="ops-wrap">${headerHtml()}${navHtml()}${body}</div>`;
}
window.opsManagementHtml=managementHtml;

function dashboardHtml(){
 const pb=periodBounds(O.year,O.quarter,false),store=O.storeId;
 const inc=incomeFor(pb.start,pb.end,store),exp=expenseFor(pb.start,pb.end,store),internal=internalExpenseFor(pb.start,pb.end,store),realExp=managementExpenseFor(pb.start,pb.end,store),benefFiscal=inc-exp,benefReal=inc-realExp;
 const f=fiscal(),r=retaEstimate(),usage=sum(O.documents,d=>n(d.size_bytes)),limit=n(O.settings?.storage_limit_bytes||1073741824),pct=limit?usage/limit*100:0;
 const recent=O.closings.filter(x=>x.business_date.startsWith(String(O.year))).slice(0,6);
 return `<div class="ops-kpis">
  <div class="ops-kpi"><small>Ingresos T${O.quarter}</small><strong>${eur(inc)}</strong><div class="sub">${store==='all'?'Ambos establecimientos':h(storeName(store))}</div></div>
  <div class="ops-kpi"><small>Gastos fiscales T${O.quarter}</small><strong>${eur(exp)}</strong><div class="sub">Los que entran en cálculo fiscal</div></div>
  <div class="ops-kpi"><small>Gastos internos T${O.quarter}</small><strong>${eur(internal)}</strong><div class="sub">No se envían a gestoría</div></div>
  <div class="ops-kpi ${benefReal>=0?'good':'bad'}"><small>Resultado real interno T${O.quarter}</small><strong>${eur(benefReal)}</strong><div class="sub">Ingresos menos todos los gastos registrados</div></div>
  <div class="ops-kpi warn"><small>Reserva fiscal estimada</small><strong>${eur(f.reserve)}</strong><div class="sub">130 + 111 + 115</div></div>
  <div class="ops-kpi"><small>RETA estimado</small><strong>${r.bracket?eur(r.minQuota)+'–'+eur(r.maxQuota):'—'}</strong><div class="sub">Rendimiento mensual ${eur(r.monthly)}</div></div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trimestre</div><h3>IRPF y retenciones</h3></div><button class="ghost" onclick="opsTab('fiscal')">Ver fiscalidad</button></div>
   <div class="ops-metric-line"><span>Ingresos acumulados año → T${O.quarter}</span><b>${eur(f.incomeAcc)}</b></div>
   <div class="ops-metric-line"><span>Gastos + difícil justificación</span><b>${eur(f.deductible)}</b></div>
   <div class="ops-metric-line"><span>Modelo 130 estimado pendiente</span><b>${eur(f.payable)}</b></div>
   <div class="ops-metric-line"><span>Modelo 111 del trimestre</span><b>${eur(f.m111)}</b></div>
   <div class="ops-metric-line"><span>Modelo 115 del trimestre</span><b>${eur(f.m115)}</b></div>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Servidor</div><h3>Documentos</h3></div><button class="ghost" onclick="opsTab('documentos')">Abrir archivo</button></div>
   <div class="ops-space-head"><div><b>${fmtInt(usage/1024/1024)} MB</b> usados</div><div class="small">${pct.toFixed(1).replace('.',',')} % de ${fmtInt(limit/1024/1024)} MB</div></div>
   <div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div>
   <div class="ops-metric-line"><span>Documentos guardados</span><b>${O.documents.length}</b></div>
   <div class="ops-metric-line"><span>Pendientes para gestor</span><b>${O.documents.filter(d=>!['entregada_gestor','archivada'].includes(d.status)).length}</b></div>
  </div>
 </div>
 <div class="ops-grid">
   <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Cajas</div><h3>Últimos cierres</h3></div><button class="primary" onclick="opsTab('cajas')">Nuevo cierre</button></div>
    ${recent.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Tienda</th><th>Ventas</th><th>Caja final</th></tr></thead><tbody>${recent.map(c=>`<tr><td>${dmy(c.business_date)}</td><td>${h(storeName(c.store_id))}</td><td class="num">${eur(n(c.cash_sales)+n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income))}</td><td class="num">${eur(c.actual_cash)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">Aún no hay cierres.</div>'}
   </div>
   <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Accesos rápidos</div><h3>Trabajo diario</h3></div></div>
    <div class="ops-actions"><button class="primary" onclick="opsTab('cajas')">Cerrar caja</button><button class="secondary" onclick="opsTab('gastos')">Registrar gasto</button><button class="secondary" onclick="opsTab('facturas')">Crear factura</button><button class="secondary" onclick="opsTab('documentos')">Subir documento</button></div>
    <div class="ops-note" style="margin-top:12px">Los cierres sustituyen el chat y las hojas mensuales. El saldo final de cada caja se propone como apertura del siguiente día.</div>
   </div>
 </div>`;
}

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
   const row={store_id:d.storeId,business_date:d.date,opening_cash:c.opening,cash_sales:c.cashSales,card_sales:n(d.card),bizum_sales:n(d.bizum),online_sales:n(d.online),other_income:n(d.other),cash_withdrawals:n(d.withdrawals),cash_expenses_declared:n(d.cashExpenses),expected_cash:c.closing,actual_cash:c.closing,difference:0,notes:d.notes||'',status,created_by:authSession.user.id,closed_by:status==='cerrado'?authSession.user.id:null,source:'manual',legacy_cash_method:false};
   let id=d.id;
   if(id){const {error}=await sb.from('ops_daily_closings').update(row).eq('id',id);if(error)throw error;await sb.from('ops_daily_closing_drawers').delete().eq('closing_id',id)}
   else{const {data,error}=await sb.from('ops_daily_closings').insert(row).select('id').single();if(error)throw error;id=data.id}
   const drawerRows=ds.map(dr=>{const x=closingDrawerState(d,dr);return{closing_id:id,drawer_id:dr.id,opening_cash:n(x.opening),closing_cash:n(x.closing)}});
   const {error:de}=await sb.from('ops_daily_closing_drawers').insert(drawerRows);if(de)throw de;
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
async function uploadDoc(file,meta,linkedType='',linkedId=null){
 if(!file)return null;
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
   const totals=draftExpenseTotals();
   const row={store_id:d.storeId||null,expense_date:d.date,supplier_name:d.supplier.trim(),supplier_tax_id:d.taxId.trim(),invoice_number:d.invoice.trim(),description:O.expenseDraftLines.map(l=>l.description).filter(Boolean).join(' · '),payment_method:d.payment,paid_status:d.paidStatus,paid_date:d.paidStatus==='pendiente'?null:(d.paidDate||d.date),base_amount:Math.max(0,totals.accounting),vat_rate:0,vat_amount:0,re_rate:0,re_amount:0,withholding_rate:0,withholding_amount:0,withholding_model:null,gross_expense:Math.max(0,totals.accounting),amount_paid:Math.max(0,d.amountPaid!==''?n(d.amountPaid):totals.payable),deductible_irpf:true,deductible_pct:100,fixed_asset:false,notes:d.notes||'',created_by:authSession.user.id,document_kind:d.documentKind,source:'manual',fiscal_reviewed:d.managementOnly?false:!!d.fiscalReviewed,accounting_amount:totals.accounting,management_only:!!d.managementOnly};
   let id=d.id;
   if(id){const {error}=await sb.from('ops_expenses').update(row).eq('id',id);if(error)throw error;await sb.from('ops_expense_lines').delete().eq('expense_id',id)}
   else{const {data,error}=await sb.from('ops_expenses').insert(row).select('id').single();if(error)throw error;id=data.id}
   const lines=O.expenseDraftLines.map((l,i)=>{const x=expenseLineCalc(l),cat=category(l.categoryId);return{expense_id:id,sort_order:(i+1)*10,category_id:l.categoryId||null,description:l.description||cat?.name||'',base_amount:x.base,vat_rate:x.vatRate,vat_amount:x.vat,re_base:x.reRate?x.base:0,re_rate:x.reRate,re_amount:x.re,irpf_imputable:x.imputable,withholding_base:x.wRate?x.base:0,withholding_rate:x.wRate,withholding_amount:x.withholding,withholding_model:d.managementOnly?null:(l.model||null),deductible_irpf:d.managementOnly?false:l.deductible!==false,deductible_pct:d.managementOnly?0:100,fixed_asset:!!l.fixed,notes:''}});
   const {error:le}=await sb.from('ops_expense_lines').insert(lines);if(le)throw le;
   const file=document.getElementById('ops_exp_file')?.files?.[0];
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
function documentsHtml(){
 const usage=sum(O.documents,d=>n(d.size_bytes)),limit=n(O.settings?.storage_limit_bytes||1073741824),pct=limit?usage/limit*100:0;
 const rows=O.documents.filter(docMatches).slice(0,300);
 return `<div class="ops-grid">
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Archivo</div><h3>Subir documento</h3></div><button class="primary" onclick="opsUploadStandaloneDoc()">Subir</button></div>
  <div class="ops-form">
   <div><label>Fecha</label><input id="ops_doc_date" type="date" value="${isoToday()}"></div>
   <div><label>Tienda</label><select id="ops_doc_store"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}">${h(s.name)}</option>`).join('')}</select></div>
   <div><label>Tipo</label><select id="ops_doc_type"><option value="factura_recibida">Factura recibida</option><option value="factura_emitida">Factura emitida</option><option value="ticket">Ticket</option><option value="contrato">Contrato</option><option value="impuesto">Impuesto</option><option value="informe">Informe</option><option value="otro">Otro</option></select></div>
   <div><label>Estado</label><select id="ops_doc_status"><option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="revisada">Revisada</option><option value="preparada_gestor">Preparada gestor</option><option value="entregada_gestor">Entregada gestor</option><option value="archivada">Archivada</option></select></div>
   <div><label>Proveedor / cliente</label><input id="ops_doc_party"></div><div><label>NIF/CIF</label><input id="ops_doc_tax"></div><div><label>Nº factura</label><input id="ops_doc_invoice"></div>
   <div><label>Archivo</label><input id="ops_doc_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"></div>
  </div>
 </div>
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Espacio</div><h3>${fmtInt(usage/1024/1024)} MB / ${fmtInt(limit/1024/1024)} MB</h3></div><span class="badge ${pct>=95?'badb':pct>=80?'warnb':'ok'}">${pct.toFixed(1).replace('.',',')} %</span></div><div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="small" style="margin-top:10px">El contador corresponde al archivo de Gestión registrado por la aplicación.</div></div>
 </div>
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Documentos</div><h3>Buscar y descargar</h3></div><div class="ops-actions"><button class="secondary" onclick="opsZipFilteredDocs()">ZIP filtrado</button></div></div>
 <div class="ops-filters"><div><label>Desde</label><input type="date" value="${h(O.docFilter.from)}" onchange="opsDocFilter('from',this.value)"></div><div><label>Hasta</label><input type="date" value="${h(O.docFilter.to)}" onchange="opsDocFilter('to',this.value)"></div><div><label>Tienda</label><select onchange="opsDocFilter('store',this.value)"><option value="all">Todas</option>${O.stores.map(s=>`<option value="${s.id}" ${O.docFilter.store===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div><div><label>Estado</label><select onchange="opsDocFilter('status',this.value)"><option value="all">Todos</option>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option ${O.docFilter.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div style="flex:1"><label>Buscar</label><input value="${h(O.docFilter.q)}" oninput="opsDocFilter('q',this.value,true)" placeholder="Proveedor, número, archivo…"></div></div>
 ${rows.length?`<div class="ops-table-wrap" style="margin-top:12px"><table class="ops-table"><thead><tr><th>Fecha</th><th>Tienda</th><th>Tipo</th><th>Proveedor / cliente</th><th>Número</th><th>Archivo</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td>${dmy(d.document_date)}</td><td>${h(storeName(d.store_id))}</td><td>${h(d.doc_type.replaceAll('_',' '))}</td><td>${h(d.supplier_or_customer||'—')}</td><td>${h(d.invoice_number||'—')}</td><td>${h(d.original_name)}<div class="ops-tiny">${fmtInt(n(d.size_bytes)/1024)} KB</div></td><td><select onchange="opsSetDocStatus('${d.id}',this.value)">${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option ${d.status===x?'selected':''}>${x}</option>`).join('')}</select></td><td><button class="ghost" onclick="opsDownloadDoc('${d.id}')">Descargar</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos con esos filtros.</div>'}
 </div>`;
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

function newInvoiceDraft(){
 const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
 const series=O.series.find(s=>s.store_id===sid&&s.year===O.year&&s.active)||O.series.find(s=>s.year===O.year&&s.active);
 return {id:null,origin:'totus',seriesId:series?.id||'',storeId:sid,date:isoToday(),externalNumber:'',customer:'',taxId:'',address:'',email:'',concept:'',payment:'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,notes:''};
}
function defaultInvoiceLine(){return{description:'',qty:'1',unit:'',discount:'0',vat:'21'};}
function invLineCalc(l){const qty=n(l.qty)||0,unit=n(l.unit),disc=n(l.discount),base=qty*unit*(1-disc/100),vat=base*n(l.vat)/100;return{base,vat,total:base+vat}}
function invoiceDraftTotals(){return O.invoiceDraftLines.reduce((a,l)=>{const x=invLineCalc(l);a.base+=x.base;a.vat+=x.vat;a.total+=x.total;return a},{base:0,vat:0,total:0})}
function invoicesHtml(){
 if(!O.invoiceDraft){O.invoiceDraft=newInvoiceDraft();O.invoiceDraftLines=[defaultInvoiceLine()]}
 const d=O.invoiceDraft,t=invoiceDraftTotals();const rows=O.invoices.filter(x=>x.issue_date.startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)).slice(0,150);
 const series=O.series.filter(s=>s.year===O.year&&s.active&&(d.storeId?(!s.store_id||s.store_id===d.storeId):true));
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">${d.origin==='externa'?'Registrar':'Crear'} factura</div><h3>Facturación ${O.year}</h3><div class="small">Numeración controlada por serie y año. Las facturas emitidas no se reescriben.</div></div><div class="ops-actions"><button class="primary" onclick="opsSaveInvoice()">${d.origin==='externa'?'Registrar externa':'Guardar borrador'}</button></div></div>
 <div class="ops-form">
  <div><label>Origen</label><select onchange="opsInvoiceField('origin',this.value,true)"><option value="totus" ${d.origin==='totus'?'selected':''}>Crear en Totus</option><option value="externa" ${d.origin==='externa'?'selected':''}>Creada fuera</option></select></div>
  <div><label>Fecha emisión</label><input type="date" value="${h(d.date)}" oninput="opsInvoiceField('date',this.value)"></div>
  <div><label>Establecimiento</label><select onchange="opsInvoiceField('storeId',this.value,true)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select></div>
  <div><label>Serie</label><select onchange="opsInvoiceField('seriesId',this.value)">${series.map(s=>`<option value="${s.id}" ${d.seriesId===s.id?'selected':''}>${h(s.code)} · siguiente ${h(s.prefix)}${String(s.next_number).padStart(s.padding,'0')}</option>`).join('')}</select></div>
  ${d.origin==='externa'?`<div><label>Número usado fuera</label><input inputmode="numeric" value="${h(d.externalNumber)}" oninput="opsInvoiceField('externalNumber',this.value)" placeholder="Ej. 27"></div>`:''}
  <div><label>Cliente</label><input value="${h(d.customer)}" oninput="opsInvoiceField('customer',this.value)"></div><div><label>NIF/CIF</label><input value="${h(d.taxId)}" oninput="opsInvoiceField('taxId',this.value)"></div>
  <div class="span2"><label>Dirección</label><input value="${h(d.address)}" oninput="opsInvoiceField('address',this.value)"></div><div><label>Email</label><input type="email" value="${h(d.email)}" oninput="opsInvoiceField('email',this.value)"></div>
  <div><label>Forma de pago</label><select onchange="opsInvoiceField('payment',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="span2"><label>Concepto general</label><input value="${h(d.concept)}" oninput="opsInvoiceField('concept',this.value)"></div>
  <div class="span4 checkline"><input id="ops_inv_income" type="checkbox" ${d.includeIncome?'checked':''} onchange="opsInvoiceField('includeIncome',this.checked)"><label for="ops_inv_income" style="margin:0">Añadir a ingresos fiscales (solo si esta venta NO está ya incluida en los cierres diarios)</label></div>
 </div>
 <div class="section-head" style="margin-top:16px"><div><h4>Líneas</h4></div><button class="secondary" onclick="opsAddInvoiceLine()">Añadir línea</button></div>
 <div class="ops-lines">${O.invoiceDraftLines.map((l,i)=>`<div class="ops-line"><div><label>Descripción</label><input value="${h(l.description)}" oninput="opsInvoiceLineField(${i},'description',this.value)"></div><div><label>Cant.</label><input inputmode="decimal" value="${h(l.qty)}" oninput="opsInvoiceLineField(${i},'qty',this.value,true)"></div><div><label>Precio base</label><input inputmode="decimal" value="${h(l.unit)}" oninput="opsInvoiceLineField(${i},'unit',this.value,true)"></div><div><label>Dto %</label><input inputmode="decimal" value="${h(l.discount)}" oninput="opsInvoiceLineField(${i},'discount',this.value,true)"></div><div><label>IVA %</label><input inputmode="decimal" value="${h(l.vat)}" oninput="opsInvoiceLineField(${i},'vat',this.value,true)"></div><button class="ghost" onclick="opsRemoveInvoiceLine(${i})" ${O.invoiceDraftLines.length===1?'disabled':''}>×</button><div style="grid-column:1/-1" class="small">Total línea ${eur(invLineCalc(l).total)}</div></div>`).join('')}</div>
 <div class="ops-invoice-total"><span>Base <b>${eur(t.base)}</b></span><span>IVA <b>${eur(t.vat)}</b></span><span>Total <b>${eur(t.total)}</b></span></div>
 </div>
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>Facturas emitidas y borradores</h3></div></div>
 ${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Origen</th><th></th></tr></thead><tbody>${rows.map(i=>`<tr><td>${dmy(i.issue_date)}</td><td><b>${h(i.display_number||'Borrador')}</b></td><td>${h(i.customer_name||'—')}</td><td>${statusBadge(i.status)}</td><td class="num">${eur(i.total_amount)}</td><td>${h(i.origin)}</td><td><div class="ops-actions">${i.status==='borrador'?`<button class="primary" onclick="opsIssueInvoice('${i.id}')">Emitir</button>`:''}${i.status==='emitida'?`<button class="ghost" onclick="opsInvoicePdf('${i.id}')">PDF</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay facturas este año.</div>'}
 </div>`;
}
window.opsInvoiceField=function(k,v,rerender=false){O.invoiceDraft[k]=v;if(k==='storeId'&&rerender){const s=O.series.find(s=>s.store_id===v&&s.year===O.year&&s.active);if(s)O.invoiceDraft.seriesId=s.id}if(rerender)render()};
window.opsInvoiceLineField=function(i,k,v,recalc=false){O.invoiceDraftLines[i][k]=v;if(recalc){clearTimeout(window.__opsInvTimer);window.__opsInvTimer=setTimeout(render,120)}};
window.opsAddInvoiceLine=function(){O.invoiceDraftLines.push(defaultInvoiceLine());render()};
window.opsRemoveInvoiceLine=function(i){if(O.invoiceDraftLines.length>1){O.invoiceDraftLines.splice(i,1);render()}};
window.opsSaveInvoice=async function(){
 const d=O.invoiceDraft;if(!d.seriesId||!d.date||!d.customer){alert('Serie, fecha y cliente son obligatorios.');return}
 if(O.invoiceDraftLines.some(l=>!l.description||!n(l.qty))){alert('Completa las líneas de la factura.');return}
 try{
  const external=d.origin==='externa',num=external?parseInt(d.externalNumber,10):null,ser=O.series.find(s=>s.id===d.seriesId);
  if(external&&(!num||num<1)){alert('Indica el número de la factura creada fuera.');return}
  const row={series_id:d.seriesId,store_id:d.storeId||null,issue_date:d.date,number:null,display_number:null,external_number_text:external?String(num):null,origin:d.origin,status:'borrador',customer_name:d.customer,customer_tax_id:d.taxId,customer_address:d.address,customer_email:d.email,concept:d.concept,payment_method:d.payment,paid_status:d.paidStatus||'pendiente',paid_date:d.paidDate||null,include_in_income:!!d.includeIncome,notes:d.notes||'',created_by:authSession.user.id};
  const {data,error}=await sb.from('ops_sales_invoices').insert(row).select('id').single();if(error)throw error;
  const lines=O.invoiceDraftLines.map((l,i)=>{const x=invLineCalc(l);return{invoice_id:data.id,sort_order:(i+1)*10,description:l.description,quantity:n(l.qty),unit_price_base:n(l.unit),discount_pct:n(l.discount),vat_rate:n(l.vat),base_amount:x.base,vat_amount:x.vat,total_amount:x.total}});
  const {error:le}=await sb.from('ops_sales_invoice_lines').insert(lines);if(le)throw le;
  if(external){const display=ser.prefix+String(num).padStart(ser.padding,'0');const {error:xe}=await sb.from('ops_sales_invoices').update({number:num,display_number:display,status:'emitida'}).eq('id',data.id);if(xe)throw xe;}
  await audit('facturas',external?'registrar_externa':'crear_borrador',data.id,{cliente:d.customer,total:invoiceDraftTotals().total});
  await load(true);O.invoiceDraft=newInvoiceDraft();O.invoiceDraftLines=[defaultInvoiceLine()];render();
 }catch(e){alert('No se pudo guardar la factura: '+e.message)}
};
window.opsIssueInvoice=async function(id){
 if(!confirm('¿Emitir esta factura? Se asignará el siguiente número de la serie y ya no podrá reescribirse.'))return;
 try{const {data,error}=await sb.rpc('ops_issue_invoice',{p_invoice_id:id});if(error)throw error;await audit('facturas','emitir',id,{numero:data?.display_number||''});await load(true);render();setTimeout(()=>opsInvoicePdf(id,true),100)}catch(e){alert('No se pudo emitir: '+e.message)}
};
async function invoicePdfBlob(id){
 const inv=O.invoices.find(x=>x.id===id);if(!inv)throw new Error('Factura no encontrada');
 const lines=O.invoiceLines.filter(x=>x.invoice_id===id);if(!window.jspdf?.jsPDF)throw new Error('No está disponible el generador PDF');
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
 const s=O.settings||{};doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(s.business_name||'Factura',15,18);doc.setFontSize(10);doc.setFont('helvetica','normal');
 let y=25;[s.tax_id,s.business_address,s.business_email,s.business_phone].filter(Boolean).forEach(v=>{doc.text(String(v),15,y);y+=5});
 doc.setFont('helvetica','bold');doc.text('FACTURA '+(inv.display_number||''),135,18);doc.setFont('helvetica','normal');doc.text('Fecha: '+dmy(inv.issue_date),135,24);
 doc.setFont('helvetica','bold');doc.text('Cliente',15,48);doc.setFont('helvetica','normal');doc.text(inv.customer_name||'',15,54);if(inv.customer_tax_id)doc.text(inv.customer_tax_id,15,59);if(inv.customer_address)doc.text(inv.customer_address,15,64,{maxWidth:90});
 y=78;doc.setFont('helvetica','bold');doc.text('Descripción',15,y);doc.text('Cant.',115,y);doc.text('Base',135,y);doc.text('IVA',160,y);doc.text('Total',180,y,{align:'right'});doc.line(15,y+2,195,y+2);doc.setFont('helvetica','normal');y+=8;
 lines.forEach(l=>{if(y>260){doc.addPage();y=20}doc.text(String(l.description||''),15,y,{maxWidth:92});doc.text(String(l.quantity),118,y,{align:'right'});doc.text(n(l.base_amount).toFixed(2),150,y,{align:'right'});doc.text(n(l.vat_rate).toFixed(0)+'%',169,y,{align:'right'});doc.text(n(l.total_amount).toFixed(2),195,y,{align:'right'});y+=8});
 y+=4;doc.line(120,y,195,y);y+=7;doc.text('Base: '+eur(inv.base_amount),195,y,{align:'right'});y+=6;doc.text('IVA: '+eur(inv.vat_amount),195,y,{align:'right'});y+=7;doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('TOTAL: '+eur(inv.total_amount),195,y,{align:'right'});
 return doc.output('blob');
}
window.opsInvoicePdf=async function(id,saveServer=false){
 try{
  const inv=O.invoices.find(x=>x.id===id);if(!inv)return;
  if(inv.generated_document_id&&!saveServer){const d=O.documents.find(x=>x.id===inv.generated_document_id);if(d){return opsDownloadDoc(d.id)}}
  const blob=await invoicePdfBlob(id);const filename=(inv.display_number||'factura').replaceAll('/','-')+'.pdf';
  if(saveServer&&!inv.generated_document_id){
   const file=new File([blob],filename,{type:'application/pdf'});
   const docId=await uploadDoc(file,{store_id:inv.store_id,doc_type:'factura_emitida',document_date:inv.issue_date,supplier_or_customer:inv.customer_name,tax_id:inv.customer_tax_id,invoice_number:inv.display_number,status:'archivada'},'sales_invoice',id);
   if(docId){await sb.from('ops_sales_invoices').update({generated_document_id:docId}).eq('id',id);await load(true)}
  }
  dlBlob(blob,filename);
 }catch(e){alert('No se pudo generar el PDF: '+e.message)}
};

function fiscalHtml(){
 const f=fiscal(O.year,O.quarter,n(O.plannedSpend)),r=retaEstimate(),pb=periodBounds(O.year,O.quarter,false);
 const prev=O.settings?.previous_year_net_income;let minor=0;if(prev!=null&&prev<=12000){minor=prev<=9000?100:prev<=10000?75:prev<=11000?50:25}
 const reserve=f.payable+f.m111+f.m115;
 return `<div class="ops-kpis">
  <div class="ops-kpi"><small>Ingresos acumulados</small><strong>${eur(f.incomeAcc)}</strong><div class="sub">01/01 → fin T${O.quarter}</div></div>
  <div class="ops-kpi"><small>Gastos deducibles</small><strong>${eur(f.expRaw)}</strong><div class="sub">Antes del 5 %</div></div>
  <div class="ops-kpi"><small>Difícil justificación</small><strong>${eur(f.difficult)}</strong><div class="sub">${h(String(O.settings?.difficult_expense_pct||5))}% · máximo ${eur(O.settings?.difficult_expense_annual_cap||2000)}</div></div>
  <div class="ops-kpi ${f.net>=0?'good':'bad'}"><small>Rendimiento neto estimado</small><strong>${eur(f.net)}</strong><div class="sub">Acumulado año</div></div>
  <div class="ops-kpi warn"><small>Reserva fiscal</small><strong>${eur(reserve)}</strong><div class="sub">130 + 111 + 115</div></div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Modelo 130</div><h3>Contador IRPF T${O.quarter}</h3></div></div>
   <div class="ops-metric-line"><span>01 · Ingresos acumulados</span><b>${eur(f.incomeAcc)}</b></div>
   <div class="ops-metric-line"><span>02 · Gastos deducibles estimados</span><b>${eur(f.deductible)}</b></div>
   <div class="ops-metric-line"><span>03 · Rendimiento neto</span><b>${eur(f.net)}</b></div>
   <div class="ops-metric-line"><span>04 · ${h(String(O.settings?.irpf_prepayment_rate||20))}%</span><b>${eur(f.box4)}</b></div>
   <div class="ops-metric-line"><span>05 · 130 anteriores pagados</span><b>− ${eur(f.previous)}</b></div>
   <div class="ops-metric-line"><span>06 · Retenciones soportadas</span><b>− ${eur(f.ret)}</b></div>
   ${minor?`<div class="ops-metric-line"><span>Minoración orientativa</span><b>− ${eur(minor)}</b></div>`:''}
   <div class="ops-metric-line"><span><b>Estimación pendiente</b></span><b>${eur(Math.max(0,f.payable-minor))}</b></div>
   <div class="ops-note warn" style="margin-top:10px">Es una previsión de control interno. La presentación oficial debe cuadrarse con la gestoría y con los ajustes que no estén registrados en Totus.</div>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Simulador</div><h3>¿Y si gasto más?</h3></div></div>
   <label>Gasto deducible adicional antes de cerrar T${O.quarter}</label><input inputmode="decimal" value="${h(O.plannedSpend)}" oninput="opsPlannedSpend(this.value)" placeholder="0,00">
   <div class="ops-metric-line"><span>130 estimado con ese gasto</span><b>${eur(Math.max(0,f.payable-minor))}</b></div>
   <div class="ops-metric-line"><span>Ahorro aproximado frente a ahora</span><b>${eur(Math.max(0,fiscal(O.year,O.quarter,0).payable-f.payable))}</b></div>
   <div class="ops-note" style="margin-top:10px">No recomienda comprar por comprar: muestra únicamente el impacto fiscal aproximado de un gasto que sea real, necesario y deducible.</div>
  </div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Retenciones</div><h3>Modelos 111 y 115</h3></div></div>
   <div class="ops-metric-line"><span>111 · nóminas/profesionales T${O.quarter}</span><b>${eur(f.m111)}</b></div>
   <div class="ops-metric-line"><span>115 · alquileres T${O.quarter}</span><b>${eur(f.m115)}</b></div>
   <div class="ops-metric-line"><span>Total a reservar</span><b>${eur(f.m111+f.m115)}</b></div>
   <button class="secondary" onclick="opsOpenTaxPayment()">Registrar pago presentado</button>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Autónomos 2026</div><h3>Rango RETA previsto</h3></div></div>
   <div class="ops-metric-line"><span>Rendimiento computable mensual proyectado</span><b>${eur(r.monthly)}</b></div>
   <div class="ops-metric-line"><span>Base permitida estimada</span><b>${r.bracket?eur(r.bracket.min_base)+' – '+eur(r.bracket.max_base):'—'}</b></div>
   <div class="ops-metric-line"><span>Cuota orientativa por rango</span><b>${r.bracket?eur(r.minQuota)+' – '+eur(r.maxQuota):'—'}</b></div>
   <div class="ops-metric-line"><span>Cuota actual configurada</span><b>${r.actual?eur(r.actual):'Sin indicar'}</b></div>
   <div class="ops-note">Estimación anualizada con los datos registrados. Para el rendimiento de cotización se suma de nuevo la cuota RETA deducida en IRPF y se aplica la deducción genérica configurada.</div>
  </div>
 </div>
 <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trimestres ${O.year}</div><h3>Evolución</h3></div></div><div class="ops-quarter-grid">${[1,2,3,4].map(q=>{const x=fiscal(O.year,q,0);return `<div class="ops-quarter ${q===O.quarter?'current':''}"><small>T${q}</small><strong>${eur(x.payable)}</strong><div class="small">130 previsto</div><div class="ops-tiny">Ingresos ${eur(x.qIncome)} · Gastos ${eur(x.qExpense)}</div></div>`}).join('')}</div></div>`;
}
window.opsPlannedSpend=function(v){O.plannedSpend=v;clearTimeout(window.__opsPlanTimer);window.__opsPlanTimer=setTimeout(render,150)};
window.opsOpenTaxPayment=async function(){
 if(!manager()){alert('Solo administración o gerencia puede registrar impuestos presentados.');return}
 const type=prompt('Modelo a registrar: 130, 111 o 115','130');if(!['130','111','115'].includes(type))return;
 const amount=prompt('Importe pagado (€):','');if(amount===null)return;
 try{const {error}=await sb.from('ops_tax_payments').insert({tax_type:type,fiscal_year:O.year,quarter:O.quarter,period_label:`T${O.quarter} ${O.year}`,payment_date:isoToday(),amount:n(amount),status:'pagado',created_by:authSession.user.id});if(error)throw error;await audit('fiscal','registrar_pago',null,{type,amount:n(amount),quarter:O.quarter});await load(true);render()}catch(e){alert(e.message)}
};

function reportsHtml(){
 return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Descargas</div><h3>Informes y entrega a gestoría</h3><div class="small">Selecciona una franja; todo se genera con los datos registrados en Gestión.</div></div></div>
 <div class="ops-filters"><div><label>Desde</label><input type="date" value="${h(O.reportFrom)}" onchange="opsReportDate('from',this.value)"></div><div><label>Hasta</label><input type="date" value="${h(O.reportTo)}" onchange="opsReportDate('to',this.value)"></div></div>
 <div class="ops-grid-3" style="margin-top:14px">
  <div class="ops-card"><h4>Cierres de caja</h4><p class="small">Detalle diario por tienda y medio de pago.</p><button class="secondary" onclick="opsExportClosings(true)">Descargar CSV</button></div>
  <div class="ops-card"><h4>Gastos gestoría</h4><p class="small">Concepto, bases, IVA, recargo y retenciones.</p><button class="secondary" onclick="opsExportExpenses(true)">Descargar CSV</button></div>
  <div class="ops-card"><h4>Ingresos gestoría</h4><p class="small">Resumen mensual por establecimiento.</p><button class="secondary" onclick="opsExportIncome()">Descargar CSV</button></div>
  <div class="ops-card"><h4>Informe fiscal</h4><p class="small">Resumen de resultado, 130, 111, 115 y RETA.</p><button class="secondary" onclick="opsFiscalPdf()">Descargar PDF</button></div>
  <div class="ops-card"><h4>Facturas y documentos</h4><p class="small">Todos los archivos de la franja seleccionada.</p><button class="secondary" onclick="opsZipReportDocs()">Descargar ZIP</button></div>
  <div class="ops-card"><h4>Paquete gestor</h4><p class="small">CSV + documentos en un solo ZIP.</p><button class="primary" onclick="opsGestorPack()">Preparar paquete</button></div>
 </div></div>`;
}
window.opsReportDate=function(k,v){if(k==='from')O.reportFrom=v;else O.reportTo=v};
function closingRows(from,to){
 const rs=filteredClosings(from,to,'all').sort((a,b)=>a.business_date.localeCompare(b.business_date));
 return [['Fecha','Establecimiento','Apertura','Efectivo vendido','Tarjeta','Bizum','Online','Otras entradas','Salida caja','Gastos caja','Caja final','Total ventas','Notas'],...rs.map(c=>[c.business_date,storeName(c.store_id),c.opening_cash,c.cash_sales,c.card_sales,c.bizum_sales,c.online_sales,c.other_income,c.cash_withdrawals,c.cash_expenses_declared,c.actual_cash,n(c.cash_sales)+n(c.card_sales)+n(c.bizum_sales)+n(c.online_sales)+n(c.other_income),c.notes||''])];
}
window.opsExportClosings=function(reportRange=false){const p=reportRange?{start:O.reportFrom,end:O.reportTo}:periodBounds(O.year,O.quarter,false);csvDownload(`cierres_${p.start}_${p.end}.csv`,closingRows(p.start,p.end))};
function expenseRows(from,to){
 const map=expenseLineMap(),rows=[['Fecha','Nº fra. proveedor','NIF/CIF','Identificación','Código','Concepto','Base IVA','% IVA','Cuota IVA','Base R. Equiv.','% R.Equiv.','Cuota R.Equiv.','Imputable IRPF','Base retención','%','Cuota retenida','Modelo','Establecimiento']];
 O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)).sort((a,b)=>a.expense_date.localeCompare(b.expense_date)).forEach(e=>{
  const lines=map.get(e.id)||[];
  lines.forEach(l=>{
   const c=category(l.category_id);rows.push([e.expense_date,e.invoice_number||'',e.supplier_tax_id||'',e.supplier_name,c?.manager_code||'',c?.name||l.description,l.base_amount,l.vat_rate,l.vat_amount,l.re_base,l.re_rate,l.re_amount,l.base_amount,l.withholding_base,l.withholding_rate,l.withholding_amount,l.withholding_model||'',storeName(e.store_id)]);
   const tax=n(l.vat_amount)+n(l.re_amount);if(tax)rows.push([e.expense_date,e.invoice_number||'',e.supplier_tax_id||'',e.supplier_name,'632','IVA SOPORTADO (RECARGO - REAGYP)','', '', '', '', '', '',tax,'','','','',storeName(e.store_id)]);
  });
 });
 return rows;
}
window.opsExportExpenses=function(reportRange=false){const p=reportRange?{start:O.reportFrom,end:O.reportTo}:periodBounds(O.year,O.quarter,false);csvDownload(`gastos_gestoria_${p.start}_${p.end}.csv`,expenseRows(p.start,p.end))};
function incomeRows(from,to){
 const rows=[['Fecha','Nº factura','Identificación del cliente','Concepto','Ingresos','Establecimiento']];
 O.stores.forEach(s=>{
  let cur=new Date(from+'T00:00:00'),end=new Date(to+'T00:00:00');
  while(cur<=end){
   const y=cur.getFullYear(),m=cur.getMonth(),ms=`${y}-${String(m+1).padStart(2,'0')}`;
   const last=new Date(y,m+1,0),lastS=`${y}-${String(m+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
   const mFrom=ms+'-01',mTo=lastS<to?lastS:to;const actualFrom=mFrom<from?from:mFrom;
   const val=incomeFor(actualFrom,mTo,s.id);
   if(val)rows.push([mTo,ms.replace('-','').slice(4)+'/'+String(y).slice(-2),`VENTAS ${s.name.toUpperCase()}`,'700 VENTAS - INGRESOS',val,s.name]);
   cur=new Date(y,m+1,1);
  }
 });
 return rows;
}
window.opsExportIncome=function(){csvDownload(`ingresos_gestoria_${O.reportFrom}_${O.reportTo}.csv`,incomeRows(O.reportFrom,O.reportTo))};
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
window.opsGestorPack=async function(){
 if(!window.JSZip)return alert('ZIP no disponible.');
 const z=new JSZip(),toCsv=rows=>'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');
 const base=`GESTORIA_${O.reportFrom}_${O.reportTo}`;
 z.file(base+`/01_INGRESOS/INGRESOS_${O.reportFrom}_${O.reportTo}.csv`,toCsv(incomeRows(O.reportFrom,O.reportTo)));
 z.file(base+`/02_GASTOS/GASTOS_${O.reportFrom}_${O.reportTo}.csv`,toCsv(expenseRows(O.reportFrom,O.reportTo)));
 z.file(base+`/03_CIERRES/CASH_CIERRES_${O.reportFrom}_${O.reportTo}.csv`,toCsv(closingRows(O.reportFrom,O.reportTo)));
 const internalExpenseIds=new Set(O.expenses.filter(e=>e.management_only).map(e=>e.id));
 const docs=O.documents.filter(d=>inRange(d.document_date,O.reportFrom,O.reportTo)&&!(d.linked_entity_type==='expense'&&internalExpenseIds.has(d.linked_entity_id)));
 await zipDocs(docs,z,base+'/04_DOCUMENTOS');
 z.file(base+'/00_LEEME.txt',
   'Paquete generado por Totus Central.\r\n'+
   'Orden: 01 INGRESOS · 02 GASTOS · 03 CIERRES · 04 DOCUMENTOS.\r\n'+
   'Los CSV de ingresos y gastos respetan la estructura de trabajo facilitada por la gestoría.\r\n'+
   'Los documentos se ordenan por año > trimestre > mes > establecimiento > tipo > proveedor/cliente.\r\n'+
   'Periodo: '+O.reportFrom+' a '+O.reportTo+'\r\n');
 dlBlob(await z.generateAsync({type:'blob'}),`paquete_gestor_${O.reportFrom}_${O.reportTo}.zip`);
};
window.opsFiscalPdf=function(){
 if(!window.jspdf?.jsPDF)return alert('PDF no disponible.');
 const {jsPDF}=window.jspdf,doc=new jsPDF(),f=fiscal(O.year,O.quarter,0),r=retaEstimate();doc.setFontSize(18);doc.text(`Totus Gestión · Fiscal T${O.quarter} ${O.year}`,15,18);doc.setFontSize(11);let y=32;
 [['Ingresos acumulados',f.incomeAcc],['Gastos deducibles',f.deductible],['Rendimiento neto',f.net],['Modelo 130 previsto',f.payable],['Modelo 111 trimestre',f.m111],['Modelo 115 trimestre',f.m115],['Reserva fiscal',f.reserve],['RETA rendimiento mensual proyectado',r.monthly]].forEach(x=>{doc.text(x[0],15,y);doc.text(eur(x[1]),195,y,{align:'right'});y+=8});
 doc.setFontSize(9);doc.text('Documento de control interno. Debe cuadrarse con la gestoría antes de presentar autoliquidaciones.',15,y+8,{maxWidth:180});
 dlBlob(doc.output('blob'),`fiscal_T${O.quarter}_${O.year}.pdf`);
};

function configHtml(){
 const s=O.settings||{},usage=sum(O.documents,d=>n(d.size_bytes)),limit=n(s.storage_limit_bytes||1073741824);
 return `<div class="ops-grid">
  <div class="ops-card ${manager()?'ops-manager':''}"><div class="section-head"><div><div class="eyebrow">Empresa</div><h3>Datos y criterios</h3></div><button class="primary" onclick="opsSaveSettings()" ${manager()?'':'disabled'}>Guardar</button></div>
   <div class="ops-form">
    <div class="span2"><label>Nombre / titular</label><input id="ops_set_name" value="${h(s.business_name||'')}" ${manager()?'':'disabled'}></div><div><label>NIF/CIF</label><input id="ops_set_tax" value="${h(s.tax_id||'')}" ${manager()?'':'disabled'}></div>
    <div class="span4"><label>Dirección fiscal</label><input id="ops_set_address" value="${h(s.business_address||'')}" ${manager()?'':'disabled'}></div>
    <div><label>Email</label><input id="ops_set_email" value="${h(s.business_email||'')}" ${manager()?'':'disabled'}></div><div><label>Teléfono</label><input id="ops_set_phone" value="${h(s.business_phone||'')}" ${manager()?'':'disabled'}></div>
    <div><label>Cuota RETA actual / mes</label><input id="ops_set_reta" inputmode="decimal" value="${h(s.actual_reta_monthly??'')}" ${manager()?'':'disabled'}></div><div><label>Rendimiento neto año anterior</label><input id="ops_set_prevnet" inputmode="decimal" value="${h(s.previous_year_net_income??'')}" ${manager()?'':'disabled'}></div>
   </div>
   <div class="ops-note" style="margin-top:12px">Régimen configurado: recargo de equivalencia · estimación directa simplificada · pago fraccionado IRPF ${h(String(s.irpf_prepayment_rate||20))}%.</div>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Almacenamiento</div><h3>${fmtInt(usage/1024/1024)} MB usados</h3></div></div><div class="ops-progress"><i style="width:${Math.min(100,limit?usage/limit*100:0)}%"></i></div><div class="ops-metric-line"><span>Límite de control</span><b>${fmtInt(limit/1024/1024)} MB</b></div><div class="ops-metric-line"><span>Documentos</span><b>${O.documents.length}</b></div></div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Establecimientos y cajas</div><h3>Estructura diaria</h3></div></div>${O.stores.map(s=>`<div class="ops-metric-line"><span><b>${h(s.name)}</b><br><small>${O.drawers.filter(d=>d.store_id===s.id).map(d=>h(d.name)).join(' · ')}</small></span><b>${O.drawers.filter(d=>d.store_id===s.id).length} caja(s)</b></div>`).join('')}</div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Series de factura</div><h3>Numeración ${O.year}</h3></div></div>${O.series.filter(s=>s.year===O.year).map(s=>`<div class="ops-metric-line"><span>${h(s.code)} · ${h(storeName(s.store_id))}</span><b>Siguiente ${h(s.prefix)}${String(s.next_number).padStart(s.padding,'0')}</b></div>`).join('')||'<div class="ops-empty">Sin series para este año.</div>'}</div>
 </div>`;
}
window.opsSaveSettings=async function(){
 if(!manager())return;
 const row={business_name:document.getElementById('ops_set_name').value,business_address:document.getElementById('ops_set_address').value,business_email:document.getElementById('ops_set_email').value,business_phone:document.getElementById('ops_set_phone').value,tax_id:document.getElementById('ops_set_tax').value,actual_reta_monthly:n(document.getElementById('ops_set_reta').value)||null,previous_year_net_income:n(document.getElementById('ops_set_prevnet').value)||null,current_year:O.year};
 const {error}=await sb.from('ops_business_settings').update(row).eq('id',1);if(error){alert(error.message);return}await audit('config','actualizar',null,{});await load(true);render();
};

window.opsTab=function(tab){O.tab=tab;if(tab==='cajas'&&!O.closeDraft)O.closeDraft=newClosingDraft();if(tab==='gastos'&&!O.expenseDraft){O.expenseDraft=newExpenseDraft();O.expenseDraftLines=[defaultExpenseLine()]}if(tab==='facturas'&&!O.invoiceDraft){O.invoiceDraft=newInvoiceDraft();O.invoiceDraftLines=[defaultInvoiceLine()]}render();window.scrollTo({top:0,behavior:'smooth'})};
window.opsSetYear=function(v){O.year=+v;O.reportFrom=`${O.year}-01-01`;O.reportTo=`${O.year}-12-31`;O.invoiceDraft=null;render()};
window.opsSetQuarter=function(v){O.quarter=+v;render()};
window.opsSetStore=function(v){O.storeId=v;O.closeDraft=null;O.expenseDraft=null;O.invoiceDraft=null;render()};

window.goOps=async function(){
 state.page='management';state.familyId=null;state.productId=null;state.dirty=false;
 render();
 try{await load();render()}catch(e){document.getElementById('main').innerHTML=`<div class="head"><div><div class="eyebrow">Gestión</div><h1>No se pudo cargar</h1><p>${h(e.message)}</p></div></div>`}
};

const pricingRender=render;
render=function(){
 if(state.page==='management'){
   document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='management'));
   document.getElementById('savebar')?.classList.add('hidden');
   const m=document.getElementById('main');if(m)m.innerHTML=managementHtml();
   return;
 }
 pricingRender();
};

})();