
(()=>{
'use strict';

const B=window.BillingV7={
 loaded:false,loading:false,error:'',
 sub:'invoices',
 templates:[],proSeries:[],proformas:[],proLines:[],
 invoiceDraft:null,invoiceLines:[],
 proDraft:null,proDraftLines:[],
 templateId:null,seriesEdit:null,
 selectedInvoiceId:null,selectedProformaId:null,
 saving:false
};

const O=window.TotusGestion;
const H=v=>esc(v);
const N=v=>parseNum(v);
const E=v=>eur(v);
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(iso,days)=>{const d=new Date((iso||today())+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const roleManager=()=>['admin','gerente'].includes(currentRole());
const fmtDate=v=>{if(!v)return'—';const [y,m,d]=String(v).slice(0,10).split('-');return `${d}/${m}/${y}`};
const dataUrlFromBlob=blob=>new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(blob)});
const slug=s=>String(s||'doc').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'');
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},900)}
function badge(v){const good=['emitida','pagada','aceptada','convertida','enviada'];const bad=['anulada','rechazada'];return `<span class="badge ${good.includes(v)?'ok':bad.includes(v)?'badb':'warnb'}">${H(String(v||'').replaceAll('_',' '))}</span>`}

async function selectAll(table,orderCol=null,asc=false){
 const out=[];let from=0;
 while(true){
  let q=sb.from(table).select('*');
  if(orderCol)q=q.order(orderCol,{ascending:asc});
  q=q.range(from,from+999);
  const {data,error}=await q;if(error)throw error;
  out.push(...(data||[]));if(!data||data.length<1000)break;from+=1000;
 }
 return out;
}

function normalizeTemplate(t){
 const styles={brand:'modern',clean:'minimal',compact:'classic',modern:'modern',minimal:'minimal',classic:'classic'};
 return {...t,
  style_code:styles[t.style_code||t.style]||'modern',
  is_default:t.is_default??t.default_invoice??false,
  payment_terms:t.payment_terms??t.payment_terms_default??'',
  notes_default:t.notes_default??'',
  logo_position:t.logo_position||'left',
  show_company_email:t.show_company_email!==false,
  show_company_phone:t.show_company_phone!==false
 };
}
function dbTemplateStyle(code){return ({modern:'brand',minimal:'clean',classic:'compact'})[code]||'brand'}
async function load(force=false){
 if(B.loading)return;
 if(B.loaded&&!force)return;
 B.loading=true;B.error='';
 try{
  const [templates,proSeries,proformas,proLines]=await Promise.all([
   selectAll('ops_document_templates','name',true),
   selectAll('ops_proforma_series','year',false),
   selectAll('ops_proformas','issue_date',false),
   selectAll('ops_proforma_lines','sort_order',true)
  ]);
  B.templates=templates.filter(x=>x.active!==false).map(normalizeTemplate);
  B.proSeries=proSeries.filter(x=>x.active!==false);
  B.proformas=proformas;
  B.proLines=proLines;
  if(!B.templateId)B.templateId=(B.templates.find(x=>x.is_default)||B.templates[0])?.id||null;
  if(!B.invoiceDraft){B.invoiceDraft=newInvoiceDraft();B.invoiceLines=[newLine()]}
  if(!B.proDraft){B.proDraft=newProDraft();B.proDraftLines=[newLine()]}
  B.loaded=true;
 }catch(e){B.error=e.message||String(e)}
 finally{B.loading=false}
}
B.ensure=async()=>{await load();render()};

function activeTemplate(id){
 return B.templates.find(x=>x.id===id)||B.templates.find(x=>x.is_default)||B.templates[0]||{
  name:'Totus Modern',style_code:'modern',primary_color:'#19D3C5',secondary_color:'#101B27',font_family:'helvetica'
 };
}
function invoiceSeries(kind='invoice',storeId=null){
 return O.series.filter(s=>s.year===O.year&&s.active!==false&&(s.document_type||'factura')==='factura'&&(s.series_kind||'invoice')===kind&&(!storeId||!s.store_id||s.store_id===storeId));
}
function proformaSeries(storeId=null){
 return B.proSeries.filter(s=>s.year===O.year&&s.active!==false&&(!storeId||!s.store_id||s.store_id===storeId));
}
function newLine(){return{description:'',qty:'1',unit:'',discount:'0',vat:'21'}}
function lineCalc(l){const q=N(l.qty),u=N(l.unit),d=N(l.discount),base=q*u*(1-d/100),vat=base*N(l.vat)/100;return{base,vat,total:base+vat}}
function totals(lines){return lines.reduce((a,l)=>{const x=lineCalc(l);a.base+=x.base;a.vat+=x.vat;a.total+=x.total;return a},{base:0,vat:0,total:0})}
function defaultStore(){return O.storeId!=='all'?O.storeId:(O.stores[0]?.id||'')}
function newInvoiceDraft(){
 const storeId=defaultStore(),kind='invoice',ser=invoiceSeries(kind,storeId)[0];
 const tpl=(B.templates.find(x=>x.is_default)||B.templates[0])?.id||O.settings?.default_invoice_template_id||'';
 return {id:null,origin:'totus',kind,storeId,seriesId:ser?.id||'',templateId:tpl,date:today(),dueDate:addDays(today(),15),externalNumber:'',
  customer:'',taxId:'',address:'',email:'',concept:'',payment:'transferencia',paidStatus:'pendiente',paidDate:'',includeIncome:false,notes:O.settings?.invoice_notes_default||''};
}
function newProDraft(){
 const storeId=defaultStore(),ser=proformaSeries(storeId)[0];
 const tpl=(B.templates.find(x=>x.default_proforma)||B.templates.find(x=>x.is_default)||B.templates[0])?.id||O.settings?.default_invoice_template_id||'';
 return {id:null,storeId,seriesId:ser?.id||'',templateId:tpl,date:today(),validUntil:addDays(today(),30),customer:'',taxId:'',address:'',email:'',concept:'',payment:'transferencia',notes:O.settings?.invoice_notes_default||''};
}
function storeName(id){return O.stores.find(x=>x.id===id)?.name||'General'}

function subnav(){
 const tabs=[['invoices','Facturas'],['proformas','Proformas'],['templates','Plantillas'],['series','Numeración']];
 return `<div class="bill-subnav">${tabs.map(([id,t])=>`<button class="${B.sub===id?'active':''}" onclick="billTab('${id}')">${t}</button>`).join('')}</div>`;
}
function top(){
 return `<div class="bill-head"><div><div class="eyebrow">Facturación</div><h2>Documentos de venta</h2><p>Editor por bloques, numeración controlada, proformas y plantillas corporativas.</p></div><div class="bill-head-actions">${B.sub==='invoices'?'<button class="primary" onclick="billNewInvoice()">Nueva factura</button>':''}${B.sub==='proformas'?'<button class="primary" onclick="billNewProforma()">Nueva proforma</button>':''}</div></div>`;
}

B.html=function(){
 if(!B.loaded&&!B.loading){setTimeout(()=>B.ensure(),0)}
 if(B.error)return `<div class="ops-card ops-danger"><h3>No se pudo cargar Facturación</h3><p>${H(B.error)}</p><button class="primary" onclick="BillingV7.ensure()">Reintentar</button></div>`;
 if(!B.loaded)return `<div class="ops-card"><h3>Preparando facturación…</h3><p class="small">Cargando plantillas, proformas y numeración.</p></div>`;
 let body=B.sub==='invoices'?invoicesHtml():B.sub==='proformas'?proformasHtml():B.sub==='templates'?templatesHtml():seriesHtml();
 return `<div class="billing-v7">${top()}${subnav()}${body}</div>`;
};

window.billTab=function(id){B.sub=id;render();window.scrollTo({top:0,behavior:'smooth'})};

/* ---------------- FACTURAS ---------------- */
function invoiceRows(){
 return O.invoices.filter(x=>String(x.issue_date||'').startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)).slice(0,300)
}
function invoiceEditor(){
 const d=B.invoiceDraft||newInvoiceDraft(),ls=B.invoiceLines.length?B.invoiceLines:[newLine()],t=totals(ls);
 const series=invoiceSeries(d.kind,d.storeId);
 const tpl=activeTemplate(d.templateId);
 const external=d.origin==='externa';
 return `<div class="bill-editor">
  <div class="bill-editor-main">
   <div class="bill-section">
    <div class="bill-section-title"><span>1</span><div><b>Documento</b><small>Tipo, fecha, serie y diseño</small></div></div>
    <div class="bill-grid">
     <div><label>Tipo</label><select onchange="billInvoiceField('kind',this.value,true)"><option value="invoice" ${d.kind==='invoice'?'selected':''}>Factura</option><option value="rectifying" ${d.kind==='rectifying'?'selected':''}>Rectificativa</option></select></div>
     <div><label>Origen</label><select onchange="billInvoiceField('origin',this.value,true)"><option value="totus" ${!external?'selected':''}>Crear en Totus</option><option value="externa" ${external?'selected':''}>Ya creada fuera</option></select></div>
     <div><label>Fecha</label><input type="date" value="${H(d.date)}" oninput="billInvoiceField('date',this.value)"></div>
     <div><label>Vencimiento</label><input type="date" value="${H(d.dueDate||'')}" oninput="billInvoiceField('dueDate',this.value)"></div>
     <div><label>Establecimiento</label><select onchange="billInvoiceField('storeId',this.value,true)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div>
     <div><label>Serie</label><select onchange="billInvoiceField('seriesId',this.value)">${series.map(s=>`<option value="${s.id}" ${d.seriesId===s.id?'selected':''}>${H(s.code)} · ${H(s.prefix)}${String(s.next_number).padStart(s.padding,'0')}</option>`).join('')}</select></div>
     <div><label>Plantilla</label><select onchange="billInvoiceField('templateId',this.value,true)">${B.templates.map(x=>`<option value="${x.id}" ${d.templateId===x.id?'selected':''}>${H(x.name)}</option>`).join('')}</select></div>
     ${external?`<div><label>Número ya emitido</label><input inputmode="numeric" value="${H(d.externalNumber)}" oninput="billInvoiceField('externalNumber',this.value)" placeholder="Ej. 27"></div>`:''}
    </div>
   </div>

   <div class="bill-section">
    <div class="bill-section-title"><span>2</span><div><b>Cliente</b><small>Datos que aparecerán en el documento</small></div></div>
    <div class="bill-grid">
     <div class="span2"><label>Nombre / razón social</label><input value="${H(d.customer)}" oninput="billInvoiceField('customer',this.value)"></div>
     <div><label>NIF / CIF</label><input value="${H(d.taxId)}" oninput="billInvoiceField('taxId',this.value)"></div>
     <div><label>Email</label><input type="email" value="${H(d.email)}" oninput="billInvoiceField('email',this.value)"></div>
     <div class="span4"><label>Dirección</label><input value="${H(d.address)}" oninput="billInvoiceField('address',this.value)"></div>
    </div>
   </div>

   <div class="bill-section">
    <div class="bill-section-title"><span>3</span><div><b>Conceptos</b><small>Precios base, descuentos e IVA</small></div><button class="secondary" onclick="billAddInvoiceLine()">Añadir línea</button></div>
    <div class="bill-line-head"><span>Descripción</span><span>Cant.</span><span>Precio</span><span>Dto.</span><span>IVA</span><span>Total</span><span></span></div>
    <div class="bill-lines">${ls.map((l,i)=>invoiceLineHtml(l,i,'invoice')).join('')}</div>
    ${d.kind==='rectifying'?'<div class="bill-summary-note" style="margin-top:10px">En una rectificativa puedes introducir importes negativos para corregir o devolver cantidades.</div>':''}
   </div>

   <div class="bill-section">
    <div class="bill-section-title"><span>4</span><div><b>Pago y notas</b><small>Información final del documento</small></div></div>
    <div class="bill-grid">
     <div><label>Forma de pago</label><select onchange="billInvoiceField('payment',this.value)">${['transferencia','efectivo','tarjeta','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div>
     <div><label>Estado de cobro</label><select onchange="billInvoiceField('paidStatus',this.value)">${['pendiente','pagada','parcial'].map(x=>`<option ${d.paidStatus===x?'selected':''}>${x}</option>`).join('')}</select></div>
     <div><label>Fecha de cobro</label><input type="date" value="${H(d.paidDate||'')}" oninput="billInvoiceField('paidDate',this.value)"></div>
     <div class="span4"><label>Concepto general</label><input value="${H(d.concept)}" oninput="billInvoiceField('concept',this.value)"></div>
     <div class="span4"><label>Notas visibles</label><textarea oninput="billInvoiceField('notes',this.value)">${H(d.notes||'')}</textarea></div>
     <div class="span4 bill-check"><input id="bill_income" type="checkbox" ${d.includeIncome?'checked':''} onchange="billInvoiceField('includeIncome',this.checked)"><label for="bill_income">Sumar a ingresos fiscales solo si esta venta no está ya incluida en los cierres diarios.</label></div>
    </div>
   </div>
  </div>

  <aside class="bill-summary">
   <div class="bill-template-chip"><i style="background:${H(tpl.primary_color)}"></i>${H(tpl.name)}</div>
   <div class="bill-summary-total"><small>Total</small><strong>${E(t.total)}</strong></div>
   <div class="bill-summary-row"><span>Base</span><b>${E(t.base)}</b></div>
   <div class="bill-summary-row"><span>IVA</span><b>${E(t.vat)}</b></div>
   <div class="bill-summary-row"><span>Serie</span><b>${H(series.find(x=>x.id===d.seriesId)?.code||'—')}</b></div>
   <div class="bill-summary-row"><span>Estado</span><b>${d.id?'Borrador':'Nuevo'}</b></div>
   <div class="bill-summary-actions">
    <button class="secondary" onclick="billPreviewDraftPdf()">Vista PDF</button>
    <button class="primary" onclick="billSaveInvoice()">${external?'Registrar factura':'Guardar borrador'}</button>
   </div>
   ${d.id&&!external?`<button class="bill-issue" onclick="billIssueInvoice('${d.id}')">Emitir y numerar</button>`:''}
   <div class="bill-summary-note">Las facturas internas no consumen número mientras son borrador. El número se asigna al emitir.</div>
  </aside>
 </div>`;
}
function invoiceLineHtml(l,i,kind){
 const x=lineCalc(l),prefix=kind==='invoice'?'billInvoiceLineField':'billProLineField',remove=kind==='invoice'?'billRemoveInvoiceLine':'billRemoveProLine';
 return `<div class="bill-line">
  <input class="desc" value="${H(l.description)}" placeholder="Concepto" oninput="${prefix}(${i},'description',this.value)">
  <input inputmode="decimal" value="${H(l.qty)}" oninput="${prefix}(${i},'qty',this.value,true)">
  <input inputmode="decimal" value="${H(l.unit)}" oninput="${prefix}(${i},'unit',this.value,true)">
  <input inputmode="decimal" value="${H(l.discount)}" oninput="${prefix}(${i},'discount',this.value,true)">
  <input inputmode="decimal" value="${H(l.vat)}" oninput="${prefix}(${i},'vat',this.value,true)">
  <b>${E(x.total)}</b>
  <button class="ghost" onclick="${remove}(${i})" title="Eliminar línea">×</button>
 </div>`;
}
function invoicesHtml(){
 const rows=invoiceRows();
 return `${invoiceEditor()}
 <div class="ops-card bill-list-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>Facturas</h3><div class="small">Borradores, emitidas, externas y rectificativas.</div></div><div class="bill-list-tools"><input id="bill_inv_search" placeholder="Buscar nº, cliente o NIF…" oninput="billFilterInvoices(this.value)"></div></div>
 <div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Total</th><th>Tienda</th><th></th></tr></thead><tbody id="bill_invoice_rows">${invoiceTableRows(rows)}</tbody></table></div></div>`;
}
function invoiceTableRows(rows){
 if(!rows.length)return `<tr><td colspan="8"><div class="ops-empty">Todavía no hay facturas.</div></td></tr>`;
 return rows.map(i=>`<tr data-bill-search="${H([i.display_number,i.external_number_text,i.customer_name,i.customer_tax_id].join(' ').toLowerCase())}">
  <td>${fmtDate(i.issue_date)}</td><td><b>${H(i.display_number||i.external_number_text||'Borrador')}</b></td><td>${H(i.customer_name||'—')}</td>
  <td>${H(i.invoice_kind==='rectifying'?'Rectificativa':'Factura')}</td><td>${badge(i.status)}</td><td class="num">${E(i.total_amount)}</td><td>${H(storeName(i.store_id))}</td>
  <td><div class="ops-actions">${i.status==='borrador'?`<button class="secondary" onclick="billEditInvoice('${i.id}')">Editar</button><button class="primary" onclick="billIssueInvoice('${i.id}')">Emitir</button>`:`<button class="secondary" onclick="billInvoicePdf('${i.id}')">PDF</button><button class="ghost" onclick="billMarkPaid('${i.id}')">${i.paid_status==='pagada'?'Pagada ✓':'Marcar cobrada'}</button>`}</div></td></tr>`).join('');
}
window.billFilterInvoices=q=>{document.querySelectorAll('#bill_invoice_rows tr[data-bill-search]').forEach(tr=>tr.classList.toggle('ops-hidden',q&&!tr.dataset.billSearch.includes(String(q).toLowerCase())))};
window.billNewInvoice=()=>{B.invoiceDraft=newInvoiceDraft();B.invoiceLines=[newLine()];B.selectedInvoiceId=null;B.sub='invoices';render();window.scrollTo({top:0,behavior:'smooth'})};
window.billInvoiceField=(k,v,rer=false)=>{
 const d=B.invoiceDraft||(B.invoiceDraft=newInvoiceDraft());d[k]=v;
 if(k==='storeId'||k==='kind'){const s=invoiceSeries(d.kind,d.storeId)[0];d.seriesId=s?.id||''}
 if(rer)render();
};
window.billInvoiceLineField=(i,k,v,rer=false)=>{B.invoiceLines[i][k]=v;if(rer)render()};
window.billAddInvoiceLine=()=>{B.invoiceLines.push(newLine());render()};
window.billRemoveInvoiceLine=i=>{if(B.invoiceLines.length>1){B.invoiceLines.splice(i,1);render()}};
window.billEditInvoice=function(id){
 const i=O.invoices.find(x=>x.id===id);if(!i)return;
 B.invoiceDraft={id:i.id,origin:i.origin||'totus',kind:i.invoice_kind||'invoice',storeId:i.store_id||'',seriesId:i.series_id||'',templateId:i.template_id||O.settings?.default_invoice_template_id||B.templateId||'',date:i.issue_date||today(),dueDate:i.due_date||'',externalNumber:i.external_number_text||'',customer:i.customer_name||'',taxId:i.customer_tax_id||'',address:i.customer_address||'',email:i.customer_email||'',concept:i.concept||'',payment:i.payment_method||'transferencia',paidStatus:i.paid_status||'pendiente',paidDate:i.paid_date||'',includeIncome:!!i.include_in_income,notes:i.notes||''};
 B.invoiceLines=O.invoiceLines.filter(l=>l.invoice_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(l=>({description:l.description||'',qty:String(l.quantity),unit:String(l.unit_price_base),discount:String(l.discount_pct),vat:String(l.vat_rate)}));
 if(!B.invoiceLines.length)B.invoiceLines=[newLine()];
 B.selectedInvoiceId=id;B.sub='invoices';render();window.scrollTo({top:0,behavior:'smooth'})
};
async function saveInvoice(){
 if(B.saving)return;
 const d=B.invoiceDraft,t=totals(B.invoiceLines);
 if(!d.seriesId||!d.date||!d.customer.trim())return alert('Serie, fecha y cliente son obligatorios.');
 if(B.invoiceLines.some(l=>!String(l.description).trim()||N(l.qty)<=0))return alert('Completa las líneas de la factura.');
 const external=d.origin==='externa',num=external?parseInt(d.externalNumber,10):null,ser=O.series.find(s=>s.id===d.seriesId);
 if(external&&(!num||num<1))return alert('Indica el número usado en la factura externa.');
 B.saving=true;
 try{
  const row={series_id:d.seriesId,store_id:d.storeId||null,template_id:d.templateId||null,issue_date:d.date,due_date:d.dueDate||null,
   document_type:'factura',invoice_kind:d.kind,origin:d.origin,status:'borrador',customer_name:d.customer.trim(),customer_tax_id:d.taxId.trim(),
   customer_address:d.address.trim(),customer_email:d.email.trim(),concept:d.concept.trim(),payment_method:d.payment,
   paid_status:d.paidStatus||'pendiente',paid_date:d.paidDate||null,include_in_income:!!d.includeIncome,notes:d.notes||'',created_by:authSession.user.id};
  let id=d.id;
  if(id){
   const existing=O.invoices.find(x=>x.id===id);if(existing?.status!=='borrador')throw new Error('Una factura emitida no se puede reescribir.');
   const {error}=await sb.from('ops_sales_invoices').update(row).eq('id',id);if(error)throw error;
   const {error:de}=await sb.from('ops_sales_invoice_lines').delete().eq('invoice_id',id);if(de)throw de;
  }else{
   const {data,error}=await sb.from('ops_sales_invoices').insert(row).select('id').single();if(error)throw error;id=data.id;
  }
  const lr=B.invoiceLines.map((l,idx)=>{const x=lineCalc(l);return{invoice_id:id,sort_order:(idx+1)*10,description:l.description.trim(),quantity:N(l.qty),unit_price_base:N(l.unit),discount_pct:N(l.discount),vat_rate:N(l.vat),base_amount:x.base,vat_amount:x.vat,total_amount:x.total}});
  const {error:le}=await sb.from('ops_sales_invoice_lines').insert(lr);if(le)throw le;
  if(external){
   const display=ser.prefix+String(num).padStart(ser.padding,'0');
   const tpl=activeTemplate(d.templateId),snap={...tpl,source:'external_registration'};
   const {error:xe}=await sb.from('ops_sales_invoices').update({number:num,display_number:display,external_number_text:String(num),status:'emitida',issued_at:new Date().toISOString(),design_snapshot:snap,template_snapshot:snap}).eq('id',id);if(xe)throw xe;
  }
  await sb.from('ops_audit_log').insert({user_id:authSession.user.id,user_email:authSession.user.email,area:'facturas',action:external?'registrar_externa':(d.id?'actualizar_borrador':'crear_borrador'),entity_id:id,detail:{total:t.total}});
  await window.opsLoadData(true);B.invoiceDraft=newInvoiceDraft();B.invoiceLines=[newLine()];render();
 }catch(e){alert('No se pudo guardar: '+e.message)}
 finally{B.saving=false}
}
window.billSaveInvoice=saveInvoice;
window.billIssueInvoice=async function(id){
 if(!confirm('¿Emitir esta factura? Se asignará el siguiente número correlativo y quedará bloqueada.'))return;
 try{
  const {data,error}=await sb.rpc('ops_issue_invoice',{p_invoice_id:id});if(error)throw error;
  await window.opsLoadData(true);await load(true);render();
  setTimeout(()=>billInvoicePdf(id,true),100);
 }catch(e){alert('No se pudo emitir: '+e.message)}
};
window.billMarkPaid=async function(id){
 const inv=O.invoices.find(x=>x.id===id);if(!inv)return;
 if(inv.paid_status==='pagada')return;
 if(!confirm('¿Marcar esta factura como cobrada?'))return;
 const {error}=await sb.from('ops_sales_invoices').update({paid_status:'pagada',paid_date:today()}).eq('id',id);
 if(error)return alert('No se pudo actualizar el cobro: '+error.message);
 await sb.from('ops_audit_log').insert({user_id:authSession.user.id,user_email:authSession.user.email,area:'facturas',action:'marcar_cobrada',entity_id:id,detail:{fecha:today()}});
 await window.opsLoadData(true);render();
};

/* ---------------- PROFORMAS ---------------- */
function proRows(){
 return B.proformas.filter(x=>String(x.issue_date||'').startsWith(String(O.year))&&(O.storeId==='all'||x.store_id===O.storeId)).slice(0,300)
}
function proEditor(){
 const d=B.proDraft||newProDraft(),ls=B.proDraftLines.length?B.proDraftLines:[newLine()],t=totals(ls),series=proformaSeries(d.storeId),tpl=activeTemplate(d.templateId);
 return `<div class="bill-editor">
  <div class="bill-editor-main">
   <div class="bill-section">
    <div class="bill-section-title"><span>P</span><div><b>Proforma</b><small>Documento informativo; numeración independiente</small></div></div>
    <div class="bill-grid">
     <div><label>Fecha</label><input type="date" value="${H(d.date)}" oninput="billProField('date',this.value)"></div>
     <div><label>Válida hasta</label><input type="date" value="${H(d.validUntil)}" oninput="billProField('validUntil',this.value)"></div>
     <div><label>Establecimiento</label><select onchange="billProField('storeId',this.value,true)"><option value="">General</option>${O.stores.map(s=>`<option value="${s.id}" ${d.storeId===s.id?'selected':''}>${H(s.name)}</option>`).join('')}</select></div>
     <div><label>Serie</label><select onchange="billProField('seriesId',this.value)">${series.map(s=>`<option value="${s.id}" ${d.seriesId===s.id?'selected':''}>${H(s.code)} · ${H(s.prefix)}${String(s.next_number).padStart(s.padding,'0')}</option>`).join('')}</select></div>
     <div><label>Plantilla</label><select onchange="billProField('templateId',this.value,true)">${B.templates.map(x=>`<option value="${x.id}" ${d.templateId===x.id?'selected':''}>${H(x.name)}</option>`).join('')}</select></div>
    </div>
   </div>
   <div class="bill-section">
    <div class="bill-section-title"><span>2</span><div><b>Cliente</b></div></div>
    <div class="bill-grid"><div class="span2"><label>Nombre / razón social</label><input value="${H(d.customer)}" oninput="billProField('customer',this.value)"></div><div><label>NIF / CIF</label><input value="${H(d.taxId)}" oninput="billProField('taxId',this.value)"></div><div><label>Email</label><input value="${H(d.email)}" oninput="billProField('email',this.value)"></div><div class="span4"><label>Dirección</label><input value="${H(d.address)}" oninput="billProField('address',this.value)"></div></div>
   </div>
   <div class="bill-section">
    <div class="bill-section-title"><span>3</span><div><b>Conceptos</b></div><button class="secondary" onclick="billAddProLine()">Añadir línea</button></div>
    <div class="bill-line-head"><span>Descripción</span><span>Cant.</span><span>Precio</span><span>Dto.</span><span>IVA</span><span>Total</span><span></span></div>
    <div class="bill-lines">${ls.map((l,i)=>invoiceLineHtml(l,i,'pro')).join('')}</div>
   </div>
   <div class="bill-section"><div class="bill-section-title"><span>4</span><div><b>Condiciones</b></div></div>
    <div class="bill-grid"><div><label>Forma de pago</label><select onchange="billProField('payment',this.value)">${['transferencia','efectivo','tarjeta','bizum','domiciliado','otro'].map(x=>`<option ${d.payment===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="span3"><label>Concepto general</label><input value="${H(d.concept)}" oninput="billProField('concept',this.value)"></div><div class="span4"><label>Notas visibles</label><textarea oninput="billProField('notes',this.value)">${H(d.notes||'')}</textarea></div></div>
   </div>
  </div>
  <aside class="bill-summary">
   <div class="bill-template-chip"><i style="background:${H(tpl.primary_color)}"></i>${H(tpl.name)}</div>
   <div class="bill-summary-total"><small>Total proforma</small><strong>${E(t.total)}</strong></div>
   <div class="bill-summary-row"><span>Base</span><b>${E(t.base)}</b></div><div class="bill-summary-row"><span>IVA</span><b>${E(t.vat)}</b></div>
   <div class="bill-summary-actions"><button class="secondary" onclick="billPreviewProPdf()">Vista PDF</button><button class="primary" onclick="billSaveProforma()">Guardar proforma</button></div>
   <div class="bill-summary-note">La proforma usa su propia serie. Convertirla crea una factura borrador sin consumir número hasta emitirla.</div>
  </aside>
 </div>`;
}
function proformasHtml(){
 const rows=proRows();
 return `${proEditor()}<div class="ops-card bill-list-card"><div class="section-head"><div><div class="eyebrow">${O.year}</div><h3>Proformas</h3></div></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Válida hasta</th><th></th></tr></thead><tbody>${rows.length?rows.map(p=>`<tr><td>${fmtDate(p.issue_date)}</td><td><b>${H(p.display_number)}</b></td><td>${H(p.customer_name)}</td><td>${badge(p.status)}</td><td class="num">${E(p.total_amount)}</td><td>${fmtDate(p.valid_until)}</td><td><div class="ops-actions"><button class="secondary" onclick="billProPdf('${p.id}')">PDF</button>${p.status==='borrador'?`<button class="ghost" onclick="billEditProforma('${p.id}')">Editar</button>`:''}${!['convertida','anulada','rechazada'].includes(p.status)?`<button class="primary" onclick="billConvertProforma('${p.id}')">Convertir</button>`:''}${!['convertida','anulada'].includes(p.status)?`<button class="ghost" onclick="billProStatus('${p.id}')">Estado</button>`:''}</div></td></tr>`).join(''):`<tr><td colspan="7"><div class="ops-empty">Todavía no hay proformas.</div></td></tr>`}</tbody></table></div></div>`;
}
window.billNewProforma=()=>{B.proDraft=newProDraft();B.proDraftLines=[newLine()];B.sub='proformas';render();window.scrollTo({top:0,behavior:'smooth'})};
window.billProField=(k,v,rer=false)=>{const d=B.proDraft||(B.proDraft=newProDraft());d[k]=v;if(k==='storeId'){d.seriesId=proformaSeries(d.storeId)[0]?.id||''}if(rer)render()};
window.billProLineField=(i,k,v,rer=false)=>{B.proDraftLines[i][k]=v;if(rer)render()};
window.billAddProLine=()=>{B.proDraftLines.push(newLine());render()};
window.billRemoveProLine=i=>{if(B.proDraftLines.length>1){B.proDraftLines.splice(i,1);render()}};
window.billEditProforma=function(id){
 const p=B.proformas.find(x=>x.id===id);if(!p||p.status!=='borrador')return;
 B.proDraft={id:p.id,storeId:p.store_id||'',seriesId:p.series_id||'',templateId:p.template_id||O.settings?.default_invoice_template_id||'',date:p.issue_date||today(),validUntil:p.valid_until||'',customer:p.customer_name||'',taxId:p.customer_tax_id||'',address:p.customer_address||'',email:p.customer_email||'',concept:p.concept||'',payment:p.payment_method||'transferencia',notes:p.notes||''};
 B.proDraftLines=B.proLines.filter(l=>l.proforma_id===id).sort((a,b)=>a.sort_order-b.sort_order).map(l=>({description:l.description||'',qty:String(l.quantity),unit:String(l.unit_price_base),discount:String(l.discount_pct),vat:String(l.vat_rate)}));
 if(!B.proDraftLines.length)B.proDraftLines=[newLine()];
 B.sub='proformas';render();window.scrollTo({top:0,behavior:'smooth'});
};
window.billSaveProforma=async function(){
 if(B.saving)return;const d=B.proDraft;
 if(!d.seriesId||!d.date||!d.customer.trim())return alert('Serie, fecha y cliente son obligatorios.');
 if(B.proDraftLines.some(l=>!String(l.description).trim()||N(l.qty)<=0))return alert('Completa las líneas.');
 B.saving=true;
 try{
  let id=d.id;
  if(id){
   const current=B.proformas.find(x=>x.id===id);if(!current||current.status!=='borrador')throw new Error('Solo se puede editar una proforma en borrador.');
   const row={store_id:d.storeId||null,template_id:d.templateId||null,issue_date:d.date,valid_until:d.validUntil||null,customer_name:d.customer.trim(),customer_tax_id:d.taxId.trim(),customer_address:d.address.trim(),customer_email:d.email.trim(),concept:d.concept.trim(),payment_method:d.payment,notes:d.notes||''};
   const {error}=await sb.from('ops_proformas').update(row).eq('id',id);if(error)throw error;
   const {error:de}=await sb.from('ops_proforma_lines').delete().eq('proforma_id',id);if(de)throw de;
  }else{
   const {data:num,error:ne}=await sb.rpc('ops_next_proforma_number',{p_series_id:d.seriesId});if(ne)throw ne;const nr=Array.isArray(num)?num[0]:num;
   const row={series_id:d.seriesId,store_id:d.storeId||null,template_id:d.templateId||null,issue_date:d.date,valid_until:d.validUntil||null,number:nr.number,display_number:nr.display_number,status:'borrador',customer_name:d.customer.trim(),customer_tax_id:d.taxId.trim(),customer_address:d.address.trim(),customer_email:d.email.trim(),concept:d.concept.trim(),payment_method:d.payment,notes:d.notes||'',created_by:authSession.user.id};
   const {data,error}=await sb.from('ops_proformas').insert(row).select('id').single();if(error)throw error;id=data.id;
  }
  const lr=B.proDraftLines.map((l,idx)=>{const x=lineCalc(l);return{proforma_id:id,sort_order:(idx+1)*10,description:l.description.trim(),quantity:N(l.qty),unit_price_base:N(l.unit),discount_pct:N(l.discount),vat_rate:N(l.vat),base_amount:x.base,vat_amount:x.vat,total_amount:x.total}});
  const {error:le}=await sb.from('ops_proforma_lines').insert(lr);if(le)throw le;
  await sb.from('ops_audit_log').insert({user_id:authSession.user.id,user_email:authSession.user.email,area:'proformas',action:d.id?'actualizar':'crear',entity_id:id,detail:{}});
  await load(true);B.proDraft=newProDraft();B.proDraftLines=[newLine()];render();
 }catch(e){alert('No se pudo guardar la proforma: '+e.message)}finally{B.saving=false}
};
window.billProStatus=async function(id){
 const p=B.proformas.find(x=>x.id===id);if(!p)return;
 const next=prompt('Estado: borrador, enviada, aceptada, rechazada o anulada',p.status||'borrador');
 if(next===null)return;
 const value=String(next).trim().toLowerCase();
 if(!['borrador','enviada','aceptada','rechazada','anulada'].includes(value))return alert('Estado no válido.');
 const {error}=await sb.from('ops_proformas').update({status:value}).eq('id',id);if(error)return alert(error.message);
 await load(true);render();
};
window.billConvertProforma=async function(id){
 const p=B.proformas.find(x=>x.id===id);if(!p)return;
 const ser=invoiceSeries('invoice',p.store_id)[0];if(!ser)return alert('No hay serie de factura para este establecimiento y año.');
 if(!confirm(`Convertir ${p.display_number} en factura borrador?`))return;
 try{
  const {data,error}=await sb.rpc('ops_convert_proforma',{p_proforma_id:id,p_invoice_series_id:ser.id});if(error)throw error;
  await window.opsLoadData(true);await load(true);B.sub='invoices';billEditInvoice(data);render();
 }catch(e){alert('No se pudo convertir: '+e.message)}
};

/* ---------------- PLANTILLAS ---------------- */
function templatePreview(t){
 const title=t.invoice_title||'FACTURA',logo=t.show_logo===false?'Sin logo':(t.logo_path?'LOGO':'TU LOGO');
 return `<div class="tpl-preview ${H(t.style_code)}" style="--tpl-a:${H(t.primary_color)};--tpl-b:${H(t.secondary_color)};--tpl-text:${H(t.text_color||'#17202A')}">
  <div class="tpl-preview-head"><div class="tpl-logo tpl-logo-${H(t.logo_position||'left')}">${H(logo)}</div><div><b>${H(title)} H-2026-0001</b><small>06/10/2026</small></div></div>
  ${t.header_text?`<div class="tpl-header-text">${H(t.header_text)}</div>`:''}
  <div class="tpl-company"><b>${H(O.settings?.business_name||'Tu empresa')}</b><span>${H(O.settings?.tax_id||'NIF/CIF')}</span></div>
  <div class="tpl-client"><small>CLIENTE</small><b>Cliente de ejemplo S.L.</b><span>B00000000</span></div>
  <div class="tpl-table"><div><b>Concepto</b><b>Cant.</b><b>Precio</b><b>Total</b></div><div><span>Producto o servicio</span><span>1</span><span>100,00 €</span><span>121,00 €</span></div></div>
  <div class="tpl-total"><span>Total</span><b>121,00 €</b></div>
  ${t.show_payment_details!==false&&t.bank_details?`<div class="tpl-pay">${H(t.bank_details)}</div>`:''}
  <div class="tpl-footer">${H(t.footer_text||O.settings?.invoice_footer_text||'Gracias por tu confianza.')}</div>
 </div>`;
}
function templatesHtml(){
 const t=activeTemplate(B.templateId);
 return `<div class="bill-template-layout">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Diseños</div><h3>Plantillas</h3><div class="small">Tres bases profesionales; personaliza marca, color, logo y textos.</div></div></div>
   <div class="tpl-cards">${B.templates.map(x=>`<button class="tpl-card ${x.id===t.id?'active':''}" onclick="billSelectTemplate('${x.id}')"><span class="tpl-swatch" style="background:${H(x.primary_color)}"></span><b>${H(x.name)}</b><small>${H(x.style_code)}</small>${x.is_default?'<em>Predeterminada</em>':''}</button>`).join('')}</div>
   ${roleManager()?`<div class="bill-grid" style="margin-top:16px">
    <div class="span2"><label>Nombre</label><input id="tpl_name" value="${H(t.name)}"></div>
    <div><label>Estilo base</label><select id="tpl_style" onchange="billTemplateLive()"><option value="modern" ${t.style_code==='modern'?'selected':''}>Moderna</option><option value="minimal" ${t.style_code==='minimal'?'selected':''}>Minimal</option><option value="classic" ${t.style_code==='classic'?'selected':''}>Clásica</option></select></div>
    <div><label>Logo</label><input id="tpl_logo_file" type="file" accept=".png,.jpg,.jpeg,.webp"></div>
    <div><label>Color principal</label><input id="tpl_primary" type="color" value="${H(t.primary_color)}" oninput="billTemplateLive()"></div>
    <div><label>Color secundario</label><input id="tpl_secondary" type="color" value="${H(t.secondary_color)}" oninput="billTemplateLive()"></div>
    <div><label>Color texto</label><input id="tpl_text" type="color" value="${H(t.text_color||'#17202A')}" oninput="billTemplateLive()"></div>
    <div><label>Posición logo</label><select id="tpl_logo_pos" onchange="billTemplateLive()"><option value="left" ${t.logo_position==='left'?'selected':''}>Izquierda</option><option value="center" ${t.logo_position==='center'?'selected':''}>Centro</option><option value="right" ${t.logo_position==='right'?'selected':''}>Derecha</option></select></div>
    <div><label>Ancho logo (mm)</label><input id="tpl_logo_width" inputmode="decimal" value="${H(t.logo_width_mm||34)}"></div>
    <div class="bill-check"><input id="tpl_show_logo" type="checkbox" ${t.show_logo!==false?'checked':''}><label for="tpl_show_logo">Mostrar logo</label></div>
    <div class="bill-check"><input id="tpl_show_pay" type="checkbox" ${t.show_payment_details!==false?'checked':''}><label for="tpl_show_pay">Mostrar datos de pago</label></div>
    <div class="bill-check"><input id="tpl_default" type="checkbox" ${t.is_default?'checked':''}><label for="tpl_default">Predeterminada factura</label></div>
    <div class="bill-check"><input id="tpl_default_pro" type="checkbox" ${t.default_proforma?'checked':''}><label for="tpl_default_pro">Predeterminada proforma</label></div>
    <div class="span2"><label>Título factura</label><input id="tpl_invoice_title" value="${H(t.invoice_title||'FACTURA')}"></div>
    <div class="span2"><label>Título proforma</label><input id="tpl_proforma_title" value="${H(t.proforma_title||'FACTURA PROFORMA')}"></div>
    <div class="span4"><label>Texto de cabecera</label><textarea id="tpl_header">${H(t.header_text||'')}</textarea></div>
    <div class="span4"><label>Datos bancarios / pago</label><textarea id="tpl_bank">${H(t.bank_details||'')}</textarea></div>
    <div class="span4"><label>Pie de documento</label><textarea id="tpl_footer">${H(t.footer_text||'')}</textarea></div>
    <div class="span4"><label>Condiciones / forma de pago</label><textarea id="tpl_terms">${H(t.payment_terms||'')}</textarea></div>
    <div class="span4"><label>Texto por defecto en notas</label><textarea id="tpl_notes">${H(t.notes_default||'')}</textarea></div>
   </div><div class="ops-actions" style="margin-top:14px"><button class="primary" onclick="billSaveTemplate()">Guardar plantilla</button><button class="secondary" onclick="billUploadLogo()">Subir / cambiar logo</button><button class="ghost" onclick="billDuplicateTemplate()">Duplicar plantilla</button></div>`:'<div class="ops-note">Solo administración y gerencia pueden modificar plantillas.</div>'}
  </div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Vista previa</div><h3>Documento A4</h3></div></div><div id="tpl_preview_wrap">${templatePreview(t)}</div></div>
 </div>`;
}
window.billSelectTemplate=id=>{B.templateId=id;render()};
window.billTemplateLive=()=>{const t={...activeTemplate(B.templateId),primary_color:document.getElementById('tpl_primary')?.value||'#19D3C5',secondary_color:document.getElementById('tpl_secondary')?.value||'#101B27',text_color:document.getElementById('tpl_text')?.value||'#17202A',style_code:document.getElementById('tpl_style')?.value||'modern',logo_position:document.getElementById('tpl_logo_pos')?.value||'left',show_logo:document.getElementById('tpl_show_logo')?.checked!==false,show_payment_details:document.getElementById('tpl_show_pay')?.checked!==false,invoice_title:document.getElementById('tpl_invoice_title')?.value||'FACTURA',proforma_title:document.getElementById('tpl_proforma_title')?.value||'FACTURA PROFORMA',header_text:document.getElementById('tpl_header')?.value||'',bank_details:document.getElementById('tpl_bank')?.value||'',footer_text:document.getElementById('tpl_footer')?.value||''};const w=document.getElementById('tpl_preview_wrap');if(w)w.innerHTML=templatePreview(t)};
window.billSaveTemplate=async function(){
 if(!roleManager())return;const id=B.templateId,t=activeTemplate(id);
 const row={name:document.getElementById('tpl_name').value.trim(),style:dbTemplateStyle(document.getElementById('tpl_style').value),primary_color:document.getElementById('tpl_primary').value,secondary_color:document.getElementById('tpl_secondary').value,text_color:document.getElementById('tpl_text').value,logo_position:document.getElementById('tpl_logo_pos').value,logo_width_mm:N(document.getElementById('tpl_logo_width').value)||34,show_logo:document.getElementById('tpl_show_logo').checked,show_payment_details:document.getElementById('tpl_show_pay').checked,default_invoice:document.getElementById('tpl_default').checked,default_proforma:document.getElementById('tpl_default_pro').checked,invoice_title:document.getElementById('tpl_invoice_title').value.trim()||'FACTURA',proforma_title:document.getElementById('tpl_proforma_title').value.trim()||'FACTURA PROFORMA',header_text:document.getElementById('tpl_header').value,bank_details:document.getElementById('tpl_bank').value,footer_text:document.getElementById('tpl_footer').value,payment_terms_default:document.getElementById('tpl_terms').value,notes_default:document.getElementById('tpl_notes').value};
 try{
  if(row.default_invoice)await sb.from('ops_document_templates').update({default_invoice:false}).neq('id',id);
  if(row.default_proforma)await sb.from('ops_document_templates').update({default_proforma:false}).neq('id',id);
  const {error}=await sb.from('ops_document_templates').update(row).eq('id',id);if(error)throw error;
  if(row.default_invoice)await sb.from('ops_business_settings').update({default_invoice_template_id:id,invoice_footer_text:row.footer_text,invoice_payment_terms:row.payment_terms_default,invoice_notes_default:row.notes_default}).eq('id',1);
  await window.opsLoadData(true);await load(true);render();
 }catch(e){alert('No se pudo guardar la plantilla: '+e.message)}
};
window.billDuplicateTemplate=async function(){
 if(!roleManager())return;const src=activeTemplate(B.templateId);if(!src?.id)return;
 const name=prompt('Nombre de la nueva plantilla:',(src.name||'Plantilla')+' copia');if(!name)return;
 const code='TPL-'+Date.now().toString(36).toUpperCase();
 const row={store_id:src.store_id||null,code,name:name.trim(),style:dbTemplateStyle(src.style_code),primary_color:src.primary_color,secondary_color:src.secondary_color,text_color:src.text_color||'#17202A',font_family:src.font_family||'helvetica',logo_path:src.logo_path||null,logo_name:src.logo_name||null,logo_mime:src.logo_mime||null,logo_size_bytes:N(src.logo_size_bytes),logo_width_mm:N(src.logo_width_mm)||34,show_logo:src.show_logo!==false,show_payment_details:src.show_payment_details!==false,header_text:src.header_text||'',footer_text:src.footer_text||'',payment_terms_default:src.payment_terms||src.payment_terms_default||'',bank_details:src.bank_details||'',invoice_title:src.invoice_title||'FACTURA',proforma_title:src.proforma_title||'FACTURA PROFORMA',active:true,default_invoice:false,default_proforma:false,logo_position:src.logo_position||'left',show_company_email:src.show_company_email!==false,show_company_phone:src.show_company_phone!==false,notes_default:src.notes_default||''};
 try{const {data,error}=await sb.from('ops_document_templates').insert(row).select('id').single();if(error)throw error;await load(true);B.templateId=data.id;render()}catch(e){alert('No se pudo duplicar la plantilla: '+e.message)}
};
window.billUploadLogo=async function(){
 if(!roleManager())return;const file=document.getElementById('tpl_logo_file')?.files?.[0];if(!file)return alert('Selecciona un logo PNG, JPG o WEBP.');
 if(file.size>5*1024*1024)return alert('El logo supera 5 MB.');
 const id=B.templateId;if(!id)return;
 try{
  const ext=(file.name.split('.').pop()||'png').toLowerCase(),path=`invoice-templates/${id}/logo.${ext}`;
  const {error}=await sb.storage.from('business-assets').upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;
  const {error:ue}=await sb.from('ops_document_templates').update({logo_path:path,logo_name:file.name,logo_mime:file.type,logo_size_bytes:file.size,show_logo:true}).eq('id',id);if(ue)throw ue;
  await load(true);render();
 }catch(e){alert('No se pudo subir el logo: '+e.message)}
};

/* ---------------- SERIES ---------------- */
function seriesHtml(){
 const inv=O.series.filter(s=>s.year===O.year&&(s.document_type||'factura')==='factura'),pro=B.proSeries.filter(s=>s.year===O.year);
 return `<div class="ops-grid">
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Facturas</div><h3>Series ${O.year}</h3></div>${roleManager()?'<button class="secondary" onclick="billNewSeries(\'invoice\')">Añadir</button>':''}</div>${seriesTable(inv,'invoice')}</div>
  <div class="ops-card"><div class="section-head"><div><div class="eyebrow">Proformas</div><h3>Series ${O.year}</h3></div>${roleManager()?'<button class="secondary" onclick="billNewSeries(\'proforma\')">Añadir</button>':''}</div>${seriesTable(pro,'proforma')}</div>
 </div>
 <div class="ops-note warn">Las facturas ordinarias y rectificativas deben mantener series separadas y numeración correlativa. Las proformas usan una secuencia independiente.</div>`;
}
function seriesTable(rows,type){
 if(!rows.length)return '<div class="ops-empty">Sin series para este año.</div>';
 return `<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Código</th><th>Tienda</th><th>Tipo</th><th>Prefijo</th><th>Siguiente</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td><b>${H(s.code)}</b></td><td>${H(storeName(s.store_id))}</td><td>${H(type==='proforma'?'Proforma':((s.series_kind||'invoice')==='rectifying'?'Rectificativa':'Factura'))}</td><td>${H(s.prefix)}</td><td>${String(s.next_number).padStart(s.padding,'0')}</td><td>${roleManager()?`<button class="secondary" onclick="billEditSeries('${type}','${s.id}')">Editar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}
window.billNewSeries=type=>{if(!roleManager())return;const code=prompt('Código de la nueva serie:');if(!code)return;const prefix=prompt('Prefijo visible (ej. H-2027-):',code+'-');if(!prefix)return;const store=O.storeId==='all'?(O.stores[0]?.id||null):O.storeId;billSaveSeries(type,null,{code,prefix,store_id:store,year:O.year,next_number:1,padding:4,series_kind:'invoice'})};
window.billEditSeries=(type,id)=>{
 if(!roleManager())return;const s=(type==='proforma'?B.proSeries:O.series).find(x=>x.id===id);if(!s)return;
 const prefix=prompt('Prefijo:',s.prefix);if(prefix===null)return;const next=prompt('Siguiente número:',s.next_number);if(next===null)return;const padding=prompt('Dígitos (relleno con ceros):',s.padding);if(padding===null)return;
 billSaveSeries(type,id,{...s,prefix,next_number:parseInt(next,10)||1,padding:parseInt(padding,10)||4});
};
async function billSaveSeries(type,id,row){
 try{
  const table=type==='proforma'?'ops_proforma_series':'ops_invoice_series';
  const payload={store_id:row.store_id||null,year:row.year||O.year,code:row.code,prefix:row.prefix,next_number:row.next_number||1,padding:row.padding||4,active:true};
  if(type!=='proforma'){payload.series_kind=row.series_kind||'invoice';payload.document_type='factura';}
  let error;if(id)({error}=await sb.from(table).update(payload).eq('id',id));else({error}=await sb.from(table).insert(payload));if(error)throw error;
  await window.opsLoadData(true);await load(true);render();
 }catch(e){alert('No se pudo guardar la serie: '+e.message)}
}

/* ---------------- PDF ---------------- */
async function logoData(template){
 if(!template?.logo_path||template.show_logo===false)return null;
 try{const {data,error}=await sb.storage.from('business-assets').download(template.logo_path);if(error)return null;return await dataUrlFromBlob(data)}catch{return null}
}
function rgb(hex){
 const s=String(hex||'#000000').replace('#','');return [parseInt(s.slice(0,2),16)||0,parseInt(s.slice(2,4),16)||0,parseInt(s.slice(4,6),16)||0];
}
function docLines(doc,lines,startY){
 let y=startY;
 const header=()=>{doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('Descripción',15,y);doc.text('Cant.',118,y,{align:'right'});doc.text('Precio',145,y,{align:'right'});doc.text('IVA',166,y,{align:'right'});doc.text('Total',195,y,{align:'right'});doc.line(15,y+2,195,y+2);doc.setFont('helvetica','normal');y+=8};
 header();
 for(const l of lines){
  if(y>257){doc.addPage();y=20;header()}
  doc.text(String(l.description||''),15,y,{maxWidth:88});
  doc.text(String(N(l.quantity??l.qty).toFixed(2)).replace('.00',''),118,y,{align:'right'});
  doc.text(N(l.unit_price_base??l.unit).toFixed(2),145,y,{align:'right'});
  doc.text(N(l.vat_rate??l.vat).toFixed(0)+'%',166,y,{align:'right'});
  doc.text(N(l.total_amount??lineCalc(l).total).toFixed(2),195,y,{align:'right'});
  y+=8;
 }
 return y;
}
async function makePdf(kind,obj,lines,template){
 if(!window.jspdf?.jsPDF)throw new Error('Generador PDF no disponible');
 const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4'}),s=O.settings||{},t=template||activeTemplate(obj.template_id||obj.templateId),a=rgb(t.primary_color),b=rgb(t.secondary_color);
 const isPro=kind==='proforma',label=isPro?(t.proforma_title||'FACTURA PROFORMA'):(obj.invoice_kind==='rectifying'||obj.kind==='rectifying'?'FACTURA RECTIFICATIVA':(t.invoice_title||'FACTURA'));
 const number=isPro?(obj.display_number||'BORRADOR'):(obj.display_number||obj.external_number_text||'BORRADOR');
 const logo=await logoData(t);
 if(t.style_code==='modern'){doc.setFillColor(...a);doc.rect(0,0,210,8,'F');doc.setFillColor(...b);doc.rect(0,8,210,28,'F')}
 if(logo&&t.show_logo!==false){try{const w=Math.max(18,Math.min(65,N(t.logo_width_mm)||34)),x=t.logo_position==='right'?195-w:t.logo_position==='center'?(210-w)/2:15;doc.addImage(logo,'PNG',x,12,w,Math.max(10,w*.5),'FAST')}catch{}}
 if(t.style_code==='modern')doc.setTextColor(255,255,255);else doc.setTextColor(...b);
 if(t.style_code!=='modern')doc.setTextColor(...b);
 doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text(label,195,18,{align:'right'});
 doc.setFontSize(10);doc.text(number,195,25,{align:'right'});
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Fecha: '+fmtDate(obj.issue_date||obj.date),195,31,{align:'right'});
 if(obj.due_date||obj.dueDate||obj.valid_until||obj.validUntil)doc.text((isPro?'Válida hasta: ':'Vencimiento: ')+fmtDate(obj.valid_until||obj.validUntil||obj.due_date||obj.dueDate),195,36,{align:'right'});
 doc.setTextColor(...rgb(t.text_color||'#17202A'));if(t.header_text){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(String(t.header_text),15,41,{maxWidth:180})}doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(s.business_name||'Tu empresa',15,47);doc.setFont('helvetica','normal');doc.setFontSize(9);
 let cy=53;[s.tax_id,s.business_address,(t.show_company_email!==false?s.business_email:''),(t.show_company_phone!==false?s.business_phone:'')].filter(Boolean).forEach(v=>{doc.text(String(v),15,cy,{maxWidth:85});cy+=5});
 doc.setFont('helvetica','bold');doc.text('CLIENTE',115,47);doc.setFont('helvetica','normal');doc.text(obj.customer_name||obj.customer||'',115,53,{maxWidth:80});if(obj.customer_tax_id||obj.taxId)doc.text(obj.customer_tax_id||obj.taxId,115,58);if(obj.customer_address||obj.address)doc.text(obj.customer_address||obj.address,115,63,{maxWidth:80});
 if(isPro){doc.setTextColor(130,70,35);doc.setFont('helvetica','bold');doc.text('Documento proforma · sin efecto contable hasta su conversión en factura.',15,73);doc.setTextColor(30,38,48)}
 let y=docLines(doc,lines,isPro?84:78);const tt=totals(lines.map(l=>({qty:l.quantity??l.qty,unit:l.unit_price_base??l.unit,discount:l.discount_pct??l.discount,vat:l.vat_rate??l.vat,description:l.description,total_amount:l.total_amount})));
 y+=3;if(y>260){doc.addPage();y=25}doc.line(120,y,195,y);y+=7;doc.text('Base',160,y,{align:'right'});doc.text(E(tt.base),195,y,{align:'right'});y+=6;doc.text('IVA',160,y,{align:'right'});doc.text(E(tt.vat),195,y,{align:'right'});y+=8;doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(...a);doc.text('TOTAL',160,y,{align:'right'});doc.text(E(tt.total),195,y,{align:'right'});doc.setTextColor(30,38,48);
 const notes=obj.notes||'';const terms=t.payment_terms||O.settings?.invoice_payment_terms||'',bank=t.show_payment_details!==false?(t.bank_details||''):'';
 let fy=Math.max(y+16,244);if(fy>270){doc.addPage();fy=238}doc.setFontSize(8);doc.setFont('helvetica','normal');
 if(notes){doc.text('Notas: '+notes,15,fy,{maxWidth:180});fy+=8}if(terms){doc.text('Condiciones: '+terms,15,fy,{maxWidth:180});fy+=8}if(bank){doc.text('Pago: '+bank,15,fy,{maxWidth:180});fy+=8}if(t.footer_text||O.settings?.invoice_footer_text)doc.text(t.footer_text||O.settings.invoice_footer_text,105,288,{align:'center',maxWidth:180});
 return doc.output('blob');
}
window.billPreviewDraftPdf=async()=>{try{const b=await makePdf('invoice',B.invoiceDraft,B.invoiceLines,activeTemplate(B.invoiceDraft.templateId));downloadBlob(b,'vista_previa_factura.pdf')}catch(e){alert(e.message)}};
window.billPreviewProPdf=async()=>{try{const b=await makePdf('proforma',B.proDraft,B.proDraftLines,activeTemplate(B.proDraft.templateId));downloadBlob(b,'vista_previa_proforma.pdf')}catch(e){alert(e.message)}};
window.billInvoicePdf=async function(id,saveServer=false){
 const inv=O.invoices.find(x=>x.id===id);if(!inv)return;const ls=O.invoiceLines.filter(l=>l.invoice_id===id);let tpl=activeTemplate(inv.template_id);
 if(inv.template_snapshot&&Object.keys(inv.template_snapshot).length)tpl={...tpl,...inv.template_snapshot};
 try{
  if(inv.generated_document_id&&!saveServer){const d=O.documents.find(x=>x.id===inv.generated_document_id);if(d)return window.opsDownloadDoc(d.id)}
  const blob=await makePdf('invoice',inv,ls,tpl),filename=slug(inv.display_number||'factura')+'.pdf';
  if(saveServer&&!inv.generated_document_id){
   const file=new File([blob],filename,{type:'application/pdf'});
   const path=['facturas_emitidas',String(inv.issue_date||today()).slice(0,4),String(inv.issue_date||today()).slice(5,7),slug(filename)].join('/');
   const {error:upErr}=await sb.storage.from('business-documents').upload(path,file,{upsert:false,contentType:'application/pdf'});
   if(upErr&&!/already exists/i.test(upErr.message||''))throw upErr;
   let docId=null;
   const existing=O.documents.find(d=>d.storage_path===path);
   if(existing)docId=existing.id;
   else{
    const {data:docRow,error:docErr}=await sb.from('ops_documents').insert({
      store_id:inv.store_id||null,doc_type:'factura_emitida',document_date:inv.issue_date,
      supplier_or_customer:inv.customer_name||'',tax_id:inv.customer_tax_id||'',invoice_number:inv.display_number||'',
      category_code:'700',status:'archivada',storage_path:path,original_name:filename,mime_type:'application/pdf',
      size_bytes:file.size,sha256:'',linked_entity_type:'sales_invoice',linked_entity_id:inv.id,notes:'PDF generado y archivado automáticamente al emitir.',uploaded_by:authSession.user.id
    }).select('id').single();if(docErr)throw docErr;docId=docRow.id;
   }
   if(docId){const {error:lnkErr}=await sb.from('ops_sales_invoices').update({generated_document_id:docId}).eq('id',inv.id);if(lnkErr)throw lnkErr;await window.opsLoadData(true)}
  }
  downloadBlob(blob,filename);
 }catch(e){alert('No se pudo generar el PDF: '+e.message)}
};
window.billProPdf=async function(id){
 const p=B.proformas.find(x=>x.id===id);if(!p)return;const ls=B.proLines.filter(l=>l.proforma_id===id);try{const blob=await makePdf('proforma',p,ls,activeTemplate(p.template_id));downloadBlob(blob,slug(p.display_number||'proforma')+'.pdf')}catch(e){alert(e.message)}
};

window.BillingV7=B;
})();