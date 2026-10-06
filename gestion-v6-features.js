(function(){
'use strict';
const O=window.TotusGestion;
if(!O) return;
O.features=O.features||{loaded:false,customers:[],templates:[],legacyRows:[],historicalIncome:[],gestorRows:[],gestorSummary:[],storageUsage:{documents_count:0,documents_bytes:0,assets_count:0,assets_bytes:0,total_bytes:0},billingPanel:'documents',customerDraft:null,invoiceMode:'factura',templateId:null,invoiceStatus:'all'};
const E=O.features;
const {h:H,n:N,isoToday:today,sum,inRange,storeName,manager,adminOnly:admin,statusBadge,dlBlob,audit,selectAll,infoButton,openOpsModal,closeOpsModal}=O.core;
const all=(table,order=null,asc=true)=>selectAll(table,order,asc);
const qBounds=(y,q)=>{const sm=(q-1)*3+1,end=new Date(y,q*3,0);return{start:`${y}-${String(sm).padStart(2,'0')}-01`,end:`${y}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`}};
const yearQEnd=(y,q)=>qBounds(y,q).end;
const monthName=m=>['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][m-1];
const reportDate=v=>{const x=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(x)?x.slice(8,10)+'/'+x.slice(5,7)+'/'+x.slice(0,4):x};
const euro=v=>eur(Number(v)||0);
async function featureLoad(force=false){
 if(E.loaded&&!force)return;
 const [customers,templates,legacy,hist,gestor,summary,storage]=await Promise.all([
   all('ops_customers','name',true),all('ops_document_templates','name',true),all('ops_legacy_daily_rows','row_date',true),
   all('ops_historical_income_periods','period_start',true),all('ops_gestor_natural_rows','expense_date',true),all('ops_gestor_quarter_summary','quarter',true),
   sb.rpc('ops_storage_usage').then(r=>r.error?null:r.data).catch(()=>null)
 ]);
 E.customers=customers;E.templates=templates;E.legacyRows=legacy;E.historicalIncome=hist;E.gestorRows=gestor;E.gestorSummary=summary;
 E.storageUsage=storage||{documents_count:O.documents.length,documents_bytes:sum(O.documents,d=>N(d.size_bytes)),assets_count:templates.filter(t=>N(t.logo_size_bytes)>0).length,assets_bytes:sum(templates,t=>N(t.logo_size_bytes)),total_bytes:sum(O.documents,d=>N(d.size_bytes))+sum(templates,t=>N(t.logo_size_bytes))};
 E.loaded=true;
 if(!E.templateId)E.templateId=(templates.find(t=>t.default_invoice)||templates[0])?.id||null;
}
function historicalIncome(from,to,store='all'){
 return sum(E.historicalIncome.filter(x=>x.period_start>=from&&x.period_end<=to&&(store==='all'||x.store_id===store)),x=>N(x.official_total_income??x.total_income));
}
function coveredByHistoricalIncome(closing){
 return E.historicalIncome.some(h=>h.store_id===closing.store_id&&closing.business_date>=h.period_start&&closing.business_date<=h.period_end);
}
function dailyIncome(from,to,store='all'){
 return sum(O.closings.filter(x=>x.include_in_income!==false&&inRange(x.business_date,from,to)&&(store==='all'||x.store_id===store)&&!coveredByHistoricalIncome(x)),x=>N(x.cash_sales)+N(x.card_sales)+N(x.bizum_sales)+N(x.online_sales)+N(x.other_income));
}
function invoicedExtra(from,to,store='all'){
 return sum(O.invoices.filter(x=>x.document_type!=='proforma'&&x.status==='emitida'&&x.include_in_income&&inRange(x.issue_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.total_amount));
}
function incomeAdjust(from,to,store='all'){
 return sum(O.incomeAdjustments.filter(x=>inRange(x.income_date,from,to)&&(store==='all'||x.store_id===store)),x=>N(x.amount));
}
function incomeTotal(from,to,store='all'){return historicalIncome(from,to,store)+dailyIncome(from,to,store)+invoicedExtra(from,to,store)+incomeAdjust(from,to,store)}
function exactGestorExpense(from,to){
 return sum(E.gestorRows.filter(x=>x.fiscal_year===2026&&inRange(x.expense_date,from,to)),x=>N(x.imputable_irpf));
}
function currentExpense(from,to,store='all'){
 const lineMap=new Map();O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 let t=0;
 O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)).forEach(e=>{
   if(from.startsWith('2026')&&e.expense_date<'2026-07-01'){
     if(store==='all')return;
     if(e.source!=='importacion_gestor')return;
   }
   if(e.source==='importacion_excel'&&!e.fiscal_reviewed)return;
   const ls=lineMap.get(e.id)||[];
   if(ls.length)t+=sum(ls,l=>l.deductible_irpf===false||l.fixed_asset?0:N(l.irpf_imputable));
   else if(e.deductible_irpf!==false)t+=N(e.accounting_amount||e.gross_expense);
 });
 t+=sum(O.fiscalAdjustments.filter(a=>inRange(a.adjustment_date,from,to)&&['gasto_deducible_extra','amortizacion'].includes(a.kind)),a=>N(a.amount));
 return t;
}
function internalExpense(from,to,store='all'){
 return sum(O.expenses.filter(e=>e.management_only&&inRange(e.expense_date,from,to)&&(store==='all'||e.store_id===store)),e=>N(e.accounting_amount||e.gross_expense||e.amount_paid));
}
function realExpense(from,to,store='all'){
 if(store==='all')return deductibleExpenseTotal(from,to,'all')+internalExpense(from,to,'all');
 const legacyRows=E.legacyRows.filter(r=>r.store_id===store&&inRange(r.row_date,from,to));
 const legacy=sum(legacyRows,r=>N(r.expense_amount));
 const maxLegacy=E.legacyRows.filter(r=>r.store_id===store&&r.row_date).reduce((m,r)=>r.row_date>m?r.row_date:m,'');
 const newer=sum(O.expenses.filter(e=>e.store_id===store&&inRange(e.expense_date,from,to)&&(!maxLegacy||e.expense_date>maxLegacy)),e=>N(e.accounting_amount||e.gross_expense||e.amount_paid));
 return legacy+newer;
}
function deductibleExpenseTotal(from,to,store='all'){
 if(store!=='all')return currentExpense(from,to,store);
 return exactGestorExpense(from,to)+currentExpense(from,to,'all');
}
function difficult(pre){return !O.settings?.difficult_expense_enabled||pre<=0?0:Math.min(pre*(N(O.settings.difficult_expense_pct||5)/100),N(O.settings.difficult_expense_annual_cap||2000));}
function supportedRetention(from,to){return sum(O.fiscalAdjustments.filter(a=>a.kind==='retencion_soportada'&&inRange(a.adjustment_date,from,to)),a=>N(a.amount));}
function retainedModel(model,from,to){
 const y=+from.slice(0,4);
 const paid=sum(O.taxPayments.filter(t=>t.fiscal_year===y&&t.tax_type===model&&t.status==='pagado'&&t.quarter&&qBounds(y,N(t.quarter)).start>=from&&qBounds(y,N(t.quarter)).end<=to),t=>N(t.amount));
 if(paid)return paid;
 if(y===2026){
   const rows=E.gestorRows.filter(x=>x.fiscal_year===2026&&inRange(x.expense_date,from,to));
   if(model==='115')return sum(rows.filter(x=>x.concept_code==='621'),x=>N(x.withholding_amount));
   if(model==='111')return Math.max(0,sum(rows,x=>N(x.withholding_amount))-sum(rows.filter(x=>x.concept_code==='621'),x=>N(x.withholding_amount)));
 }
 const ids=new Set(O.expenses.filter(e=>!e.management_only&&inRange(e.expense_date,from,to)).map(e=>e.id));
 return sum(O.expenseLines.filter(l=>ids.has(l.expense_id)&&l.withholding_model===model),l=>N(l.withholding_amount));
}
function fiscalProjection(y=O.year,q=O.quarter,planned=0){
 const from=`${y}-01-01`,end=yearQEnd(y,q),qb=qBounds(y,q);const income=incomeTotal(from,end,'all');const raw=deductibleExpenseTotal(from,end,'all')+N(planned);const pre=income-raw;const diff=difficult(Math.max(0,pre));const net=pre-diff;const rate=N(O.settings?.irpf_prepayment_rate||20);const gross=Math.max(0,net)*rate/100;const prev=sum(O.taxPayments.filter(t=>t.tax_type==='130'&&t.fiscal_year===y&&N(t.quarter)<q&&t.status==='pagado'),t=>N(t.amount));const ret=supportedRetention(from,end);const payable=Math.max(0,gross-prev-ret);const m111=retainedModel('111',qb.start,qb.end);const m115=retainedModel('115',qb.start,qb.end);return{from,end,qb,income,raw,diff,net,gross,prev,ret,payable,m111,m115,reserve:payable+m111+m115,qIncome:incomeTotal(qb.start,qb.end,'all'),qExpense:deductibleExpenseTotal(qb.start,qb.end,'all')};
}
function retaProjection(){
 const cutoff=(O.year===new Date().getFullYear())?today():`${O.year}-12-31`,from=`${O.year}-01-01`;const net=Math.max(0,incomeTotal(from,cutoff)-deductibleExpenseTotal(from,cutoff,'all'));const days=Math.max(1,Math.round((new Date(cutoff)-new Date(from))/86400000)+1),annual=net/(days/365),monthly=annual/12*(1-N(O.settings?.reta_generic_deduction_pct||7)/100);const b=O.retaBrackets.find(x=>(x.min_net_monthly==null||monthly>N(x.min_net_monthly)||(x.min_inclusive&&monthly===N(x.min_net_monthly)))&&(x.max_net_monthly==null||monthly<N(x.max_net_monthly)||(x.max_inclusive&&monthly===N(x.max_net_monthly))));const rate=N(O.settings?.reta_total_rate||31.5)/100;return{monthly,annual,bracket:b,minQuota:b?N(b.min_base)*rate:0,maxQuota:b?N(b.max_base)*rate:0};
}
function importedStatusHtml(){
 const confirmed=E.historicalIncome.filter(x=>x.verified_by_gestor).length,provisional=E.historicalIncome.filter(x=>!x.verified_by_gestor).length;
 const pendingExpenses=O.expenses.filter(x=>x.source==='importacion_excel'&&!x.fiscal_reviewed&&!x.management_only).length;
 return `<div class="ops-note"><b>Estado de fuentes 2026</b> · Ingresos: <span class="badge ok">${confirmed} periodos confirmados</span> <span class="badge warnb">${provisional} provisionales</span> · Gastos Excel pendientes de revisión fiscal: <b>${pendingExpenses}</b>. Los provisionales afectan al control real, no a la deducción fiscal.</div>`;
}
function dashboardHtml(){
 const b=qBounds(O.year,O.quarter),inc=incomeTotal(b.start,b.end,O.storeId),fiscalExp=deductibleExpenseTotal(b.start,b.end,O.storeId),internal=internalExpense(b.start,b.end,O.storeId),realExp=realExpense(b.start,b.end,O.storeId),f=fiscalProjection(),r=retaProjection();const assets=N(E.storageUsage?.assets_bytes);const used=N(E.storageUsage?.total_bytes),limit=N(O.settings?.storage_limit_bytes||1073741824),pct=limit?used/limit*100:0;
 return `${importedStatusHtml()}<div class="ops-kpis" style="margin-top:14px"><div class="ops-kpi"><small>Ingresos T${O.quarter}</small><strong>${euro(inc)}</strong><div class="sub">${O.storeId==='all'?'Ambos establecimientos':H(storeName(O.storeId))}</div></div><div class="ops-kpi"><small>Gastos reales T${O.quarter}</small><strong>${euro(realExp)}</strong><div class="sub">Incluye ${euro(internal)} de control interno</div></div><div class="ops-kpi ${inc-realExp>=0?'good':'bad'}"><small>Resultado real T${O.quarter}</small><strong>${euro(inc-realExp)}</strong><div class="sub">Ingresos menos todos los gastos registrados</div></div><div class="ops-kpi"><small>Gastos fiscales T${O.quarter}</small><strong>${euro(fiscalExp)}</strong><div class="sub">Base usada en fiscalidad</div></div><div class="ops-kpi warn"><small>Reserva fiscal</small><strong>${euro(f.reserve)}</strong><div class="sub">130 + 111 + 115</div></div><div class="ops-kpi"><small>RETA orientativo</small><strong>${r.bracket?euro(r.minQuota)+'–'+euro(r.maxQuota):'—'}</strong><div class="sub">Rend. mensual ${euro(r.monthly)}</div></div></div><div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trimestre</div><h3>Contador fiscal</h3></div><button class="ghost" onclick="opsTab('fiscal')">Abrir fiscalidad</button></div><div class="ops-metric-line"><span>Ingresos acumulados</span><b>${euro(f.income)}</b></div><div class="ops-metric-line"><span>Gastos deducibles + 5 %</span><b>${euro(f.raw+f.diff)}</b></div><div class="ops-metric-line"><span>130 pendiente estimado</span><b>${euro(f.payable)}</b></div><div class="ops-metric-line"><span>Reserva total</span><b>${euro(f.reserve)}</b></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Servidor</div><h3>Archivo documental</h3></div><button class="ghost" onclick="opsTab('documentos')">Abrir</button></div><div class="ops-space-head"><b>${Math.round(used/1048576)} MB usados</b><span class="small">${pct.toFixed(1).replace('.',',')} %</span></div><div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="ops-metric-line"><span>Documentos</span><b>${N(E.storageUsage?.documents_count)} · ${(N(E.storageUsage?.documents_bytes)/1048576).toFixed(1).replace('.',',')} MB</b></div><div class="ops-metric-line"><span>Plantillas de factura</span><b>${E.templates.length}</b></div></div></div><div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Trabajo diario</div><h3>Accesos rápidos</h3></div></div><div class="ops-actions"><button class="primary" onclick="opsTab('cajas')">Cerrar caja</button><button class="secondary" onclick="opsTab('gastos')">Registrar gasto</button>${manager()?`<button class="secondary" onclick="opsNewDocument('factura')">Nueva factura</button><button class="secondary" onclick="opsNewDocument('proforma')">Nueva proforma</button>`:''}<button class="secondary" onclick="opsTab('documentos')">Subir documento</button></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">2026</div><h3>Continuidad real</h3></div></div><div class="ops-metric-line"><span>Ingresos históricos cargados</span><b>${euro(sum(E.historicalIncome,x=>N(x.official_total_income??x.total_income)))}</b></div><div class="ops-metric-line"><span>Gastos gestoría Q1+Q2</span><b>${euro(sum(E.gestorSummary,x=>N(x.imputable_irpf)))}</b></div><div class="ops-metric-line"><span>Cierres chat importados</span><b>${O.closings.filter(x=>x.source==='importacion_excel').length}</b></div></div></div>`;
}
function newDocDraft(type='factura'){
 const mode=type,documentType=mode==='proforma'?'proforma':'factura',invoiceKind=mode==='rectificativa'?'rectifying':'invoice';
 const sid=O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'');
 const ser=O.series.find(s=>s.store_id===sid&&s.year===O.year&&s.active&&s.document_type===documentType&&(documentType!=='factura'||(s.series_kind||'invoice')===invoiceKind))
   ||O.series.find(s=>s.year===O.year&&s.active&&s.document_type===documentType&&(documentType!=='factura'||(s.series_kind||'invoice')===invoiceKind));
 const tpl=E.templates.find(t=>documentType==='proforma'?t.default_proforma:t.default_invoice)||E.templates[0];
 return {id:null,mode,documentType,invoiceKind,origin:'totus',seriesId:ser?.id||'',storeId:sid,date:today(),dueDate:'',operationDate:'',externalNumber:'',customerId:'',customer:'',taxId:'',address:'',email:'',concept:'',payment:'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,notes:'',terms:tpl?.payment_terms_default||'',footer:tpl?.footer_text||'',poRef:'',templateId:tpl?.id||'',sourceFile:null};
}
window.opsInvoiceStatus=function(v){E.invoiceStatus=v;render()};
window.opsBillingPanel=function(v){if(!manager()&&v!=='documents')return;E.billingPanel=v;if(v==='customers'&&!E.customerDraft)E.customerDraft=blankCustomerDraft();render()};
window.opsNewCustomerPanel=function(){E.customerDraft=blankCustomerDraft();render()};
window.opsCustomerField=function(k,v){if(!E.customerDraft)E.customerDraft=blankCustomerDraft();E.customerDraft[k]=v};
window.opsEditCustomerPanel=function(id){const c=E.customers.find(x=>x.id===id);if(!c)return;E.customerDraft={id:c.id,name:c.name||'',tax_id:c.tax_id||'',email:c.email||'',address:c.address||'',default_payment_method:c.default_payment_method||'transferencia',active:c.active!==false};render()};
window.opsSaveCustomerPanel=async function(){
 if(!manager())return;
 const d=E.customerDraft||blankCustomerDraft();if(!String(d.name||'').trim())return alert('El nombre o razón social es obligatorio.');
 const row={name:String(d.name).trim(),tax_id:String(d.tax_id||'').trim(),email:String(d.email||'').trim(),address:String(d.address||'').trim(),default_payment_method:d.default_payment_method||'transferencia',active:d.active!==false,updated_at:new Date().toISOString()};
 const res=d.id?await sb.from('ops_customers').update(row).eq('id',d.id).select().single():await sb.from('ops_customers').insert(row).select().single();
 if(res.error)return alert('No se pudo guardar el cliente: '+res.error.message);
 await audit('facturas',d.id?'cliente_actualizar':'cliente_crear',res.data.id,{cliente:row.name});
 await featureLoad(true);E.customerDraft={id:res.data.id,...row};render();
};
window.opsToggleCustomerPanel=async function(id,active){
 if(!manager())return;
 const c=E.customers.find(x=>x.id===id);if(!c)return;
 if(!confirm((active?'Reactivar':'Archivar')+' a '+c.name+'?'))return;
 const {error}=await sb.from('ops_customers').update({active,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)return alert('No se pudo cambiar el estado: '+error.message);
 await audit('facturas',active?'cliente_reactivar':'cliente_archivar',id,{cliente:c.name});await featureLoad(true);render();
};
window.opsReportField=function(k,v){if(k==='from')O.reportFrom=v;else O.reportTo=v};
window.opsInvoiceView=function(type='factura'){E.billingPanel='documents';E.invoiceMode=type;O.invoiceDraft=null;render();};
window.opsNewDocument=function(type='factura'){if(!manager())return alert('Facturación en modo consulta. Solo administración o gerencia puede crear documentos.');O.tab='facturas';E.billingPanel='documents';E.invoiceMode=type;O.invoiceDraft=newDocDraft(type);O.invoiceDraftLines=[{description:'',qty:'1',unit:'',discount:'0',vat:'21'}];render();};
function ensureDraft(){if(!O.invoiceDraft||!O.invoiceDraft.documentType){O.invoiceDraft=newDocDraft(E.invoiceMode);O.invoiceDraftLines=[{description:'',qty:'1',unit:'',discount:'0',vat:'21'}];}return O.invoiceDraft;}
function lineCalc(l){const q=N(l.qty),u=N(l.unit),d=N(l.discount),base=q*u*(1-d/100),vat=base*N(l.vat)/100;return{base,vat,total:base+vat}}
function draftTotals(){return O.invoiceDraftLines.reduce((a,l)=>{const x=lineCalc(l);a.base+=x.base;a.vat+=x.vat;a.total+=x.total;return a},{base:0,vat:0,total:0})}
function seriesFor(d){return O.series.filter(s=>s.year===O.year&&s.active&&s.document_type===d.documentType&&(d.documentType!=='factura'||(s.series_kind||'invoice')===(d.invoiceKind||'invoice'))&&(d.storeId?(!s.store_id||s.store_id===d.storeId):true))}
function documentLabel(t,kind='invoice'){return t==='proforma'?'Proforma':kind==='rectifying'?'Factura rectificativa':'Factura'}
function customerOptions(d){return `<option value="">Cliente manual</option>${E.customers.filter(c=>c.active!==false).map(c=>`<option value="${c.id}" ${d.customerId===c.id?'selected':''}>${H(c.name)}${c.tax_id?' · '+H(c.tax_id):''}</option>`).join('')}`}
function templateCards(d){return `<div class="invoice-template-row">${E.templates.filter(t=>t.active!==false).map(t=>`<button type="button" class="invoice-template-card ${d.templateId===t.id?'selected':''}" onclick="opsDocField('templateId','${t.id}',true)"><span class="template-swatch" style="background:${H(t.primary_color)}"><i style="background:${H(t.secondary_color)}"></i></span><b>${H(t.name)}</b><small>${H(t.style)}</small></button>`).join('')}</div>`}
function templateEditorHtml(tpl){
 if(!tpl?.id)return '<div class="ops-empty">No hay plantilla disponible.</div>';
 const disabled=manager()?'':'disabled';
 return `<div class="template-editor">
   <div class="ops-form">
    <div><label>Nombre plantilla</label><input id="ops_tpl_name" value="${H(tpl.name||'')}" ${disabled}></div>
    <div><label>Estilo</label><select id="ops_tpl_style" ${disabled}>${['clean','brand','compact'].map(x=>`<option value="${x}" ${tpl.style===x?'selected':''}>${x==='clean'?'Limpia':x==='brand'?'Corporativa':'Compacta'}</option>`).join('')}</select></div>
    <div><label>Color principal</label><input id="ops_tpl_primary" type="color" value="${H(tpl.primary_color||'#17202A')}" ${disabled}></div>
    <div><label>Color secundario</label><input id="ops_tpl_secondary" type="color" value="${H(tpl.secondary_color||'#3B82F6')}" ${disabled}></div>
    <div><label>Color de texto</label><input id="ops_tpl_text" type="color" value="${H(tpl.text_color||'#17202A')}" ${disabled}></div>
    <div><label>Fuente</label><select id="ops_tpl_font" ${disabled}>${['helvetica','times','courier'].map(x=>`<option value="${x}" ${tpl.font_family===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div><label>Ancho logo (mm)</label><input id="ops_tpl_width" inputmode="decimal" value="${H(tpl.logo_width_mm||34)}" ${disabled}></div>
    <div><label>Posición logo</label><select id="ops_tpl_logo_pos" ${disabled}><option value="left" ${(tpl.logo_position||'left')==='left'?'selected':''}>Izquierda</option><option value="center" ${tpl.logo_position==='center'?'selected':''}>Centro</option><option value="right" ${tpl.logo_position==='right'?'selected':''}>Derecha</option></select></div>
    <div class="checkline"><input id="ops_tpl_show_logo" type="checkbox" ${tpl.show_logo!==false?'checked':''} ${disabled}><label for="ops_tpl_show_logo">Mostrar logo</label></div>
    <div class="checkline"><input id="ops_tpl_show_pay" type="checkbox" ${tpl.show_payment_details!==false?'checked':''} ${disabled}><label for="ops_tpl_show_pay">Mostrar datos de pago</label></div>
    <div class="span2 template-logo-field"><label>Logo corporativo</label><input id="ops_tpl_logo" type="file" accept="image/png,image/jpeg,image/webp" ${disabled}><div class="small">${tpl.logo_name?`Actual: <b>${H(tpl.logo_name)}</b>`:'Sin logo cargado'} · PNG/JPG/WebP · máx. 2 MB</div></div>
    <div><label>Título factura</label><input id="ops_tpl_invoice_title" value="${H(tpl.invoice_title||'FACTURA')}" ${disabled}></div>
    <div><label>Título proforma</label><input id="ops_tpl_proforma_title" value="${H(tpl.proforma_title||'FACTURA PROFORMA')}" ${disabled}></div>
    <div class="span2"><label>Texto cabecera</label><input id="ops_tpl_header" value="${H(tpl.header_text||'')}" ${disabled}></div>
    <div class="span2"><label>Condiciones por defecto</label><textarea id="ops_tpl_terms" ${disabled}>${H(tpl.payment_terms_default||'')}</textarea></div>
    <div class="span2"><label>Datos bancarios / pago</label><textarea id="ops_tpl_bank" ${disabled}>${H(tpl.bank_details||'')}</textarea></div>
    <div class="span4"><label>Pie</label><textarea id="ops_tpl_footer" ${disabled}>${H(tpl.footer_text||'')}</textarea></div>
    <div class="checkline"><input id="ops_tpl_definv" type="checkbox" ${tpl.default_invoice?'checked':''} ${disabled}><label for="ops_tpl_definv">Predeterminada factura</label></div>
    <div class="checkline"><input id="ops_tpl_defpro" type="checkbox" ${tpl.default_proforma?'checked':''} ${disabled}><label for="ops_tpl_defpro">Predeterminada proforma</label></div>
   </div>
   <div class="ops-actions template-editor-actions">
    <button class="primary" type="button" onclick="opsSaveTemplate('${tpl.id}')" ${disabled}>Guardar plantilla</button>
    <button class="secondary" type="button" onclick="opsUploadTemplateLogo('${tpl.id}')" ${disabled}>Subir / cambiar logo</button>
    <button class="ghost" type="button" onclick="opsDuplicateTemplate('${tpl.id}')" ${disabled}>Duplicar plantilla</button>
   </div>
  </div>`;
}
function billingNavHtml(){
 const item=(key,label,active)=>`<button type="button" class="${active?'active':''}" onclick="opsBillingPanel('${key}')">${label}</button>`;
 return `<div class="billing-nav">${item('documents','Documentos',E.billingPanel==='documents')}${manager()?item('customers','Clientes',E.billingPanel==='customers'):''}${manager()?item('templates','Plantillas y marca',E.billingPanel==='templates'):''}${manager()?item('series','Series',E.billingPanel==='series'):''}</div>`;
}
function blankCustomerDraft(){return{id:null,name:'',tax_id:'',email:'',address:'',default_payment_method:'transferencia',active:true}}
function billingCustomersHtml(){
 const d=E.customerDraft||blankCustomerDraft(),rows=E.customers.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">${d.id?'Editar cliente':'Nuevo cliente'}</div><h3>Ficha de cliente</h3><div class="small">Datos reutilizables en facturas y proformas. Archivar oculta el cliente sin romper documentos antiguos.</div></div><button class="ghost" onclick="opsNewCustomerPanel()">Nuevo</button></div><div class="ops-form"><div class="span2"><label>Nombre / razón social</label><input value="${H(d.name||'')}" oninput="opsCustomerField('name',this.value)"></div><div><label>NIF/CIF</label><input value="${H(d.tax_id||'')}" oninput="opsCustomerField('tax_id',this.value)"></div><div><label>Email</label><input type="email" value="${H(d.email||'')}" oninput="opsCustomerField('email',this.value)"></div><div class="span2"><label>Dirección</label><input value="${H(d.address||'')}" oninput="opsCustomerField('address',this.value)"></div><div><label>Forma de pago por defecto</label><select aria-label="Forma de pago por defecto del cliente" onchange="opsCustomerField('default_payment_method',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.default_payment_method===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="ops-actions" style="margin-top:12px"><button class="primary" onclick="opsSaveCustomerPanel()">${d.id?'Guardar cliente':'Crear cliente'}</button></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Directorio</div><h3>Clientes guardados</h3><div class="small">${rows.filter(x=>x.active!==false).length} activos · ${rows.filter(x=>x.active===false).length} archivados</div></div></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Cliente</th><th>NIF/CIF</th><th>Email</th><th>Pago</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><b>${H(c.name)}</b></td><td>${H(c.tax_id||'—')}</td><td>${H(c.email||'—')}</td><td>${H(c.default_payment_method||'transferencia')}</td><td>${c.active!==false?'<span class="badge ok">Activo</span>':'<span class="badge warnb">Archivado</span>'}</td><td><div class="ops-actions"><button class="ghost" onclick="opsEditCustomerPanel('${c.id}')">Editar</button><button class="ghost" onclick="opsToggleCustomerPanel('${c.id}',${c.active===false?'true':'false'})">${c.active===false?'Reactivar':'Archivar'}</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay clientes guardados.</div>'}</div></div></div>`;
}
function billingTemplatesHtml(){
 const tpl=E.templates.find(t=>t.id===E.templateId)||E.templates.find(t=>t.default_invoice)||E.templates[0]||{};
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Diseño documental</div><div class="ops-title-line"><h3>Plantillas y marca</h3>${infoButton('facturas','Cómo funcionan las plantillas')}</div><div class="small">Aquí se gestiona el aspecto de facturas y proformas. El logo se carga únicamente aquí.</div></div></div><div class="invoice-template-row">${E.templates.map(t=>`<button class="invoice-template-card ${tpl.id===t.id?'selected':''}" onclick="opsSelectTemplateConfig('${t.id}')"><span class="template-swatch" style="background:${H(t.primary_color)}"><i style="background:${H(t.secondary_color)}"></i></span><b>${H(t.name)}</b><small>${t.default_invoice?'Factura predeterminada':''}${t.default_proforma?' · Proforma predeterminada':''}</small></button>`).join('')}</div>${templateEditorHtml(tpl)}</div></div>`;
}
function billingSeriesHtml(){
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Numeración</div><div class="ops-title-line"><h3>Series ${O.year}</h3>${infoButton('facturas.series','Cómo funciona la numeración')}</div><div class="small">Una serie por tienda, año y tipo de documento. El siguiente número nunca puede retroceder.</div></div></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Tipo</th><th>Tienda</th><th>Código</th><th>Prefijo</th><th>Siguiente</th><th>Dígitos</th><th></th></tr></thead><tbody>${O.series.filter(x=>x.year===O.year).map(x=>`<tr><td>${H(x.document_type||'factura')}${x.series_kind==='rectifying'?' · rectificativa':''}</td><td>${H(storeName(x.store_id))}</td><td><b>${H(x.code)}</b></td><td><input aria-label="Prefijo de ${H(x.code)}" id="ser_p_${x.id}" value="${H(x.prefix)}" ${admin()?'':'disabled'}></td><td><input aria-label="Siguiente número de ${H(x.code)}" id="ser_n_${x.id}" inputmode="numeric" value="${x.next_number}" ${admin()?'':'disabled'}></td><td><input aria-label="Dígitos de ${H(x.code)}" id="ser_d_${x.id}" inputmode="numeric" value="${x.padding}" ${admin()?'':'disabled'}></td><td><button class="ghost" onclick="opsSaveSeries('${x.id}')" ${admin()?'':'disabled'}>Guardar</button></td></tr>`).join('')}</tbody></table></div><div class="ops-note warn" style="margin-top:10px">Las series ya usadas no deben renombrarse sin un motivo administrativo claro.</div></div></div>`;
}
function invoicesHtml(){
 if(E.billingPanel==='customers')return billingCustomersHtml();
 if(E.billingPanel==='templates')return billingTemplatesHtml();
 if(E.billingPanel==='series')return billingSeriesHtml();
 const d=ensureDraft(),tot=draftTotals(),sers=seriesFor(d);const rows=O.invoices.filter(x=>{const mode=x.document_type==='proforma'?'proforma':(x.invoice_kind==='rectifying'?'rectificativa':'factura');return mode===E.invoiceMode&&x.issue_date?.startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)&&(E.invoiceStatus==='all'||x.status===E.invoiceStatus)}).slice(0,200);
 return `<div class="invoice-workspace">${billingNavHtml()}<div class="invoice-toolbar"><div class="invoice-type-switch"><button class="${E.invoiceMode==='factura'?'active':''}" onclick="opsNewDocument('factura')">Facturas</button><button class="${E.invoiceMode==='rectificativa'?'active':''}" onclick="opsNewDocument('rectificativa')">Rectificativas</button><button class="${E.invoiceMode==='proforma'?'active':''}" onclick="opsNewDocument('proforma')">Proformas</button></div><div class="ops-actions"><button class="ghost" onclick="opsPreviewDraft()">Vista previa</button><button class="primary" onclick="opsSaveDocument()">${d.id?'Guardar cambios':'Guardar borrador'}</button></div></div><div class="ops-grid invoice-grid"><div class="ops-card invoice-editor"><div class="section-head"><div><div class="eyebrow">${d.id?'Editar':'Nuevo'} ${documentLabel(d.documentType,d.invoiceKind).toLowerCase()}</div><h3>${documentLabel(d.documentType,d.invoiceKind)}</h3><div class="small">Formato profesional, numeración por serie y año.</div></div></div><div class="invoice-section-title">1 · Documento y cliente ${infoButton('facturas.external','Ayuda sobre origen y datos del documento')}</div><div class="ops-form"><div><label>Origen</label><select aria-label="Origen del documento" onchange="opsDocField('origin',this.value,true)"><option value="totus" ${d.origin==='totus'?'selected':''}>Crear en Totus</option><option value="externa" ${d.origin==='externa'?'selected':''}>Creada fuera</option></select></div><div><label>Fecha</label><input type="date" value="${H(d.date)}" oninput="opsDocField('date',this.value)"></div><div><label>Vencimiento</label><input type="date" value="${H(d.dueDate||'')}" oninput="opsDocField('dueDate',this.value)"></div><div><label>Fecha operación</label><input type="date" value="${H(d.operationDate||'')}" oninput="opsDocField('operationDate',this.value)"></div><div><label>Establecimiento</label><select aria-label="Establecimiento del documento" onchange="opsDocField('storeId',this.value,true)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div><div><label>Serie</label><select aria-label="Serie de numeración" onchange="opsDocField('seriesId',this.value)">${sers.map(s=>`<option value="${s.id}" ${d.seriesId===s.id?'selected':''}>${H(s.code)} · ${H(s.prefix)}${String(s.next_number).padStart(s.padding,'0')}</option>`).join('')}</select></div>${d.origin==='externa'?`<div><label>Nº usado fuera</label><input inputmode="numeric" value="${H(d.externalNumber||'')}" oninput="opsDocField('externalNumber',this.value)"></div><div><label>PDF original</label><input id="ops_external_doc_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"></div>`:''}<div class="span2"><label>Cliente guardado</label><select aria-label="Cliente guardado" onchange="opsSelectCustomer(this.value)">${customerOptions(d)}</select></div><div class="span2"><label>Cliente / razón social</label><input value="${H(d.customer)}" oninput="opsDocField('customer',this.value)"></div><div><label>NIF/CIF</label><input value="${H(d.taxId)}" oninput="opsDocField('taxId',this.value)"></div><div><label>Email</label><input type="email" value="${H(d.email)}" oninput="opsDocField('email',this.value)"></div><div class="span2"><label>Dirección</label><input value="${H(d.address)}" oninput="opsDocField('address',this.value)"></div><div><label>Referencia / pedido</label><input value="${H(d.poRef||'')}" oninput="opsDocField('poRef',this.value)"></div><div><button class="ghost" onclick="opsSaveCustomerFromDraft()" type="button">Guardar cliente</button></div></div><div class="invoice-section-title">2 · Conceptos</div>${d.invoiceKind==='rectifying'?'<div class="ops-note warn" style="margin-bottom:10px">En una rectificativa puedes usar importes negativos para devoluciones o correcciones. La serie rectificativa mantiene su numeración independiente.</div>':''}<div class="ops-lines invoice-lines">${O.invoiceDraftLines.map((l,i)=>`<div class="ops-line"><div><label>Descripción</label><input value="${H(l.description)}" oninput="opsDocLine(${i},'description',this.value)"></div><div><label>Cant.</label><input inputmode="decimal" value="${H(l.qty)}" oninput="opsDocLine(${i},'qty',this.value,true)"></div><div><label>Precio base</label><input inputmode="decimal" value="${H(l.unit)}" oninput="opsDocLine(${i},'unit',this.value,true)"></div><div><label>Dto %</label><input inputmode="decimal" value="${H(l.discount)}" oninput="opsDocLine(${i},'discount',this.value,true)"></div><div><label>IVA %</label><input inputmode="decimal" value="${H(l.vat)}" oninput="opsDocLine(${i},'vat',this.value,true)"></div><button class="ghost" onclick="opsRemoveDocLine(${i})" ${O.invoiceDraftLines.length===1?'disabled':''}>×</button><div class="small" style="grid-column:1/-1">Base ${euro(lineCalc(l).base)} · IVA ${euro(lineCalc(l).vat)} · Total ${euro(lineCalc(l).total)}</div></div>`).join('')}</div><div class="ops-actions" style="margin-top:8px"><button class="secondary" onclick="opsAddDocLine()">+ Añadir línea</button></div><div class="ops-invoice-total"><span>Base <b>${euro(tot.base)}</b></span><span>IVA <b>${euro(tot.vat)}</b></span><span>Total <b>${euro(tot.total)}</b></span></div><div class="invoice-section-title">3 · Pago y notas ${infoButton('facturas.includeIncome','Ayuda sobre ingresos y cobro')}</div><div class="ops-form"><div><label>Forma de pago</label><select aria-label="Forma de pago" onchange="opsDocField('payment',this.value)">${['efectivo','tarjeta','transferencia','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Estado cobro</label><select aria-label="Estado de cobro" onchange="opsDocField('paidStatus',this.value)">${['pendiente','pagada','parcial'].map(x=>`<option ${d.paidStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div><label>Fecha cobro</label><input type="date" value="${H(d.paidDate||'')}" oninput="opsDocField('paidDate',this.value)"></div><div class="checkline"><input id="ops_doc_income" type="checkbox" ${d.includeIncome?'checked':''} onchange="opsDocField('includeIncome',this.checked)"><label for="ops_doc_income">Sumar a ingresos si NO está en cierres</label></div><div class="span2"><label>Condiciones / vencimiento</label><textarea oninput="opsDocField('terms',this.value)">${H(d.terms||'')}</textarea></div><div class="span2"><label>Notas / pie específico</label><textarea oninput="opsDocField('footer',this.value)">${H(d.footer||'')}</textarea></div></div></div><aside class="ops-card invoice-design-panel"><div class="eyebrow">Diseño</div><div class="ops-title-line"><h3>Plantilla aplicada</h3>${infoButton('facturas','Ayuda sobre plantillas')}</div>${templateCards(d)}<div class="invoice-mini-preview">${miniPreview(d,tot)}</div>${manager()?`<button type="button" class="secondary" style="width:100%;margin-top:12px" onclick="opsBillingPanel('templates')">Gestionar plantillas y logo</button>`:''}<div class="ops-note" style="margin-top:12px">Al emitir, el diseño queda congelado para que cambios posteriores no alteren documentos antiguos.</div></aside></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>${E.invoiceMode==='proforma'?'Proformas':E.invoiceMode==='rectificativa'?'Facturas rectificativas':'Facturas'}</h3></div><div class="ops-actions"><select aria-label="Filtrar por estado" onchange="opsInvoiceStatus(this.value)"><option value="all">Todos los estados</option>${['borrador','emitida','aceptada','rechazada','convertida','anulada'].map(x=>`<option value="${x}" ${E.invoiceStatus===x?'selected':''}>${x}</option>`).join('')}</select><button class="primary" onclick="opsNewDocument('${E.invoiceMode}')">+ Nuevo</button></div></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Serie</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.issue_date?.split('-').reverse().join('/')||'—'}</td><td><b>${H(row.display_number||'Borrador')}</b></td><td>${H(row.customer_name||'—')}</td><td>${statusBadge(row.status)}</td><td class="num">${euro(row.total_amount)}</td><td>${H(O.series.find(s=>s.id===row.series_id)?.code||'')}</td><td><div class="ops-actions">${row.status==='borrador'?`<button class="ghost" onclick="opsEditDocument('${row.id}')">Editar</button><button class="primary" onclick="opsFinalizeDocument('${row.id}')">Emitir</button>`:''}${row.status!=='borrador'?`<button class="ghost" onclick="opsDocumentPdf('${row.id}')">Ver</button>`:''}${row.document_type==='factura'&&row.status==='emitida'&&row.paid_status!=='pagada'?`<button class="ghost" onclick="opsMarkInvoicePaid('${row.id}')">Marcar cobrada</button>`:''}${row.document_type==='factura'&&row.status==='emitida'&&row.invoice_kind!=='rectifying'?`<button class="ghost" onclick="opsCreateRectifying('${row.id}')">Rectificar</button>`:''}${row.document_type==='factura'&&row.paid_status==='pagada'?`<span class="ops-pill">Cobrada ✓</span>`:''}${row.document_type==='proforma'&&row.status==='emitida'?`<button class="ghost" onclick="opsSetProformaStatus('${row.id}','aceptada')">Aceptar</button><button class="ghost" onclick="opsSetProformaStatus('${row.id}','rechazada')">Rechazar</button>`:''}${row.document_type==='proforma'&&['emitida','aceptada'].includes(row.status)&&!row.converted_invoice_id?`<button class="primary" onclick="opsConvertProforma('${row.id}')">Convertir a factura</button>`:''}${row.converted_invoice_id?`<span class="ops-pill">Convertida</span>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos en esta vista.</div>'}</div></div>`;
}
function invoicesReadOnlyHtml(){
 const rows=O.invoices.filter(x=>{const mode=x.document_type==='proforma'?'proforma':(x.invoice_kind==='rectifying'?'rectificativa':'factura');return mode===E.invoiceMode&&x.issue_date?.startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)&&(E.invoiceStatus==='all'||x.status===E.invoiceStatus)}).slice(0,200);
 return `<div class="invoice-workspace"><div class="invoice-toolbar"><div class="invoice-type-switch"><button class="${E.invoiceMode==='factura'?'active':''}" onclick="opsInvoiceView('factura')">Facturas</button><button class="${E.invoiceMode==='rectificativa'?'active':''}" onclick="opsInvoiceView('rectificativa')">Rectificativas</button><button class="${E.invoiceMode==='proforma'?'active':''}" onclick="opsInvoiceView('proforma')">Proformas</button></div></div><div class="ops-note warn">Modo consulta: el encargado puede revisar facturas, rectificativas y proformas, pero solo administración o gerencia puede crear, editar, emitir, cobrar, rectificar o convertir documentos.</div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>${E.invoiceMode==='proforma'?'Proformas':E.invoiceMode==='rectificativa'?'Facturas rectificativas':'Facturas'}</h3></div><select aria-label="Filtrar por estado" onchange="opsInvoiceStatus(this.value)"><option value="all">Todos los estados</option>${['borrador','emitida','aceptada','rechazada','convertida','anulada'].map(x=>`<option value="${x}" ${E.invoiceStatus===x?'selected':''}>${x}</option>`).join('')}</select></div>${rows.length?`<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Serie</th><th></th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.issue_date?.split('-').reverse().join('/')||'—'}</td><td><b>${H(row.display_number||'Borrador')}</b></td><td>${H(row.customer_name||'—')}</td><td>${statusBadge(row.status)}</td><td class="num">${euro(row.total_amount)}</td><td>${H(O.series.find(s=>s.id===row.series_id)?.code||'')}</td><td>${row.status!=='borrador'?`<button class="ghost" onclick="opsDocumentPdf('${row.id}')">Ver</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos en esta vista.</div>'}</div></div>`;
}
function miniPreview(d,t){const tpl=E.templates.find(x=>x.id===d.templateId)||{};return `<div class="mini-head" style="border-color:${H(tpl.secondary_color||'#3B82F6')}"><div class="mini-logo">${tpl.logo_path?'LOGO':'TU LOGO'}</div><div><b>${documentLabel(d.documentType).toUpperCase()}</b><small>${H(O.series.find(s=>s.id===d.seriesId)?.prefix||'SERIE-')}####</small></div></div><div class="mini-client"><b>${H(d.customer||'Cliente')}</b><small>${H(d.taxId||'NIF/CIF')}</small></div><div class="mini-line"></div><div class="mini-line short"></div><div class="mini-total" style="color:${H(tpl.primary_color||'#17202A')}">Total ${euro(t.total)}</div>`}
window.opsDocField=function(k,v,rer=false){const d=ensureDraft();d[k]=v;if(k==='storeId'&&rer){const s=seriesFor(d).find(x=>x.store_id===v)||seriesFor(d)[0];d.seriesId=s?.id||'';}if(rer)render()};
window.opsDocLine=function(i,k,v,re=false){O.invoiceDraftLines[i][k]=v;if(re){clearTimeout(window.__docCalc);window.__docCalc=setTimeout(render,100)}};
window.opsAddDocLine=()=>{O.invoiceDraftLines.push({description:'',qty:'1',unit:'',discount:'0',vat:'21'});render()};
window.opsRemoveDocLine=i=>{if(O.invoiceDraftLines.length>1){O.invoiceDraftLines.splice(i,1);render()}};
window.opsSelectCustomer=function(id){const d=ensureDraft();d.customerId=id;const c=E.customers.find(x=>x.id===id);if(c){d.customer=c.name;d.taxId=c.tax_id||'';d.email=c.email||'';d.address=[c.address,c.postal_code,c.city,c.province,c.country].filter(Boolean).join(', ');d.payment=c.default_payment_method||'transferencia'}render()};
window.opsSaveCustomerFromDraft=async function(){if(!manager())return alert('Facturación en modo consulta.');const d=ensureDraft();if(!d.customer.trim())return alert('Indica el nombre del cliente.');let row={name:d.customer.trim(),tax_id:d.taxId.trim(),email:d.email.trim(),address:d.address.trim(),default_payment_method:d.payment,active:true,updated_at:new Date().toISOString()};let res;if(d.customerId)res=await sb.from('ops_customers').update(row).eq('id',d.customerId).select().single();else res=await sb.from('ops_customers').insert(row).select().single();if(res.error)return alert(res.error.message);await featureLoad(true);d.customerId=res.data.id;render()};
window.opsSaveDocument=async function(){if(!manager())return alert('Facturación en modo consulta.');
 const d=ensureDraft();if(!d.seriesId||!d.date||!d.customer.trim())return alert('Serie, fecha y cliente son obligatorios.');if(O.invoiceDraftLines.some(l=>!l.description.trim()||!N(l.qty)))return alert('Completa las líneas del documento.');
 try{
  const external=d.origin==='externa';let num=external?parseInt(d.externalNumber,10):null;if(external&&(!num||num<1))return alert('Indica el número usado fuera.');
  const payload={id:d.id||null,series_id:d.seriesId,store_id:d.storeId||null,issue_date:d.date,due_date:d.dueDate||null,operation_date:d.operationDate||null,origin:d.origin,document_type:d.documentType,invoice_kind:d.invoiceKind||'invoice',customer_id:d.customerId||null,customer_name:d.customer.trim(),customer_tax_id:d.taxId.trim(),customer_address:d.address.trim(),customer_email:d.email.trim(),concept:d.concept||'',payment_method:d.payment,paid_status:d.paidStatus||'pendiente',paid_date:d.paidDate||null,template_id:d.templateId||null,terms_text:d.terms||'',footer_text:d.footer||'',purchase_order_ref:d.poRef||'',include_in_income:!!d.includeIncome,notes:d.notes||''};
  const lines=O.invoiceDraftLines.map((l,i)=>({sort_order:(i+1)*10,description:l.description.trim(),quantity:N(l.qty),unit_price_base:N(l.unit),discount_pct:N(l.discount),vat_rate:N(l.vat)}));
  const file=external?document.getElementById('ops_external_doc_file')?.files?.[0]:null;
  if(file)window.__opsValidateDocumentFile(file);
  const {data:id,error}=await sb.rpc('ops_save_document_draft',{p_document:payload,p_lines:lines});if(error)throw error;
  if(external){
    if(file)await window.__opsUploadDocumentFile(file,id,d);
    const er=await sb.rpc('ops_register_external_document',{p_document_id:id,p_number:num});if(er.error)throw er.error;
  }
  await audit('facturas',d.id?'actualizar_borrador':external?'registrar_externa':'crear_borrador',id,{tipo:d.documentType,cliente:d.customer,total:draftTotals().total});
  await window.opsLoadData(true);await featureLoad(true);opsNewDocument(d.documentType);
 }catch(e){alert('No se pudo guardar: '+e.message)}
};
window.opsEditDocument=function(id){if(!manager())return alert('Facturación en modo consulta.');E.billingPanel='documents';const row=O.invoices.find(x=>x.id===id);if(!row||row.status!=='borrador')return;E.invoiceMode=row.document_type==='proforma'?'proforma':(row.invoice_kind==='rectifying'?'rectificativa':'factura');O.invoiceDraft={id:row.id,mode:E.invoiceMode,documentType:row.document_type||'factura',invoiceKind:row.invoice_kind||'invoice',origin:row.origin||'totus',seriesId:row.series_id,storeId:row.store_id||'',date:row.issue_date,dueDate:row.due_date||'',operationDate:row.operation_date||'',externalNumber:row.external_number_text||'',customerId:row.customer_id||'',customer:row.customer_name||'',taxId:row.customer_tax_id||'',address:row.customer_address||'',email:row.customer_email||'',concept:row.concept||'',payment:row.payment_method||'transferencia',paidStatus:row.paid_status||'pendiente',paidDate:row.paid_date||'',includeIncome:!!row.include_in_income,notes:row.notes||'',terms:row.terms_text||'',footer:row.footer_text||'',poRef:row.purchase_order_ref||'',templateId:row.template_id||''};O.invoiceDraftLines=O.invoiceLines.filter(l=>l.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(l=>({description:l.description,qty:String(l.quantity),unit:String(l.unit_price_base),discount:String(l.discount_pct),vat:String(l.vat_rate)}));render();window.scrollTo({top:0,behavior:'smooth'})};
window.opsFinalizeDocument=async function(id){if(!manager())return alert('Facturación en modo consulta.');const row=O.invoices.find(x=>x.id===id);if(!row)return;if(!confirm(`¿Emitir ${documentLabel(row.document_type||'factura',row.invoice_kind||'invoice').toLowerCase()}? Se asignará número definitivo y quedará bloqueado.`))return;try{const {error}=await sb.rpc('ops_finalize_document',{p_document_id:id});if(error)throw error;await audit('facturas','emitir',id,{tipo:row.document_type});await window.opsLoadData(true);await featureLoad(true);render();setTimeout(()=>opsDocumentPdf(id,true),100)}catch(e){alert('No se pudo emitir: '+e.message)}};
window.opsCreateRectifying=function(id){if(!manager())return alert('Facturación en modo consulta.');
 const src=O.invoices.find(x=>x.id===id);if(!src||src.document_type!=='factura'||src.status!=='emitida')return;
 const rectSeries=O.series.find(x=>x.store_id===src.store_id&&x.year===O.year&&x.document_type==='factura'&&x.series_kind==='rectifying'&&x.active)
   ||O.series.find(x=>x.year===O.year&&x.document_type==='factura'&&x.series_kind==='rectifying'&&x.active);
 if(!rectSeries)return alert('No hay una serie rectificativa activa para este año.');
 E.invoiceMode='rectificativa';O.tab='facturas';
 O.invoiceDraft={
  id:null,mode:'rectificativa',documentType:'factura',invoiceKind:'rectifying',origin:'totus',
  seriesId:rectSeries.id,storeId:src.store_id||'',date:today(),dueDate:'',operationDate:src.operation_date||src.issue_date||'',
  externalNumber:'',customerId:src.customer_id||'',customer:src.customer_name||'',taxId:src.customer_tax_id||'',
  address:src.customer_address||'',email:src.customer_email||'',concept:'Rectificación de '+(src.display_number||'factura'),
  payment:src.payment_method||'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,
  notes:'Rectificativa de '+(src.display_number||''),terms:src.terms_text||'',footer:src.footer_text||'',
  poRef:src.display_number||'',templateId:src.template_id||'',sourceFile:null
 };
 const lines=O.invoiceLines.filter(l=>l.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order);
 O.invoiceDraftLines=lines.length?lines.map(l=>({description:'Rectificación · '+(l.description||''),qty:String(l.quantity||1),unit:String(-N(l.unit_price_base||0)),discount:String(l.discount_pct||0),vat:String(l.vat_rate||21)})):[{description:'Rectificación de '+(src.display_number||'factura'),qty:'1',unit:String(-N(src.base_amount||0)),discount:'0',vat:'21'}];
 render();window.scrollTo({top:0,behavior:'smooth'});
};
window.opsMarkInvoicePaid=async function(id){if(!manager())return alert('Facturación en modo consulta.');
 const row=O.invoices.find(x=>x.id===id);if(!row||row.document_type!=='factura')return;
 if(!confirm('¿Marcar esta factura como cobrada?'))return;
 const {error}=await sb.from('ops_sales_invoices').update({paid_status:'pagada',paid_date:today(),updated_at:new Date().toISOString()}).eq('id',id);
 if(error)return alert('No se pudo actualizar el cobro: '+error.message);
 await audit('facturas','marcar_cobrada',id,{fecha:today()});
 await window.opsLoadData(true);await featureLoad(true);render();
};
window.opsSetProformaStatus=async function(id,status){if(!manager())return alert('Facturación en modo consulta.');const {error}=await sb.from('ops_sales_invoices').update({status}).eq('id',id).eq('document_type','proforma');if(error)return alert(error.message);await audit('facturas','estado_proforma',id,{status});await window.opsLoadData(true);render()};
window.opsConvertProforma=async function(id){if(!manager())return alert('Facturación en modo consulta.');const p=O.invoices.find(x=>x.id===id);const s=O.series.find(x=>x.store_id===p.store_id&&x.year===O.year&&x.document_type==='factura'&&(x.series_kind||'invoice')==='invoice'&&x.active)||O.series.find(x=>x.year===O.year&&x.document_type==='factura'&&(x.series_kind||'invoice')==='invoice'&&x.active);if(!s)return alert('No hay serie de factura disponible.');if(!confirm('Crear una factura borrador a partir de esta proforma?'))return;const {data,error}=await sb.rpc('ops_convert_proforma',{p_proforma_id:id,p_invoice_series_id:s.id});if(error)return alert(error.message);await window.opsLoadData(true);await featureLoad(true);E.invoiceMode='factura';opsEditDocument(data)};
function hexRgb(hex){const x=String(hex||'#17202A').replace('#','');const v=parseInt(x.length===3?x.split('').map(c=>c+c).join(''):x,16);return[(v>>16)&255,(v>>8)&255,v&255]}
async function logoData(t){if(!t?.logo_path||t.show_logo===false)return null;const {data,error}=await sb.storage.from('business-assets').download(t.logo_path);if(error)return null;return await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(data)})}
function openPdfPreview(blob,title,filename){
 const url=URL.createObjectURL(blob);
 const modal=openOpsModal(title,`<iframe class="ops-pdf-frame" title="${H(title)}"></iframe><div class="ops-preview-actions"><button type="button" class="secondary" id="ops_preview_download">Descargar PDF</button><button type="button" class="ghost" id="ops_preview_close">Cerrar</button></div>`,{wide:true});
 modal.dataset.objectUrl=url;
 modal.querySelector('.ops-pdf-frame').src=url;
 modal.querySelector('#ops_preview_download').onclick=()=>dlBlob(blob,filename);
 modal.querySelector('#ops_preview_close').onclick=closeOpsModal;
}
async function makePdf(row,lines,isDraft=false){
 if(!window.jspdf?.jsPDF)throw new Error('Generador PDF no disponible.');
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'});
 const tpl=row.design_snapshot&&Object.keys(row.design_snapshot).length?row.design_snapshot:(E.templates.find(t=>t.id===row.template_id)||E.templates.find(t=>(row.document_type==='proforma'?t.default_proforma:t.default_invoice))||E.templates[0]||{});
 const [pr,pg,pb]=hexRgb(tpl.primary_color||'#17202A'),[sr,sg,sb2]=hexRgb(tpl.secondary_color||'#3B82F6'),[tr,tg,tb]=hexRgb(tpl.text_color||'#17202A');
 const font=tpl.font_family||'helvetica',style=tpl.style||'clean',business=O.settings||{},logo=await logoData(tpl);
 const title=row.document_type==='proforma'?(tpl.proforma_title||'FACTURA PROFORMA'):(row.invoice_kind==='rectifying'?'FACTURA RECTIFICATIVA':(tpl.invoice_title||'FACTURA'));
 const number=isDraft?'BORRADOR':(row.display_number||'SIN NÚMERO');
 const margin=15,pageW=210,contentW=180,compact=style==='compact';

 const setText=()=>doc.setTextColor(tr,tg,tb);
 const box=(x,y,w,h,fill=[248,250,252],stroke=[225,231,239])=>{doc.setFillColor(...fill);doc.setDrawColor(...stroke);doc.roundedRect(x,y,w,h,2,2,'FD')};
 const label=(txt,x,y)=>{doc.setFont(font,'bold');doc.setFontSize(7.2);doc.setTextColor(100,112,125);doc.text(String(txt).toUpperCase(),x,y);setText()};
 const value=(txt,x,y,opt={})=>{doc.setFont(font,opt.bold?'bold':'normal');doc.setFontSize(opt.size||8.7);doc.text(String(txt??''),x,y,opt.options||{})};

 // Cabecera.
 if(style==='brand'){doc.setFillColor(pr,pg,pb);doc.rect(0,0,pageW,38,'F')}
 else {doc.setDrawColor(pr,pg,pb);doc.setLineWidth(style==='compact'?0.7:1.4);doc.line(margin,12,pageW-margin,12)}
 const headColor=style==='brand'?[255,255,255]:[pr,pg,pb];doc.setTextColor(...headColor);
 let logoW=Math.max(20,Math.min(58,N(tpl.logo_width_mm||34))),logoH=Math.max(10,logoW*.42);
 if(logo&&tpl.show_logo!==false){
   try{
     const fmt=String(tpl.logo_mime||'').includes('png')?'PNG':'JPEG';
     const lx=tpl.logo_position==='right'?pageW-margin-logoW:tpl.logo_position==='center'?(pageW-logoW)/2:margin;
     doc.addImage(logo,fmt,lx,style==='brand'?8:16,logoW,logoH);
   }catch(e){}
 }
 const titleOnLeft=logo&&tpl.logo_position==='right';
 const tx=titleOnLeft?margin:pageW-margin,align=titleOnLeft?'left':'right';
 doc.setFont(font,'bold');doc.setFontSize(compact?16:20);doc.text(title,tx,style==='brand'?16:22,{align});
 doc.setFont(font,'normal');doc.setFontSize(8.5);doc.text(number,tx,style==='brand'?23:29,{align});
 if(isDraft){doc.setFillColor(sr,sg,sb2);doc.roundedRect(titleOnLeft?margin:pageW-margin-27,style==='brand'?27:33,27,7,1.5,1.5,'F');doc.setTextColor(255,255,255);doc.setFont(font,'bold');doc.setFontSize(7);doc.text('BORRADOR',titleOnLeft?margin+13.5:pageW-margin-13.5,style==='brand'?31.7:37.7,{align:'center'})}
 setText();

 let y=style==='brand'?45:44;
 if(tpl.header_text){doc.setFont(font,'normal');doc.setFontSize(7.5);doc.setTextColor(92,104,116);doc.text(doc.splitTextToSize(String(tpl.header_text),contentW),margin,y);y+=10;setText()}

 // Emisor + datos del documento.
 const cardH=compact?28:34;
 box(margin,y,88,cardH);box(107,y,88,cardH);
 label('Emisor',margin+5,y+6);
 const issuer=[business.business_name,business.tax_id,business.business_address,business.business_email,business.business_phone].filter(Boolean);
 let iy=y+12;issuer.forEach((v,i)=>{doc.setFont(font,i===0?'bold':'normal');doc.setFontSize(i===0?9:7.5);doc.text(doc.splitTextToSize(String(v),76),margin+5,iy);iy+=i===0?5:4});
 label('Documento',112,y+6);
 const facts=[
  ['Número',number],
  ['Fecha',(row.issue_date||'').split('-').reverse().join('/')||'—'],
  ...(row.operation_date?[['Operación',row.operation_date.split('-').reverse().join('/')]]:[]),
  ...(row.due_date?[['Vencimiento',row.due_date.split('-').reverse().join('/')]]:[]),
  ...(row.payment_method?[['Pago',String(row.payment_method)]]:[])
 ];
 let fy=y+12;facts.slice(0,compact?4:5).forEach(([k,v])=>{doc.setFont(font,'bold');doc.setFontSize(7.3);doc.text(k+':',112,fy);doc.setFont(font,'normal');doc.text(String(v),135,fy,{maxWidth:54});fy+=4.2});
 y+=cardH+6;

 // Cliente.
 box(margin,y,contentW,compact?25:31,[246,248,251],[220,227,235]);
 label('Cliente / destinatario',margin+5,y+6);
 doc.setFont(font,'bold');doc.setFontSize(10);doc.text(String(row.customer_name||'Cliente sin nombre'),margin+5,y+13,{maxWidth:100});
 doc.setFont(font,'normal');doc.setFontSize(7.7);
 const customerLines=[row.customer_tax_id,row.customer_address,row.customer_email].filter(Boolean);
 let cy=y+18;customerLines.forEach(v=>{doc.text(doc.splitTextToSize(String(v),150),margin+5,cy);cy+=4});
 if(row.purchase_order_ref){label('Referencia',150,y+8);doc.setFont(font,'normal');doc.setFontSize(7.5);doc.text(String(row.purchase_order_ref),150,y+13,{maxWidth:40})}
 y+=compact?32:38;

 // Marca de agua proforma.
 if(row.document_type==='proforma'){doc.setTextColor(225,228,232);doc.setFont(font,'bold');doc.setFontSize(34);doc.text('PROFORMA',105,154,{align:'center',angle:35});setText()}

 // Tabla.
 const cols={desc:18,qty:112,unit:132,disc:151,vat:168,total:193};
 const drawHead=()=>{
  doc.setFillColor(sr,sg,sb2);doc.roundedRect(margin,y,contentW,8,1.5,1.5,'F');
  doc.setTextColor(255,255,255);doc.setFont(font,'bold');doc.setFontSize(7.4);
  doc.text('Descripción',cols.desc,y+5.2);doc.text('Cant.',cols.qty,y+5.2,{align:'right'});doc.text('Precio',cols.unit,y+5.2,{align:'right'});doc.text('Dto.',cols.disc,y+5.2,{align:'right'});doc.text('IVA',cols.vat,y+5.2,{align:'right'});doc.text('Total',cols.total,y+5.2,{align:'right'});
  setText();y+=11;
 };
 drawHead();doc.setFont(font,'normal');doc.setFontSize(compact?7.4:8);
 lines.forEach((l,index)=>{
  if(y>244){doc.addPage();y=18;drawHead()}
  const desc=doc.splitTextToSize(String(l.description||''),82),rowH=Math.max(compact?5.5:6.5,desc.length*3.7+2);
  if(index%2===1){doc.setFillColor(249,250,252);doc.rect(margin,y-3,contentW,rowH,'F')}
  doc.text(desc,cols.desc,y);
  doc.text(String(N(l.quantity??l.qty)||0).replace('.',','),cols.qty,y,{align:'right'});
  doc.text(euro(N(l.unit_price_base??l.unit)).replace('€','').trim(),cols.unit,y,{align:'right'});
  doc.text((N(l.discount_pct??l.discount)||0).toFixed(2).replace('.',',')+' %',cols.disc,y,{align:'right'});
  doc.text((N(l.vat_rate??l.vat)||0).toFixed(2).replace('.',',')+' %',cols.vat,y,{align:'right'});
  const total=l.total_amount!=null?N(l.total_amount):lineCalc(l).total;doc.setFont(font,'bold');doc.text(euro(total).replace('€','').trim(),cols.total,y,{align:'right'});doc.setFont(font,'normal');
  y+=rowH;
 });
 const totals=lines.reduce((acc,l)=>{const base=l.base_amount!=null?N(l.base_amount):lineCalc(l).base,vat=l.vat_amount!=null?N(l.vat_amount):lineCalc(l).vat,total=l.total_amount!=null?N(l.total_amount):lineCalc(l).total;acc.base+=base;acc.vat+=vat;acc.total+=total;return acc},{base:0,vat:0,total:0});
 y+=3;if(y>244){doc.addPage();y=22}
 box(116,y,79,compact?29:34,[248,250,252],[220,227,235]);
 label('Resumen',121,y+6);
 doc.setFont(font,'normal');doc.setFontSize(8);doc.text('Base imponible',121,y+13);doc.text(euro(totals.base),190,y+13,{align:'right'});
 doc.text('IVA',121,y+19);doc.text(euro(totals.vat),190,y+19,{align:'right'});
 doc.setFillColor(pr,pg,pb);doc.roundedRect(120,y+22,71,8,1.2,1.2,'F');doc.setTextColor(255,255,255);doc.setFont(font,'bold');doc.setFontSize(10);doc.text('TOTAL',124,y+27.5);doc.text(euro(totals.total),188,y+27.5,{align:'right'});setText();
 y+=compact?36:42;

 // Condiciones y pago.
 const terms=row.terms_text||tpl.payment_terms_default||'',bank=tpl.show_payment_details!==false?(tpl.bank_details||''):'';
 if(terms||bank){
   if(y>255){doc.addPage();y=20}
   const w=terms&&bank?86:180;
   if(terms){box(margin,y,w,24,[250,251,253]);label('Condiciones',margin+5,y+6);doc.setFont(font,'normal');doc.setFontSize(7.2);doc.text(doc.splitTextToSize(String(terms),w-10),margin+5,y+12)}
   if(bank){const x=terms?109:margin;box(x,y,w,24,[250,251,253]);label('Datos de pago',x+5,y+6);doc.setFont(font,'normal');doc.setFontSize(7.2);doc.text(doc.splitTextToSize(String(bank),w-10),x+5,y+12)}
 }

 // Pie.
 doc.setDrawColor(220,226,233);doc.line(margin,279,pageW-margin,279);
 const footer=row.footer_text||tpl.footer_text||'';doc.setFont(font,'normal');doc.setTextColor(105,115,126);doc.setFontSize(7);
 if(footer)doc.text(doc.splitTextToSize(String(footer),130),margin,284);
 const legal=row.document_type==='proforma'?'Documento proforma · no constituye factura definitiva.':(row.invoice_kind==='rectifying'?'Documento rectificativo.':'Documento emitido por Totus Central.');
 doc.text(legal,pageW-margin,284,{align:'right',maxWidth:48});
 doc.setFontSize(6.5);doc.text((business.business_email||'')+(business.tax_id?' · '+business.tax_id:''),pageW-margin,290,{align:'right'});

 return doc.output('blob');
}
window.__opsUploadDocumentFile=async function(file,entityId,d){
 const max=N(O.settings?.document_max_bytes||20971520);if(file.size>max)throw new Error('El archivo supera el límite configurado.');
 const buf=await file.arrayBuffer(),dig=await crypto.subtle.digest('SHA-256',buf),sha=[...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const dup=O.documents.find(x=>x.sha256===sha);if(dup){await sb.from('ops_sales_invoices').update({source_document_id:dup.id}).eq('id',entityId);return dup.id}
 const safe=String(file.name||'documento').replace(/[^a-zA-Z0-9._-]+/g,'_'),dt=String(d.date||today()),year=dt.slice(0,4),month=dt.slice(5,7),q='T'+Math.floor((Number(month)-1)/3+1),store=O.stores.find(x=>x.id===d.storeId)?.code||'GENERAL',type=d.documentType==='proforma'?'PROFORMAS_EXTERNAS':'FACTURAS_EXTERNAS',party=String(d.customer||'SIN_CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'SIN_CLIENTE';const path=`externos/${year}/${q}/${month}/${store}/${type}/${party}/${crypto.randomUUID()}_${safe}`;
 const up=await sb.storage.from('business-documents').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;
 const {data,error}=await sb.from('ops_documents').insert({store_id:d.storeId||null,doc_type:d.documentType==='proforma'?'proforma':'factura_emitida',document_date:d.date,supplier_or_customer:d.customer||'',tax_id:d.taxId||'',invoice_number:d.externalNumber||'',category_code:'700',status:'archivada',storage_path:path,original_name:file.name,mime_type:file.type||'application/octet-stream',size_bytes:file.size,sha256:sha,linked_entity_type:'sales_invoice_source',linked_entity_id:entityId,notes:'Documento creado fuera y registrado en Totus',uploaded_by:authSession.user.id}).select('id').single();
 if(error){await sb.storage.from('business-documents').remove([path]);throw error}await sb.from('ops_sales_invoices').update({source_document_id:data.id}).eq('id',entityId);return data.id;
};
window.opsPreviewDraft=async function(){const d=ensureDraft(),t=E.templates.find(x=>x.id===d.templateId)||{};const fake={...d,document_type:d.documentType,template_id:d.templateId,issue_date:d.date,due_date:d.dueDate,operation_date:d.operationDate,customer_name:d.customer,customer_tax_id:d.taxId,customer_address:d.address,customer_email:d.email,purchase_order_ref:d.poRef,terms_text:d.terms,footer_text:d.footer,display_number:null,design_snapshot:t};try{const blob=await makePdf(fake,O.invoiceDraftLines,true);openPdfPreview(blob,'Vista previa · '+documentLabel(d.documentType,d.invoiceKind),`vista_previa_${d.documentType}.pdf`)}catch(e){alert(e.message)}};
async function uploadGenerated(blob,row){const name=(row.display_number||row.document_type||'documento').replaceAll('/','-')+'.pdf';const file=new File([blob],name,{type:'application/pdf'});const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());const sha=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');const existing=O.documents.find(d=>d.sha256===sha);if(existing)return existing.id;const dt=String(row.issue_date||today()),year=dt.slice(0,4),month=dt.slice(5,7),q='T'+Math.floor((Number(month)-1)/3+1),store=O.stores.find(x=>x.id===row.store_id)?.code||'GENERAL',type=row.document_type==='proforma'?'PROFORMAS':'FACTURAS_EMITIDAS',party=String(row.customer_name||'SIN_CLIENTE').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'SIN_CLIENTE';const path=`emitidos/${year}/${q}/${month}/${store}/${type}/${party}/${crypto.randomUUID()}_${name}`;let u=await sb.storage.from('business-documents').upload(path,file,{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;let r=await sb.from('ops_documents').insert({store_id:row.store_id||null,doc_type:row.document_type==='proforma'?'proforma':'factura_emitida',document_date:row.issue_date,supplier_or_customer:row.customer_name||'',tax_id:row.customer_tax_id||'',invoice_number:row.display_number||'',category_code:'700',status:'archivada',storage_path:path,original_name:name,mime_type:'application/pdf',size_bytes:file.size,sha256:sha,linked_entity_type:'sales_invoice',linked_entity_id:row.id,notes:'Generado por Totus Central',uploaded_by:authSession.user.id}).select('id').single();if(r.error){await sb.storage.from('business-documents').remove([path]);throw r.error}return r.data.id}
window.opsDocumentPdf=async function(id,saveServer=false){try{let row=O.invoices.find(x=>x.id===id);if(!row)return;let blob=null;if(row.generated_document_id&&!saveServer){const d=O.documents.find(x=>x.id===row.generated_document_id);if(d){const r=await sb.storage.from('business-documents').download(d.storage_path);if(!r.error)blob=r.data}}const lines=O.invoiceLines.filter(x=>x.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order);if(!blob)blob=await makePdf(row,lines,false);if(saveServer&&!row.generated_document_id){const did=await uploadGenerated(blob,row);await sb.from('ops_sales_invoices').update({generated_document_id:did}).eq('id',id);await window.opsLoadData(true)}openPdfPreview(blob,'Documento · '+(row.display_number||documentLabel(row.document_type,row.invoice_kind)),(row.display_number||row.document_type).replaceAll('/','-')+'.pdf')}catch(e){alert('No se pudo generar PDF: '+e.message)}};
window.opsUploadTemplateLogo=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede cambiar la imagen corporativa.');
 const input=document.getElementById('ops_tpl_logo'),file=input?.files?.[0];
 if(!file)return alert('Selecciona un logo.');
 if(file.size>2097152)return alert('El logo supera 2 MB.');
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return alert('Usa PNG, JPG o WebP.');
 const tpl=E.templates.find(t=>t.id===id);if(!tpl)return alert('Plantilla no encontrada.');
 const ext=file.name.split('.').pop().toLowerCase(),path=`logos/${id}.${ext}`;
 try{
  const up=await sb.storage.from('business-assets').upload(path,file,{contentType:file.type,upsert:true});
  if(up.error)throw up.error;
  const {error}=await sb.from('ops_document_templates').update({logo_path:path,logo_name:file.name,logo_mime:file.type,logo_size_bytes:file.size,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){if(!tpl.logo_path||tpl.logo_path!==path)await sb.storage.from('business-assets').remove([path]);throw error}
  if(tpl.logo_path&&tpl.logo_path!==path)await sb.storage.from('business-assets').remove([tpl.logo_path]);
  await featureLoad(true);render();
 }catch(e){alert('No se pudo subir el logo: '+e.message)}
};
function configHtml(){
 const st=O.settings||{},used=N(E.storageUsage?.total_bytes),limit=N(st.storage_limit_bytes||1073741824),pct=limit?used/limit*100:0;
 return `<div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Empresa</div><div class="ops-title-line"><h3>Datos generales y fiscales</h3>${infoButton('config','Ayuda de configuración')}</div><div class="small">Datos comunes de la empresa. Plantillas, logo y series se gestionan exclusivamente en Facturación.</div></div><button class="primary" onclick="opsSaveSettings()" ${admin()?'':'disabled'}>Guardar cambios</button></div>
   <div class="ops-form">
    <div class="span2"><label>Nombre / titular</label><input id="ops_set_name" value="${H(st.business_name||'')}" ${admin()?'':'disabled'}></div>
    <div><label>NIF/CIF</label><input id="ops_set_tax" value="${H(st.tax_id||'')}" ${admin()?'':'disabled'}></div>
    <div class="span4"><label>Dirección fiscal</label><input id="ops_set_address" value="${H(st.business_address||'')}" ${admin()?'':'disabled'}></div>
    <div><label>Email</label><input id="ops_set_email" value="${H(st.business_email||'')}" ${admin()?'':'disabled'}></div>
    <div><label>Teléfono</label><input id="ops_set_phone" value="${H(st.business_phone||'')}" ${admin()?'':'disabled'}></div>
    <div><label>Cuota RETA actual</label><input id="ops_set_reta" inputmode="decimal" value="${H(st.actual_reta_monthly??'')}" ${admin()?'':'disabled'}></div>
    <div><label>Rendimiento año anterior</label><input id="ops_set_prevnet" inputmode="decimal" value="${H(st.previous_year_net_income??'')}" ${admin()?'':'disabled'}></div>
   </div>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Capacidad</div><h3>Almacenamiento documental</h3></div><span class="badge ${pct>=95?'badb':pct>=80?'warnb':'ok'}">${pct.toFixed(1).replace('.',',')} %</span></div><div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="ops-metric-line"><span>Uso total</span><b>${(used/1048576).toFixed(1).replace('.',',')} MB / ${Math.round(limit/1048576)} MB</b></div><div class="ops-metric-line"><span>Documentos</span><b>${N(E.storageUsage?.documents_count)} · ${(N(E.storageUsage?.documents_bytes)/1048576).toFixed(1).replace('.',',')} MB</b></div><div class="ops-metric-line"><span>Recursos de marca</span><b>${N(E.storageUsage?.assets_count)} · ${Math.round(N(E.storageUsage?.assets_bytes)/1024)} KB</b></div><div class="small">El estudio de capacidad 2026 se recalculará con los documentos definitivos antes de importarlos.</div></div>
 </div>`;
}
window.opsSelectTemplateConfig=id=>{E.templateId=id;render()};
window.opsSaveTemplate=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede editar plantillas.');
 const payload={
  name:document.getElementById('ops_tpl_name').value.trim(),
  style:document.getElementById('ops_tpl_style').value,
  primary_color:document.getElementById('ops_tpl_primary').value,
  secondary_color:document.getElementById('ops_tpl_secondary').value,
  text_color:document.getElementById('ops_tpl_text').value,
  font_family:document.getElementById('ops_tpl_font').value,
  logo_width_mm:N(document.getElementById('ops_tpl_width').value)||34,
  logo_position:document.getElementById('ops_tpl_logo_pos').value,
  show_logo:document.getElementById('ops_tpl_show_logo').checked,
  show_payment_details:document.getElementById('ops_tpl_show_pay').checked,
  invoice_title:document.getElementById('ops_tpl_invoice_title').value.trim()||'FACTURA',
  proforma_title:document.getElementById('ops_tpl_proforma_title').value.trim()||'FACTURA PROFORMA',
  header_text:document.getElementById('ops_tpl_header').value,
  payment_terms_default:document.getElementById('ops_tpl_terms').value,
  bank_details:document.getElementById('ops_tpl_bank').value,
  footer_text:document.getElementById('ops_tpl_footer').value,
  default_invoice:document.getElementById('ops_tpl_definv').checked,
  default_proforma:document.getElementById('ops_tpl_defpro').checked
 };
 if(!payload.name)return alert('El nombre de la plantilla es obligatorio.');
 if(payload.logo_width_mm<10||payload.logo_width_mm>80)return alert('El ancho del logo debe estar entre 10 y 80 mm.');
 const {error}=await sb.rpc('ops_save_document_template',{p_id:id,p_template:payload});
 if(error)return alert('No se pudo guardar la plantilla: '+error.message);
 await featureLoad(true);render();
};
window.opsDuplicateTemplate=async function(id){
 if(!manager())return;
 const src=E.templates.find(t=>t.id===id);if(!src)return;
 const name=prompt('Nombre de la nueva plantilla:',(src.name||'Plantilla')+' copia');if(!name)return;
 const row={...src};
 ['id','created_at','updated_at'].forEach(k=>delete row[k]);
 row.code='TPL-'+Date.now().toString(36).toUpperCase();
 row.name=name.trim();row.default_invoice=false;row.default_proforma=false;row.active=true;
 row.logo_path=null;row.logo_name=null;row.logo_mime=null;row.logo_size_bytes=0;
 const {data,error}=await sb.from('ops_document_templates').insert(row).select('id').single();
 if(error)return alert('No se pudo duplicar: '+error.message);
 await featureLoad(true);E.templateId=data.id;render();
};
window.opsSaveSeries=async function(id){if(!admin())return;const s=O.series.find(x=>x.id===id),prefix=document.getElementById('ser_p_'+id).value.trim(),next=parseInt(document.getElementById('ser_n_'+id).value,10),padding=parseInt(document.getElementById('ser_d_'+id).value,10);const max=Math.max(0,...O.invoices.filter(x=>x.series_id===id&&x.number!=null).map(x=>N(x.number)));if(!prefix||!next||next<=max)return alert(`El siguiente número debe ser mayor que ${max}.`);if(padding<1||padding>10)return alert('Dígitos entre 1 y 10.');const {error}=await sb.from('ops_invoice_series').update({prefix,next_number:next,padding}).eq('id',id);if(error)return alert(error.message);await window.opsLoadData(true);render()};
window.opsPreviewDoc=async function(id){
 const d=O.documents.find(x=>x.id===id);if(!d)return;
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(d.mime_type||''))return opsDownloadDoc(id);
 try{
  const {data,error}=await sb.storage.from('business-documents').download(d.storage_path);if(error)throw error;
  const url=URL.createObjectURL(data);
  const isPdf=(d.mime_type||'')==='application/pdf';
  const html=isPdf?`<iframe class="ops-pdf-frame" title="${H(d.original_name)}"></iframe>`:`<div class="ops-image-preview"><img alt="${H(d.original_name)}"></div>`;
  const modal=openOpsModal(d.original_name,html+`<div class="ops-preview-actions"><button type="button" class="secondary" id="ops_doc_preview_download">Descargar</button><button type="button" class="ghost" id="ops_doc_preview_close">Cerrar</button></div>`,{wide:true});
  modal.dataset.objectUrl=url;
  if(isPdf)modal.querySelector('iframe').src=url;else modal.querySelector('img').src=url;
  modal.querySelector('#ops_doc_preview_download').onclick=()=>dlBlob(data,d.original_name);
  modal.querySelector('#ops_doc_preview_close').onclick=closeOpsModal;
 }catch(e){alert('No se pudo abrir el documento: '+e.message)}
};
function docPartyOptions(){
 const suppliers=(O.suppliers||[]).filter(x=>x.active!==false).map(x=>`<option value="S:${x.id}">Proveedor · ${H(x.name)}${x.tax_id?' · '+H(x.tax_id):''}</option>`).join('');
 const customers=E.customers.filter(x=>x.active!==false).map(x=>`<option value="C:${x.id}">Cliente · ${H(x.name)}${x.tax_id?' · '+H(x.tax_id):''}</option>`).join('');
 return `<option value="">— Escribir manualmente —</option>${suppliers}${customers}`;
}
window.opsDocPartySelect=function(v){
 const party=document.getElementById('ops_doc_party'),tax=document.getElementById('ops_doc_tax');if(!party||!tax)return;
 if(!v)return;
 const [kind,id]=String(v).split(':');
 const row=kind==='S'?(O.suppliers||[]).find(x=>x.id===id):E.customers.find(x=>x.id===id);
 if(row){party.value=row.name||'';tax.value=row.tax_id||''}
};
window.opsOpenCustomerQuick=function(){
 const m=openOpsModal('Nuevo cliente',`<div class="ops-form"><div class="span2"><label>Nombre / razón social</label><input id="ops_qc_name"></div><div><label>NIF/CIF</label><input id="ops_qc_tax"></div><div><label>Email</label><input id="ops_qc_email" type="email"></div><div class="span2"><label>Dirección</label><input id="ops_qc_address"></div></div><div class="ops-preview-actions"><button class="primary" id="ops_qc_save">Guardar cliente</button><button class="ghost" id="ops_qc_cancel">Cancelar</button></div>`);
 m.querySelector('#ops_qc_cancel').onclick=closeOpsModal;
 m.querySelector('#ops_qc_save').onclick=async()=>{const row={name:m.querySelector('#ops_qc_name').value.trim(),tax_id:m.querySelector('#ops_qc_tax').value.trim(),email:m.querySelector('#ops_qc_email').value.trim(),address:m.querySelector('#ops_qc_address').value.trim(),default_payment_method:'transferencia',active:true,updated_at:new Date().toISOString()};if(!row.name)return m.querySelector('#ops_qc_name').focus();const {data,error}=await sb.from('ops_customers').insert(row).select().single();if(error)return alert(error.message);closeOpsModal();await featureLoad(true);render()};
};
O.docSelected=O.docSelected||[];
window.opsDocSelect=function(id,on){const set=new Set(O.docSelected||[]);on?set.add(id):set.delete(id);O.docSelected=[...set]};
window.opsDocSelectAll=function(ids,on){const set=new Set(O.docSelected||[]);ids.forEach(id=>on?set.add(id):set.delete(id));O.docSelected=[...set];render()};
window.opsDownloadSelectedDocs=async function(){const docs=O.documents.filter(d=>(O.docSelected||[]).includes(d.id));if(!docs.length)return alert('Selecciona al menos un documento.');const z=new JSZip();const done=await zipDocs(docs,z,'DOCUMENTOS_SELECCIONADOS');if(done!==docs.length)return alert(`No se pudieron descargar ${docs.length-done} documentos. No se ha generado un ZIP incompleto.`);dlBlob(await z.generateAsync({type:'blob'}),`Totus_documentos_seleccionados_${today()}.zip`)};
window.opsDeleteSelectedDocs=async function(){if(!manager())return;const docs=O.documents.filter(d=>(O.docSelected||[]).includes(d.id));if(!docs.length)return alert('Selecciona al menos un documento.');const reason=await askReason('Eliminar documentos seleccionados',`Se eliminarán ${docs.length} documentos. Cada eliminación quedará registrada.`,'Eliminar selección');if(!reason)return;for(const d of docs){const {data,error}=await sb.rpc('ops_delete_document_controlled',{p_document_id:d.id,p_reason:reason});if(error)return alert('No se pudo eliminar '+d.original_name+': '+error.message);if(data?.storage_path)await sb.storage.from('business-documents').remove([data.storage_path])}O.docSelected=[];await window.opsLoadData(true);await featureLoad(true);render()};
function documentsHtml(){
 const f=O.docFilter||{from:'',to:'',store:'all',status:'all',type:'all',q:''};
 const types=['factura_recibida','factura_emitida','factura_rectificativa','proforma','ticket','contrato','impuesto','informe','otro'];
 const rows=O.documents.filter(d=>(!f.from||d.document_date>=f.from)&&(!f.to||d.document_date<=f.to)&&(f.store==='all'||d.store_id===f.store)&&(f.status==='all'||d.status===f.status)&&(f.type==='all'||d.doc_type===f.type)&&(!f.q||[d.supplier_or_customer,d.invoice_number,d.original_name,d.notes,d.doc_type].join(' ').toLowerCase().includes(String(f.q).toLowerCase()))).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.document_date||'').localeCompare(String(a.document_date||''))).slice(0,500);
 const used=N(E.storageUsage?.total_bytes),limit=N(O.settings?.storage_limit_bytes||1073741824),pct=limit?used/limit*100:0;
 return `<div class="ops-grid"><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Archivo</div><div class="ops-title-line"><h3>Subir documento</h3>${infoButton('documentos','Ayuda sobre archivo documental')}</div><div class="small">Factura, ticket, impuesto, contrato, informe o cualquier justificante.</div></div><button class="primary" onclick="opsUploadStandaloneDoc()">Subir</button></div><div class="ops-form"><div><label>Fecha</label><input id="ops_doc_date" type="date" value="${today()}"></div><div><label>Tienda</label><select id="ops_doc_store"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}">${H(s.name)}</option>`).join('')}</select></div><div><label>Tipo</label><select id="ops_doc_type">${types.map(x=>`<option value="${x}">${H(x.replaceAll('_',' '))}</option>`).join('')}</select></div><div><label>Estado</label><select id="ops_doc_status">${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="span2"><label>Proveedor / cliente guardado</label><div class="ops-inline-field"><select aria-label="Proveedor o cliente guardado" onchange="opsDocPartySelect(this.value)">${docPartyOptions()}</select><button type="button" class="ghost" onclick="opsOpenSupplierEditor()">+ Proveedor</button><button type="button" class="ghost" onclick="opsOpenCustomerQuick()">+ Cliente</button></div><input id="ops_doc_party" style="margin-top:6px" placeholder="Nombre / razón social"></div><div><label>NIF/CIF</label><input id="ops_doc_tax"></div><div><label>Nº documento</label><input id="ops_doc_invoice"></div><div><label>Archivo</label><input id="ops_doc_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"></div></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Espacio</div><h3>${Math.round(used/1048576)} MB / ${Math.round(limit/1048576)} MB</h3></div><span class="badge ${pct>=95?'badb':pct>=80?'warnb':'ok'}">${pct.toFixed(1).replace('.',',')} %</span></div><div class="ops-progress ${pct>=95?'bad':pct>=80?'warn':''}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="ops-metric-line"><span>Documentos</span><b>${N(E.storageUsage?.documents_count)} · ${(N(E.storageUsage?.documents_bytes)/1048576).toFixed(1).replace('.',',')} MB</b></div><div class="ops-metric-line"><span>Logos y recursos</span><b>${N(E.storageUsage?.assets_count)} · ${Math.round(N(E.storageUsage?.assets_bytes)/1024)} KB</b></div><div class="small">Aviso visual al 80 % y crítico al 95 %.</div></div></div><div class="ops-card"><div class="section-head"><div><div class="eyebrow">Documentos</div><div class="ops-title-line"><h3>Buscar, revisar y preparar</h3>${infoButton('documentos.estado','Ayuda sobre estados documentales')}</div></div><div class="ops-actions"><button class="secondary" onclick="opsDownloadSelectedDocs()">Descargar selección</button>${manager()?'<button class="danger" onclick="opsDeleteSelectedDocs()">Eliminar selección</button>':''}<button class="secondary" onclick="opsZipFilteredDocs()">ZIP filtrado</button></div></div><div class="ops-filters"><div><label>Desde</label><input type="date" value="${H(f.from||'')}" onchange="opsDocFilter('from',this.value)"></div><div><label>Hasta</label><input type="date" value="${H(f.to||'')}" onchange="opsDocFilter('to',this.value)"></div><div><label>Tienda</label><select onchange="opsDocFilter('store',this.value)"><option value="all">Todas</option>${O.stores.map(s=>`<option value="${s.id}" ${f.store===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div><div><label>Tipo</label><select onchange="opsDocFilter('type',this.value)"><option value="all">Todos</option>${types.map(x=>`<option value="${x}" ${f.type===x?'selected':''}>${H(x.replaceAll('_',' '))}</option>`).join('')}</select></div><div><label>Estado</label><select onchange="opsDocFilter('status',this.value)"><option value="all">Todos</option>${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option ${f.status===x?'selected':''}>${x}</option>`).join('')}</select></div><div style="flex:1;min-width:220px"><label>Buscar</label><input value="${H(f.q||'')}" oninput="opsDocFilter('q',this.value,true)" placeholder="Proveedor, número, archivo…"></div></div>${rows.length?`<div class="ops-table-wrap" style="margin-top:12px"><table class="ops-table"><thead><tr><th><input aria-label="Seleccionar todos los documentos visibles" type="checkbox" onchange='opsDocSelectAll(${JSON.stringify(rows.map(x=>x.id))},this.checked)'></th><th>Fecha</th><th>Tienda</th><th>Tipo</th><th>Proveedor / cliente</th><th>Número</th><th>Archivo</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(d=>`<tr><td><input aria-label="Seleccionar ${H(d.original_name)}" type="checkbox" ${(O.docSelected||[]).includes(d.id)?'checked':''} onchange="opsDocSelect('${d.id}',this.checked)"></td><td>${String(d.document_date||'').split('-').reverse().join('/')||'—'}</td><td>${H(storeName(d.store_id))}</td><td>${H(d.doc_type.replaceAll('_',' '))}</td><td>${H(d.supplier_or_customer||'—')}</td><td>${H(d.invoice_number||'—')}</td><td>${H(d.original_name)}<div class="ops-tiny">${Math.round(N(d.size_bytes)/1024)} KB</div></td><td><select aria-label="Estado de ${H(d.original_name)}" onchange="opsSetDocStatus('${d.id}',this.value)">${['pendiente','pagada','revisada','preparada_gestor','entregada_gestor','archivada'].map(x=>`<option ${d.status===x?'selected':''}>${x}</option>`).join('')}</select></td><td><div class="ops-actions">${['application/pdf','image/jpeg','image/png','image/webp'].includes(d.mime_type||'')?`<button class="ghost" onclick="opsPreviewDoc('${d.id}')">Ver</button>`:''}<button class="ghost" onclick="opsDownloadDoc('${d.id}')">Descargar</button>${manager()&&!String(d.linked_entity_type||'').startsWith('sales_invoice')?`<button class="danger" onclick="opsDeleteDocument('${d.id}')">Eliminar</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`:'<div class="ops-empty">No hay documentos con esos filtros.</div>'}</div>`;
}
window.opsDeleteDocument=async function(id){
 if(!manager())return alert('Solo administración o gerencia puede eliminar documentos.');
 const d=O.documents.find(x=>x.id===id);if(!d)return;
 if(String(d.linked_entity_type||'').startsWith('sales_invoice'))return alert('Los documentos ligados a facturación no se eliminan desde el archivo.');
 if(!confirm(`¿Eliminar definitivamente ${d.original_name}? El registro desaparecerá de Totus.`))return;
 try{
  const {data,error}=await sb.rpc('ops_delete_document',{p_id:id});if(error)throw error;
  if(data?.storage_path){const rm=await sb.storage.from('business-documents').remove([data.storage_path]);if(rm.error)console.warn('Archivo físico pendiente de limpieza:',rm.error.message)}
  await audit('documentos','eliminar',id,{archivo:d.original_name});
  await window.opsLoadData(true);await featureLoad(true);render();
 }catch(e){alert('No se pudo eliminar el documento: '+e.message)}
};
function fiscalProjectionHtml(){
 const f=fiscalProjection(O.year,O.quarter,N(O.plannedSpend)),r=retaProjection();
 return `${importedStatusHtml()}
 <div class="ops-note" style="margin-top:14px"><b>Régimen fiscal configurado:</b> recargo de equivalencia / estimación directa simplificada. Esta pantalla es de control interno y previsión; las presentaciones oficiales se contrastan con gestoría.</div>
 <div class="ops-kpis" style="margin-top:14px">
  <div class="ops-kpi"><small>Ingresos acumulados</small><strong>${euro(f.income)}</strong><div class="sub">01/01 → T${O.quarter}</div></div>
  <div class="ops-kpi"><small>Gastos deducibles</small><strong>${euro(f.raw)}</strong><div class="sub">Antes de difícil justificación</div></div>
  <div class="ops-kpi"><small>Difícil justificación ${infoButton('fiscal.diff','Qué es la difícil justificación')}</small><strong>${euro(f.diff)}</strong><div class="sub">${N(O.settings?.difficult_expense_pct||5)} % · máximo ${euro(O.settings?.difficult_expense_annual_cap||2000)}</div></div>
  <div class="ops-kpi ${f.net>=0?'good':'bad'}"><small>Rendimiento neto</small><strong>${euro(f.net)}</strong></div>
  <div class="ops-kpi warn"><small>Reserva fiscal</small><strong>${euro(f.reserve)}</strong><div class="sub">130 + 111 + 115</div></div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Modelo 130</div><div class="ops-title-line"><h3>Contador IRPF T${O.quarter}</h3>${infoButton('fiscal.130','Cómo se calcula el modelo 130')}</div></div></div>
   <div class="ops-metric-line"><span>01 · Ingresos acumulados</span><b>${euro(f.income)}</b></div>
   <div class="ops-metric-line"><span>02 · Gastos deducibles + difícil justificación</span><b>${euro(f.raw+f.diff)}</b></div>
   <div class="ops-metric-line"><span>03 · Rendimiento neto</span><b>${euro(f.net)}</b></div>
   <div class="ops-metric-line"><span>04 · ${N(O.settings?.irpf_prepayment_rate||20)} %</span><b>${euro(f.gross)}</b></div>
   <div class="ops-metric-line"><span>05 · 130 anteriores</span><b>− ${euro(f.prev)}</b></div>
   <div class="ops-metric-line"><span>06 · Retenciones soportadas</span><b>− ${euro(f.ret)}</b></div>
   <div class="ops-metric-line"><span><b>Estimación pendiente</b></span><b>${euro(f.payable)}</b></div>
   <div class="ops-note warn" style="margin-top:10px">No es una liquidación oficial. Sirve para reservar caja y detectar desviaciones antes de enviar datos a gestoría.</div>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Simulador</div><div class="ops-title-line"><h3>¿Qué pasa si gasto más?</h3>${infoButton('fiscal.simulator','Cómo usar el simulador')}</div></div></div>
   <label>Gasto deducible adicional</label><input inputmode="decimal" value="${H(O.plannedSpend||'')}" oninput="opsPlannedSpend(this.value)" placeholder="0,00">
   <div class="ops-metric-line"><span>130 con simulación</span><b>${euro(f.payable)}</b></div>
   <div class="ops-metric-line"><span>Reserva con simulación</span><b>${euro(f.reserve)}</b></div>
   <div class="ops-note">No guarda ningún gasto ni altera tus datos. Borra el importe para volver al escenario real.</div>
  </div>
 </div>
 <div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Retenciones</div><h3>Otros modelos</h3></div></div>
   <div class="ops-metric-line"><span>Modelo 111 T${O.quarter}</span><b>${euro(f.m111)}</b></div>
   <div class="ops-metric-line"><span>Modelo 115 T${O.quarter}</span><b>${euro(f.m115)}</b></div>
   <div class="ops-metric-line"><span>Reserva total orientativa</span><b>${euro(f.reserve)}</b></div>
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">RETA ${O.year}</div><div class="ops-title-line"><h3>Tramo orientativo</h3>${infoButton('fiscal.reta','Cómo se estima el tramo RETA')}</div></div></div>
   <div class="ops-metric-line"><span>Rendimiento neto mensual proyectado</span><b>${euro(r.monthly)}</b></div>
   <div class="ops-metric-line"><span>Base permitida</span><b>${r.bracket?euro(r.bracket.min_base)+' – '+euro(r.bracket.max_base):'—'}</b></div>
   <div class="ops-metric-line"><span>Cuota orientativa</span><b>${r.bracket?euro(r.minQuota)+' – '+euro(r.maxQuota):'—'}</b></div>
   <div class="ops-metric-line"><span>Cuota actual registrada</span><b>${euro(O.settings?.actual_reta_monthly||0)}</b></div>
  </div>
 </div>`;
}
function managerExpenseRows(from,to){
 const headers=['Orden','Fecha','Nºfra.rec.','Nºfra.proveedor','Rt','Identificación','Concepto','Base IVA','%','Cuota IVA','Base R. Equiv.','% R.Eq.','Cuota R.Equiv.','Imputable a IRPF','Base retención','% ret.','Cuota retenida'];
 const rows=[];
 E.gestorRows.filter(r=>inRange(r.expense_date,from,to)).forEach(r=>rows.push([
   N(r.order_no),reportDate(r.expense_date),r.received_invoice_ref||'',r.supplier_invoice_no||'','',
   (r.supplier_tax_id+' '+r.supplier_name).trim(),r.concept_text,
   N(r.base_vat),N(r.vat_rate),N(r.vat_amount),N(r.re_base),N(r.re_rate),N(r.re_amount),
   N(r.imputable_irpf),N(r.withholding_base),N(r.withholding_rate),N(r.withholding_amount)
 ]));
 const lineMap=new Map();
 O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 let order=Math.max(0,...rows.map(r=>N(r[0])));
 O.expenses
  .filter(e=>!e.management_only&&e.expense_date>='2026-07-01'&&inRange(e.expense_date,from,to))
  .sort((x,y)=>x.expense_date.localeCompare(y.expense_date)||String(x.invoice_number||'').localeCompare(String(y.invoice_number||'')))
  .forEach(e=>(lineMap.get(e.id)||[]).forEach(l=>{
    const c=O.categories.find(x=>x.id===l.category_id);
    const deductible=l.deductible_irpf!==false&&!l.fixed_asset;
    const idText=`${e.supplier_tax_id||''} ${e.supplier_name||''}`.trim();
    const concept=(c?.name||l.description||'').toUpperCase();
    const base=N(l.base_amount),vat=N(l.vat_amount),re=N(l.re_amount),tax=vat+re;
    rows.push([
      ++order,reportDate(e.expense_date),'',e.invoice_number||'','',idText,concept,
      base,N(l.vat_rate),vat,N(l.re_base),N(l.re_rate),re,
      deductible?base:0,N(l.withholding_base),N(l.withholding_rate),N(l.withholding_amount)
    ]);
    if(tax){
      rows.push([
        ++order,reportDate(e.expense_date),'',e.invoice_number||'','',idText,'IVA SOPORTADO(RECARGO - REAGYP)',
        0,0,0,0,0,0,deductible?tax:0,0,0,0
      ]);
    }
  }));
 const parseDate=x=>String(x).split('/').reverse().join('-');
 rows.sort((x,y)=>parseDate(x[1]).localeCompare(parseDate(y[1]))||N(x[0])-N(y[0]));
 const last=rows.length+1;
 const totalRow=['','','','','','','TOTAL ACUMULADO',
  `=SUM(H2:H${last})`,'',`=SUM(J2:J${last})`,`=SUM(K2:K${last})`,'',`=SUM(M2:M${last})`,`=SUM(N2:N${last})`,`=SUM(O2:O${last})`,'',`=SUM(Q2:Q${last})`];
 return[headers,...rows,totalRow];
}
function managerExpenseSummaryRows(from,to){
 const groups=new Map();
 const add=(code,description,base=0,vat=0,reBase=0,re=0,irpf=0,retBase=0,ret=0)=>{
  const key=String(code||'')+'|'+String(description||'SIN CONCEPTO').toUpperCase();
  if(!groups.has(key))groups.set(key,{code:String(code||''),description:String(description||'SIN CONCEPTO').toUpperCase(),base:0,vat:0,reBase:0,re:0,irpf:0,retBase:0,ret:0});
  const g=groups.get(key);g.base+=N(base);g.vat+=N(vat);g.reBase+=N(reBase);g.re+=N(re);g.irpf+=N(irpf);g.retBase+=N(retBase);g.ret+=N(ret);
 };
 E.gestorRows.filter(r=>inRange(r.expense_date,from,to)).forEach(r=>add(r.concept_code,r.concept_text,r.base_vat,r.vat_amount,r.re_base,r.re_amount,r.imputable_irpf,r.withholding_base,r.withholding_amount));
 const lineMap=new Map();O.expenseLines.forEach(l=>{if(!lineMap.has(l.expense_id))lineMap.set(l.expense_id,[]);lineMap.get(l.expense_id).push(l)});
 O.expenses.filter(e=>!e.management_only&&e.expense_date>='2026-07-01'&&inRange(e.expense_date,from,to)).forEach(e=>(lineMap.get(e.id)||[]).forEach(l=>{
  const c=O.categories.find(x=>x.id===l.category_id),deductible=l.deductible_irpf!==false&&!l.fixed_asset;
  const base=N(l.base_amount),vat=N(l.vat_amount),re=N(l.re_amount),tax=vat+re;
  add(c?.manager_code||'',c?.name||l.description,base,vat,N(l.re_base),re,deductible?base:0,N(l.withholding_base),N(l.withholding_amount));
  if(tax)add('632','IVA SOPORTADO(RECARGO - REAGYP)',0,0,0,0,deductible?tax:0,0,0);
 }));
 const body=[...groups.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code))||a.description.localeCompare(b.description)).map(g=>[g.code,g.description,g.base,g.vat,g.reBase,g.re,g.irpf,g.retBase,g.ret]);
 const last=body.length+1;
 return [['Código','Descripción','Base IVA','Cuota IVA','Base R. Equiv.','Cuota R. Equiv.','Imputable IRPF','Base retención','Cuota retenida'],
  ...body,['','TOTAL',`=SUM(C2:C${last})`,`=SUM(D2:D${last})`,`=SUM(E2:E${last})`,`=SUM(F2:F${last})`,`=SUM(G2:G${last})`,`=SUM(H2:H${last})`,`=SUM(I2:I${last})`]];
}
function managerIncomeRows(from,to){
 const headers=['Orden','Fecha','Nº factura','Rect.','Identificación del Cliente','Concepto','Base IVA','%','Cuota IVA','Base R. Equiv.','% R.Eq.','Cuota R.Equiv.','Imputable a IRPF','Base retención','% ret.','Cuota retenida'];
 const groups=new Map();
 E.historicalIncome.filter(x=>x.period_start>=from&&x.period_end<=to).forEach(x=>groups.set(x.store_id+'|'+x.period_start.slice(0,7),{store:x.store_id,date:x.period_end,total:N(x.official_total_income??x.total_income),historical:true}));
 O.closings.filter(c=>c.include_in_income!==false&&inRange(c.business_date,from,to)&&!coveredByHistoricalIncome(c)).forEach(c=>{
   const k=c.store_id+'|'+c.business_date.slice(0,7),v=groups.get(k)||{store:c.store_id,date:new Date(+c.business_date.slice(0,4),+c.business_date.slice(5,7),0).toISOString().slice(0,10),total:0};
   v.total+=N(c.cash_sales)+N(c.card_sales)+N(c.bizum_sales)+N(c.online_sales)+N(c.other_income);groups.set(k,v)
 });
 let i=0;
 const rows=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||storeName(a.store).localeCompare(storeName(b.store))).map(v=>{
   const m=+v.date.slice(5,7),y=v.date.slice(2,4),sn=storeName(v.store).toUpperCase(),alc=sn.includes('NEW');
   const ref=`${monthName(m)}${y}${alc?'ALC':''}`;
   return[++i,reportDate(v.date),ref,'',`VENTAS ${monthName(m)} ${alc?'ALCALA':'AZUQUECA'}`,'VENTAS - INGRESOS',v.total,0,0,0,0,0,v.total,0,0,0]
 });
 const last=rows.length+1;
 return[headers,...rows,['','','','','','TOTAL ACUMULADO',`=SUM(G2:G${last})`,'',0,0,'',0,`=SUM(M2:M${last})`,0,'',0]];
}
function wbBlob(sheets){
 if(!window.XLSX)throw new Error('Excel no disponible');
 const wb=XLSX.utils.book_new();
 const palettes={GASTOS:['0F766E','D1FAE5'],INGRESOS:['1D4ED8','DBEAFE'],RESUMEN:['6D28D9','EDE9FE'],default:['334155','E2E8F0']};
 for(const [name,rows] of Object.entries(sheets)){
  const ws=XLSX.utils.aoa_to_sheet(rows),upper=name.toUpperCase();
  for(const addr of Object.keys(ws)){
   if(addr[0]==='!')continue;
   const cell=ws[addr];
   if(typeof cell?.v==='string'&&cell.v.startsWith('=')){cell.f=cell.v.slice(1);cell.t='n';cell.v=0}
  }
  const palette=palettes[upper]||palettes[upper.includes('GAST')?'GASTOS':upper.includes('INGRES')?'INGRESOS':upper.includes('RESUM')?'RESUMEN':'default'];
  const ref=ws['!ref']?XLSX.utils.decode_range(ws['!ref']):{s:{r:0,c:0},e:{r:0,c:0}};
  const widthCount=Math.max(1,...rows.map(r=>r.length));
  ws['!cols']=Array.from({length:widthCount},(_,i)=>{
    let max=10;for(const row of rows){const v=row[i];if(v!=null)max=Math.max(max,String(v).length+2)}
    const textHeavy=i===5||i===6||i===1;return{wch:Math.min(textHeavy?38:22,max)};
  });
  ws['!rows']=rows.map((_,i)=>({hpt:i===0?24:19}));
  ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
  if(rows.length&&rows[0].length)ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,rows.length-1),c:rows[0].length-1}})};
  for(let r=ref.s.r;r<=ref.e.r;r++)for(let c=ref.s.c;c<=ref.e.c;c++){
    const addr=XLSX.utils.encode_cell({r,c}),cell=ws[addr];if(!cell)continue;
    cell.s={font:{name:'Aptos',sz:r===0?10:9,bold:r===0,color:{rgb:r===0?'FFFFFF':'1F2937'}},fill:{fgColor:{rgb:r===0?palette[0]:'FFFFFF'}},alignment:{vertical:'center',horizontal:r===0?'center':(typeof cell.v==='number'?'right':'left'),wrapText:true},border:{top:{style:'thin',color:{rgb:'D7DEE7'}},bottom:{style:'thin',color:{rgb:'D7DEE7'}},left:{style:'thin',color:{rgb:'E5E7EB'}},right:{style:'thin',color:{rgb:'E5E7EB'}}}};
    if(typeof cell.v==='number')cell.z='#,##0.00;[Red]-#,##0.00';
    if(r>0&&rows[r]?.some(v=>String(v||'').toUpperCase().includes('TOTAL'))){
      cell.s.font={name:'Aptos',sz:9,bold:true,color:{rgb:'111827'}};
      cell.s.fill={fgColor:{rgb:palette[1]}};
      cell.s.border={top:{style:'medium',color:{rgb:palette[0]}},bottom:{style:'thin',color:{rgb:palette[0]}}};
    }
  }
  XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
 }
 return new Blob([XLSX.write(wb,{bookType:'xlsx',type:'array',cellStyles:true})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function dailyWorkbook(storeId,year){
 const sheets={};
 const weekdays=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 for(let m=1;m<=12;m++){
  const first=`${year}-${String(m).padStart(2,'0')}-01`,last=new Date(year,m,0).toISOString().slice(0,10);
  const byDate=new Map();
  const add=(date,row)=>{if(!byDate.has(date))byDate.set(date,[]);byDate.get(date).push(row)};
  E.legacyRows.filter(r=>r.store_id===storeId&&inRange(r.row_date,first,last)).forEach(r=>{
    add(r.row_date,{desc:r.description||'',price:N(r.expense_amount)||'',card:N(r.card_amount)||'',cash:N(r.cash_withdrawal)||'',source:'legacy'});
  });
  const maxLegacy=E.legacyRows.filter(r=>r.store_id===storeId&&r.row_date).reduce((x,r)=>r.row_date>x?r.row_date:x,'');
  O.expenses.filter(e=>e.store_id===storeId&&inRange(e.expense_date,first,last)&&(!maxLegacy||e.expense_date>maxLegacy)).forEach(e=>{
    add(e.expense_date,{desc:e.supplier_name||e.description||'Gasto',price:N(e.accounting_amount||e.gross_expense),card:'',cash:'',source:'new'});
  });
  O.closings.filter(c=>c.store_id===storeId&&inRange(c.business_date,first,last)&&(!maxLegacy||c.business_date>maxLegacy)).forEach(c=>{
    add(c.business_date,{desc:'',price:'',card:N(c.card_sales)||'',cash:N(c.cash_withdrawals)||'',source:'new'});
  });
  const rows=[['Dia','Gastos','Precio','Tarjeta','Salida de caja']];
  [...byDate.keys()].sort().forEach(date=>{
    const entries=byDate.get(date);
    const d=new Date(date+'T12:00:00');
    const label=`${Number(date.slice(8,10))} ${weekdays[d.getDay()]}`;
    entries.forEach((r,i)=>rows.push([i===0?label:'',r.desc,r.price,r.card,r.cash]));
  });
  const firstData=2,lastData=Math.max(2,rows.length);
  rows.push(['','TOTAL',`=SUM(C${firstData}:C${lastData})`,`=SUM(D${firstData}:D${lastData})`,`=SUM(E${firstData}:E${lastData})`]);
  sheets[monthName(m)[0]+monthName(m).slice(1).toLowerCase()]=rows;
 }
 return wbBlob(sheets);
}
window.opsDownloadDailyExcel=function(storeId){try{dlBlob(dailyWorkbook(storeId,O.year),`Gastos_y_ventas_${storeName(storeId).replace(/\s+/g,'_')}_${O.year}.xlsx`)}catch(e){alert(e.message)}};
window.opsDownloadManagerExpenses=function(){try{dlBlob(wbBlob({'GASTOS':managerExpenseRows(O.reportFrom,O.reportTo),'DESGLOSE CONCEPTOS':managerExpenseSummaryRows(O.reportFrom,O.reportTo)}),`GASTOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`)}catch(e){alert(e.message)}};
window.opsDownloadManagerIncome=function(){try{dlBlob(wbBlob({'INGRESOS':managerIncomeRows(O.reportFrom,O.reportTo)}),`INGRESOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`)}catch(e){alert(e.message)}};
function fiscalRows(){const f=fiscalProjection();const r=retaProjection();return[['Concepto','Importe'],['Ingresos acumulados',f.income],['Gastos deducibles',f.raw],['Difícil justificación',f.diff],['Rendimiento neto',f.net],['Modelo 130 estimado',f.payable],['Modelo 111',f.m111],['Modelo 115',f.m115],['Reserva total',f.reserve],['Rendimiento mensual RETA',r.monthly]]}
window.opsManagementWorkbook=function(){const close=[['Fecha','Establecimiento','Apertura','Efectivo','Tarjeta','Bizum','Online','Salida','Caja final'],...O.closings.filter(c=>inRange(c.business_date,O.reportFrom,O.reportTo)).sort((a,b)=>a.business_date.localeCompare(b.business_date)).map(c=>[c.business_date,storeName(c.store_id),N(c.opening_cash),N(c.cash_sales),N(c.card_sales),N(c.bizum_sales),N(c.online_sales),N(c.cash_withdrawals),N(c.actual_cash)])];const inv=[['Fecha','Tipo','Número','Cliente','Estado','Base','IVA','Total'],...O.invoices.filter(i=>inRange(i.issue_date,O.reportFrom,O.reportTo)).sort((a,b)=>a.issue_date.localeCompare(b.issue_date)).map(i=>[i.issue_date,i.document_type,i.display_number||'',i.customer_name,i.status,N(i.base_amount),N(i.vat_amount),N(i.total_amount)])];dlBlob(wbBlob({Resumen:fiscalRows(),Cierres:close,Gastos:managerExpenseRows(O.reportFrom,O.reportTo),Facturas:inv}),`Totus_Gestion_${O.reportFrom}_${O.reportTo}.xlsx`)};
window.opsFiscalPdf=function(){if(!window.jspdf?.jsPDF)return alert('PDF no disponible');const {jsPDF}=window.jspdf,d=new jsPDF(),f=fiscalProjection(),r=retaProjection();d.setFontSize(18);d.text(`Totus Central · Fiscal T${O.quarter} ${O.year}`,15,18);d.setFontSize(10);let y=32;[['Ingresos acumulados',f.income],['Gastos deducibles',f.raw+f.diff],['Rendimiento neto',f.net],['Modelo 130 estimado',f.payable],['Modelo 111',f.m111],['Modelo 115',f.m115],['Reserva fiscal',f.reserve],['RETA mensual proyectado',r.monthly]].forEach(x=>{d.text(x[0],15,y);d.text(euro(x[1]),195,y,{align:'right'});y+=8});d.setFontSize(8);d.text('Control interno basado en los datos de Totus y los cierres de gestoría importados. Validar antes de presentar modelos oficiales.',15,y+8,{maxWidth:180});dlBlob(d.output('blob'),`Fiscal_T${O.quarter}_${O.year}.pdf`)};
function gestorDocFolder(doc,base){
 const dt=doc.document_date||'sin_fecha';
 const year=dt.slice(0,4)||'SIN_ANO';
 const month=dt.slice(5,7)||'SIN_MES';
 const q=dt.length>=7?'T'+(Math.floor((Number(month)-1)/3)+1):'SIN_TRIMESTRE';
 const store=doc.store_id?(O.stores.find(x=>x.id===doc.store_id)?.code||'TIENDA'):'GENERAL';
 const type=String(doc.doc_type||'otro').replace(/[^a-zA-Z0-9_-]+/g,'_');
 const party=String(doc.supplier_or_customer||'SIN_PROVEEDOR').replace(/[^a-zA-Z0-9._-]+/g,'_');
 return [base,'05_DOCUMENTOS',year,q,month,store,type,party].join('/');
}
window.opsGestorPack=async function(){
 if(!window.JSZip||!window.XLSX)return alert('ZIP/Excel no disponible');
 const z=new JSZip(),base=`GESTORIA_${O.reportFrom}_${O.reportTo}`;
 z.file(base+`/01_INGRESOS/INGRESOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`,wbBlob({'INGRESOS':managerIncomeRows(O.reportFrom,O.reportTo)}));
 z.file(base+`/02_GASTOS/GASTOS_${O.reportFrom}_${O.reportTo}_gestoria.xlsx`,wbBlob({'GASTOS':managerExpenseRows(O.reportFrom,O.reportTo),'DESGLOSE CONCEPTOS':managerExpenseSummaryRows(O.reportFrom,O.reportTo)}));
 for(const st of O.stores){
  z.file(base+`/03_DIARIOS/Diario_${storeName(st.id).replace(/\s+/g,'_')}_${O.year}.xlsx`,dailyWorkbook(st.id,O.year));
 }
 const close=[['Fecha','Establecimiento','Apertura','Efectivo','Tarjeta','Bizum','Online','Salida','Caja final'],
   ...O.closings.filter(c=>inRange(c.business_date,O.reportFrom,O.reportTo))
    .sort((a,b)=>String(a.business_date).localeCompare(String(b.business_date))||storeName(a.store_id).localeCompare(storeName(b.store_id)))
    .map(c=>[c.business_date,storeName(c.store_id),N(c.opening_cash),N(c.cash_sales),N(c.card_sales),N(c.bizum_sales),N(c.online_sales),N(c.cash_withdrawals),N(c.actual_cash)])];
 z.file(base+`/04_RESUMEN/Totus_Gestion_${O.reportFrom}_${O.reportTo}.xlsx`,wbBlob({
   Resumen:fiscalRows(),
   Cierres:close,
   Gastos:managerExpenseRows(O.reportFrom,O.reportTo),
   Ingresos:managerIncomeRows(O.reportFrom,O.reportTo)
 }));
 const internalExpenseIds=new Set(O.expenses.filter(e=>e.management_only).map(e=>e.id));
 const docs=O.documents
  .filter(d=>inRange(d.document_date,O.reportFrom,O.reportTo))
  .filter(d=>!(d.linked_entity_type==='expense'&&internalExpenseIds.has(d.linked_entity_id)))
  .sort((a,b)=>String(a.document_date||'').localeCompare(String(b.document_date||''))||String(a.supplier_or_customer||'').localeCompare(String(b.supplier_or_customer||'')));
 for(const doc of docs){
   const {data,error}=await sb.storage.from('business-documents').download(doc.storage_path);
   if(error)continue;
   const inv=String(doc.invoice_number||'SIN_NUMERO').replace(/[^a-zA-Z0-9._-]+/g,'_');
   const original=String(doc.original_name||'documento').replace(/[^a-zA-Z0-9._-]+/g,'_');
   z.file(gestorDocFolder(doc,base)+`/${doc.document_date||'sin_fecha'}_${inv}_${original}`,data);
 }
 z.file(base+'/00_LEEME.txt',
   'PAQUETE DE GESTORIA GENERADO POR TOTUS CENTRAL\r\n\r\n'+
   '01_INGRESOS: estructura de ingresos facilitada por gestoría.\r\n'+
   '02_GASTOS: estructura de gastos facilitada por gestoría.\r\n'+
   '03_DIARIOS: libros diarios de Hortimatic y NewOldSmok.\r\n'+
   '04_RESUMEN: libro global de control.\r\n'+
   '05_DOCUMENTOS: año > trimestre > mes > establecimiento > tipo > proveedor/cliente.\r\n\r\n'+
   'Los gastos marcados como SOLO CONTROL INTERNO no se incluyen en los ficheros ni documentos para gestoría.\r\n'+
   'Periodo: '+O.reportFrom+' a '+O.reportTo+'\r\n'
 );
 dlBlob(await z.generateAsync({type:'blob'}),`PAQUETE_GESTOR_${O.reportFrom}_${O.reportTo}.zip`);
};
function reportsHtml(){return `<div class="ops-card"><div class="section-head"><div><div class="eyebrow">Descargas</div><div class="ops-title-line"><h3>Informes, Excel diario y gestoría</h3>${infoButton('informes','Ayuda sobre informes')}</div><div class="small">Orden cronológico y columnas alineadas con tus hojas y los informes de gestoría.</div></div></div><div class="ops-filters"><div><label>Desde</label><input type="date" value="${H(O.reportFrom)}" onchange="opsReportField('from',this.value)"></div><div><label>Hasta</label><input type="date" value="${H(O.reportTo)}" onchange="opsReportField('to',this.value)"></div></div><div class="ops-grid-3" style="margin-top:14px"><div class="ops-card"><h4>Gastos · formato gestoría</h4><p class="small">Orden, fecha, factura, identificación, concepto, IVA, RE, IRPF y retenciones.</p><button class="secondary" onclick="opsDownloadManagerExpenses()">Descargar XLSX</button></div><div class="ops-card"><h4>Ingresos · formato gestoría</h4><p class="small">Resumen mensual por Azuqueca/Hortimatic y Alcalá/NewOldSmok.</p><button class="secondary" onclick="opsDownloadManagerIncome()">Descargar XLSX</button></div><div class="ops-card"><h4>Excel diario Hortimatic</h4><p class="small">12 hojas: Día · Gastos · Precio · Tarjeta · Salida de caja.</p><button class="secondary" onclick="opsDownloadDailyExcel('${O.stores.find(s=>s.code==='HORTIMATIC')?.id||''}')">Descargar XLSX</button></div><div class="ops-card"><h4>Excel diario NewOldSmok</h4><p class="small">Misma estructura que tu libro actual.</p><button class="secondary" onclick="opsDownloadDailyExcel('${O.stores.find(s=>s.code==='NEWOLDSMOK')?.id||''}')">Descargar XLSX</button></div><div class="ops-card"><h4>Libro completo Totus</h4><p class="small">Resumen, cierres, gastos y facturación en un único Excel.</p><button class="secondary" onclick="opsManagementWorkbook()">Descargar XLSX</button></div><div class="ops-card"><h4>Informe fiscal</h4><p class="small">130, 111, 115, resultado y RETA orientativo.</p><button class="secondary" onclick="opsFiscalPdf()">Descargar PDF</button></div><div class="ops-card"><h4>Documentos</h4><p class="small">Archivos de la franja seleccionada ordenados por fecha.</p><button class="secondary" onclick="opsZipReportDocs()">Descargar ZIP</button></div><div class="ops-card report-card featured"><div class="ops-title-line"><h4>Paquete gestor</h4>${infoButton('informes.gestor','Qué incluye el paquete')}</div><p class="small">Carpetas 01_INGRESOS · 02_GASTOS · 03_DIARIOS · 04_RESUMEN · 05_DOCUMENTOS, con un LEEME y sin gastos internos.</p><button class="primary" onclick="opsGestorPack()">Preparar paquete gestor</button></div></div></div>`}
function bodyForTab(tab){
 if(!E.loaded)return null;
 if(tab==='resumen')return dashboardHtml();
 if(tab==='facturas')return manager()?invoicesHtml():invoicesReadOnlyHtml();
 if(tab==='documentos')return documentsHtml();
 if(tab==='fiscal')return fiscalProjectionHtml();
 if(tab==='informes')return reportsHtml();
 if(tab==='config')return (window.adminStripHtml?window.adminStripHtml('config'):'')+configHtml();
 return null;
}
window.TotusGestionFeatures={load:featureLoad,body:bodyForTab};
// Expose selected helpers for automated tests without changing production behaviour.
window.__TotusOpsTest={incomeTotal,deductibleExpenseTotal,fiscalProjection,managerExpenseRows,managerExpenseSummaryRows,managerIncomeRows,dailyWorkbook,makePdf,lineCalc,draftTotals};
})();