import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const project='zwkpmjjuurgjygcrejiw';
const userId='85d4df93-4481-40d0-8a42-7521be6aa0c1';
const email='hortimatic@gmail.com';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const token=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:userId,email,role:'authenticated',aud:'authenticated',exp:4102444800})+'.qa';
const session={access_token:token,refresh_token:'qa-refresh',expires_in:3600,expires_at:4102444800,token_type:'bearer',user:{id:userId,aud:'authenticated',role:'authenticated',email,app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};

const ids={
 h:'4dd28c96-3e32-4f9e-876a-3f9fe3b68845',
 n:'8b2976a9-9589-44fd-ade9-61a95e87359f',
 merch:'11111111-1111-4111-8111-111111111111',
 internal:'22222222-2222-4222-8222-222222222222',
 drHv:'33333333-3333-4333-8333-333333333331',
 drHh:'33333333-3333-4333-8333-333333333332',
 drNv:'33333333-3333-4333-8333-333333333333',
 seriesH:'44444444-4444-4444-8444-444444444441',
 seriesP:'44444444-4444-4444-8444-444444444442',
 tpl:'55555555-5555-4555-8555-555555555555'
};
const fixtures={
 brands:[],families:[],products:[],product_variants:[],providers:[],product_provider_prices:[],product_competitor_prices:[],
 consultations:[],consultation_history:[],price_history:[],team_email_log:[],
 team_members:[{email,full_name:'Diego Sequera',role:'admin',active:true,job_title:'Admin'}],
 profiles:[{id:userId,email,full_name:'Diego Sequera',role:'admin',active:true}],
 ops_business_settings:[{id:1,business_name:'Empresa QA',tax_id:'B00000000',business_address:'Calle QA',business_email:'qa@example.com',business_phone:'',current_year:2026,irpf_prepayment_rate:20,difficult_expense_enabled:true,difficult_expense_pct:5,difficult_expense_annual_cap:2000,reta_generic_deduction_pct:7,reta_total_rate:31.5,actual_reta_monthly:315,storage_limit_bytes:1073741824,document_max_bytes:20971520}],
 ops_stores:[{id:ids.h,code:'HORTIMATIC',name:'Hortimatic',active:true,sort_order:10},{id:ids.n,code:'NEWOLDSMOK',name:'NewOldSmok',active:true,sort_order:20}],
 ops_expense_categories:[{id:ids.merch,code:'MERCH',name:'Mercancía / producto para tienda',manager_code:'600',deductible_default:true,fixed_asset_default:false,sort_order:10},{id:ids.internal,code:'INTERNAL_WAREHOUSE',name:'Almacén / pago interno',manager_code:'',deductible_default:false,fixed_asset_default:false,sort_order:920}],
 ops_documents:[],
 ops_expenses:[],
 ops_expense_lines:[],
 ops_daily_closings:[],
 ops_cash_drawers:[{id:ids.drHv,store_id:ids.h,code:'VAPE',name:'Caja vape',active:true,sort_order:10},{id:ids.drHh,store_id:ids.h,code:'HEAD',name:'Caja head',active:true,sort_order:20},{id:ids.drNv,store_id:ids.n,code:'VAPE',name:'Caja vape',active:true,sort_order:10}],
 ops_daily_closing_drawers:[],
 ops_invoice_series:[{id:ids.seriesH,store_id:ids.h,year:2026,code:'H-2026',prefix:'H-2026-',next_number:1,padding:4,active:true,document_type:'factura',series_kind:'invoice'},{id:ids.seriesP,store_id:ids.h,year:2026,code:'HPF-2026',prefix:'HPF-2026-',next_number:1,padding:4,active:true,document_type:'proforma',series_kind:'invoice'}],
 ops_sales_invoices:[],ops_sales_invoice_lines:[],ops_tax_payments:[],
 ops_reta_brackets:[{id:1,year:2026,bracket_order:1,min_net_monthly:null,max_net_monthly:670,min_inclusive:false,max_inclusive:true,min_base:653.59,max_base:718.94},{id:2,year:2026,bracket_order:15,min_net_monthly:6000,max_net_monthly:null,min_inclusive:false,max_inclusive:true,min_base:1928.10,max_base:5101.20}],
 ops_fiscal_adjustments:[],ops_income_adjustments:[],ops_gestor_quarter_summary:[],ops_reconciliation_notes:[],
 ops_customers:[],
 ops_document_templates:[{id:ids.tpl,code:'TOTUS-QA',name:'Totus QA',style:'brand',primary_color:'#19D3C5',secondary_color:'#101B27',text_color:'#17202A',font_family:'helvetica',logo_path:null,logo_name:null,logo_mime:null,logo_size_bytes:0,logo_width_mm:34,logo_position:'left',show_logo:true,show_payment_details:true,header_text:'',footer_text:'Gracias',payment_terms_default:'Pago al contado',bank_details:'',invoice_title:'FACTURA',proforma_title:'FACTURA PROFORMA',active:true,default_invoice:true,default_proforma:true}],
 ops_legacy_daily_rows:[],ops_historical_income_periods:[],ops_gestor_source_rows:[],
};

function tableFrom(url){
 const m=new URL(url).pathname.match(/\/rest\/v1\/([^/?]+)/);return m?.[1]||'';
}
function out(body,status=200,headers={}){return {status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Content-Range':'0-0/0',...headers},body:JSON.stringify(body)}}

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const dialogs=[],pageErrors=[];let storageDownloads=0;
page.on('dialog',async d=>{dialogs.push(d.message());if(d.type()==='confirm')await d.accept();else await d.dismiss()});
page.on('pageerror',e=>{pageErrors.push(e.stack||e.message);console.error('PAGEERROR',e.stack||e.message)});
await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${project}-auth-token`,session});

await page.route('https://zwkpmjjuurgjygcrejiw.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),u=new URL(url),method=req.method();
 if(u.pathname.startsWith('/auth/v1/')){
   if(u.pathname.endsWith('/user')) return route.fulfill(out(session.user));
   if(u.pathname.endsWith('/token')) return route.fulfill(out(session));
   return route.fulfill(out({}));
 }
 if(u.pathname==='/functions/v1/team-admin'){
   let body={};try{body=req.postDataJSON()}catch{}
   if(body.action==='list') return route.fulfill(out({users:[{email,registered:true,confirmed:true,email_confirmed_at:'2026-01-01T00:00:00Z',last_sign_in_at:'2026-10-06T10:00:00Z',auth_created_at:'2026-01-01T00:00:00Z'}]}));
   if(body.action==='email_log') return route.fulfill(out({emails:[]}));
   if(body.action==='audit_log') return route.fulfill(out({actions:[]}));
   return route.fulfill(out({ok:true}));
 }
 if(u.pathname.startsWith('/storage/v1/object/')){
   if(method==='GET'){storageDownloads++;return route.fulfill({status:200,contentType:'application/pdf',body:Buffer.from('%PDF-1.4\nQA\n%%EOF')});}
   return route.fulfill(out({Key:u.pathname}));
 }
 if(u.pathname.startsWith('/rest/v1/rpc/')){
   const fn=u.pathname.split('/').pop();let body={};try{body=req.postDataJSON()}catch{}
   if(fn==='ops_save_closing'){
     const p=body.p_closing||{},drawers=body.p_drawers||[];let id=p.id||crypto.randomUUID();
     const opening=drawers.reduce((a,x)=>a+Number(x.opening_cash||0),0),closing=drawers.reduce((a,x)=>a+Number(x.closing_cash||0),0);
     const cash=closing+Number(p.cash_withdrawals||0)+Number(p.cash_expenses_declared||0)-opening;
     let row=fixtures.ops_daily_closings.find(x=>x.id===id);
     const data={id,store_id:p.store_id,business_date:p.business_date,opening_cash:opening,cash_sales:cash,card_sales:Number(p.card_sales||0),bizum_sales:Number(p.bizum_sales||0),online_sales:Number(p.online_sales||0),other_income:Number(p.other_income||0),cash_withdrawals:Number(p.cash_withdrawals||0),cash_expenses_declared:Number(p.cash_expenses_declared||0),expected_cash:closing,actual_cash:closing,difference:0,notes:p.notes||'',status:p.status||'cerrado',source:'manual',legacy_cash_method:false,include_in_income:true};
     if(row)Object.assign(row,data);else fixtures.ops_daily_closings.push(data);
     fixtures.ops_daily_closing_drawers=fixtures.ops_daily_closing_drawers.filter(x=>x.closing_id!==id);
     fixtures.ops_daily_closing_drawers.push(...drawers.map(x=>({id:crypto.randomUUID(),closing_id:id,drawer_id:x.drawer_id,opening_cash:Number(x.opening_cash||0),closing_cash:Number(x.closing_cash||0),notes:x.notes||''})));
     return route.fulfill(out(id));
   }
   if(fn==='ops_save_expense'){
     const p=body.p_expense||{},lines=body.p_lines||[];let id=p.id||crypto.randomUUID();
     let row=fixtures.ops_expenses.find(x=>x.id===id);
     let base=0,vat=0,re=0,wh=0;
     const made=lines.map((l,i)=>{const b=Number(l.base_amount||0),vr=Number(l.vat_rate||0),rr=Number(l.re_rate||0),wr=Number(l.withholding_rate||0);base+=b;vat+=b*vr/100;re+=b*rr/100;wh+=b*wr/100;return{...l,id:crypto.randomUUID(),expense_id:id,sort_order:l.sort_order||((i+1)*10),vat_amount:b*vr/100,re_base:rr?b:0,re_amount:b*rr/100,withholding_base:wr?b:0,withholding_amount:b*wr/100,irpf_imputable:l.deductible_irpf===false||l.fixed_asset?0:b+b*vr/100+b*rr/100}});
     const accounting=base+vat+re;
     const data={id,store_id:p.store_id||null,expense_date:p.expense_date,supplier_name:p.supplier_name,supplier_tax_id:p.supplier_tax_id||'',invoice_number:p.invoice_number||'',description:p.description||'',payment_method:p.payment_method||'transferencia',paid_status:p.paid_status||'pagado',paid_date:p.paid_date||null,base_amount:base,vat_amount:vat,re_amount:re,withholding_amount:wh,gross_expense:accounting,accounting_amount:accounting,amount_paid:p.amount_paid??(accounting-wh),deductible_irpf:!p.management_only,deductible_pct:p.management_only?0:100,notes:p.notes||'',document_kind:p.document_kind||'factura',source:'manual',fiscal_reviewed:!!p.fiscal_reviewed,management_only:!!p.management_only,document_id:row?.document_id||null};
     if(row)Object.assign(row,data);else fixtures.ops_expenses.push(data);
     fixtures.ops_expense_lines=fixtures.ops_expense_lines.filter(x=>x.expense_id!==id);fixtures.ops_expense_lines.push(...made);
     return route.fulfill(out(id));
   }
   if(fn==='ops_save_document_draft'){
     const p=body.p_document||{},lines=body.p_lines||[];let id=p.id||crypto.randomUUID();
     let row=fixtures.ops_sales_invoices.find(x=>x.id===id);let base=0,vat=0,total=0;
     const made=lines.map((l,i)=>{const q=Number(l.quantity||0),u=Number(l.unit_price_base||0),d=Number(l.discount_pct||0),v=Number(l.vat_rate||0),b=q*u*(1-d/100),va=b*v/100;return{id:crypto.randomUUID(),invoice_id:id,sort_order:l.sort_order||((i+1)*10),description:l.description,quantity:q,unit_price_base:u,discount_pct:d,vat_rate:v,base_amount:b,vat_amount:va,total_amount:b+va}});
     made.forEach(x=>{base+=x.base_amount;vat+=x.vat_amount;total+=x.total_amount});
     const data={...p,id,status:'borrador',number:row?.number||null,display_number:row?.display_number||null,base_amount:base,vat_amount:vat,total_amount:total,external_number_text:row?.external_number_text||null,generated_document_id:row?.generated_document_id||null,converted_invoice_id:row?.converted_invoice_id||null,design_snapshot:row?.design_snapshot||{},template_snapshot:row?.template_snapshot||{},record_hash:row?.record_hash||null,previous_hash:row?.previous_hash||null};
     if(row)Object.assign(row,data);else fixtures.ops_sales_invoices.push(data);
     fixtures.ops_sales_invoice_lines=fixtures.ops_sales_invoice_lines.filter(x=>x.invoice_id!==id);fixtures.ops_sales_invoice_lines.push(...made);
     return route.fulfill(out(id));
   }
   if(fn==='ops_finalize_document'){
     const id=body.p_document_id,row=fixtures.ops_sales_invoices.find(x=>x.id===id);if(!row)return route.fulfill(out({message:'not found'},404));
     const ser=fixtures.ops_invoice_series.find(x=>x.id===row.series_id);const num=ser?.next_number||1;if(ser)ser.next_number=num+1;
     Object.assign(row,{number:num,display_number:(ser?.prefix||'QA-')+String(num).padStart(ser?.padding||4,'0'),status:'emitida',record_hash:'qa-hash-'+id,design_snapshot:fixtures.ops_document_templates[0]||{},template_snapshot:fixtures.ops_document_templates[0]||{}});
     return route.fulfill(out(row));
   }
   if(fn==='ops_register_external_document'){
     const id=body.p_document_id,num=Number(body.p_number),row=fixtures.ops_sales_invoices.find(x=>x.id===id),ser=fixtures.ops_invoice_series.find(x=>x.id===row?.series_id);if(row)Object.assign(row,{number:num,display_number:(ser?.prefix||'QA-')+String(num).padStart(ser?.padding||4,'0'),external_number_text:String(num),status:'emitida',record_hash:'qa-ext-'+id});
     if(ser)ser.next_number=Math.max(ser.next_number,num+1);return route.fulfill(out(row||{}));
   }
   if(fn==='ops_convert_proforma'){
     const src=fixtures.ops_sales_invoices.find(x=>x.id===body.p_proforma_id),id=crypto.randomUUID();if(!src)return route.fulfill(out({message:'not found'},404));
     const inv={...src,id,series_id:body.p_invoice_series_id,document_type:'factura',invoice_kind:'invoice',status:'borrador',number:null,display_number:null,converted_invoice_id:null,source_proforma_document_id:src.id};fixtures.ops_sales_invoices.push(inv);
     fixtures.ops_sales_invoice_lines.push(...fixtures.ops_sales_invoice_lines.filter(x=>x.invoice_id===src.id).map(x=>({...x,id:crypto.randomUUID(),invoice_id:id})));src.status='convertida';src.converted_invoice_id=id;return route.fulfill(out(id));
   }
   return route.fulfill(out({}));
 }
 if(u.pathname.startsWith('/rest/v1/')){
   const table=tableFrom(url);
   if(method==='GET') return route.fulfill(out(fixtures[table]||[]));
   let body={};try{body=req.postDataJSON()}catch{}
   if(method==='POST'){
     const input=Array.isArray(body)?body:[body||{}];
     const made=input.map(row=>({...row,id:row.id||crypto.randomUUID(),created_at:row.created_at||new Date().toISOString()}));
     if(Array.isArray(fixtures[table])) fixtures[table].push(...made);
     const wantsObject=(req.headers()['accept']||'').includes('vnd.pgrst.object');
     return route.fulfill(out(wantsObject?made[0]:made));
   }
   if(method==='PATCH'){
     const m=(u.searchParams.get('id')||'').match(/^eq\.(.+)$/),id=m?.[1];
     if(id&&Array.isArray(fixtures[table])){const row=fixtures[table].find(x=>x.id===id);if(row)Object.assign(row,body)}
     const wantsObject=(req.headers()['accept']||'').includes('vnd.pgrst.object');
     return route.fulfill(out(wantsObject?(fixtures[table]?.find(x=>x.id===id)||body):[]));
   }
   if(method==='DELETE'){
     const m=(u.searchParams.get('id')||'').match(/^eq\.(.+)$/),id=m?.[1];
     if(id&&Array.isArray(fixtures[table])){const ix=fixtures[table].findIndex(x=>x.id===id);if(ix>=0)fixtures[table].splice(ix,1)}
     return route.fulfill(out([]));
   }
   return route.fulfill(out({}));
 }
 return route.fulfill(out({}));
});

function assert(cond,msg){if(!cond)throw new Error(msg)}
async function heading(text){await page.getByRole('heading',{name:text,exact:true}).first().waitFor({timeout:10000})}
function field(label){return page.locator('label').filter({hasText:label}).first().locator('..').locator('input,select,textarea').first()}

await page.goto(base,{waitUntil:'networkidle'});
await heading('Totus Central');

// Pricing and decimal-focus regression.
await page.getByRole('button',{name:'Pricing',exact:true}).first().click();
await page.getByRole('heading',{name:'Precio rápido',exact:true}).waitFor();
const cost=page.locator('#q_cost');await cost.click();await cost.type('3.20');
assert(await cost.inputValue()==='3,20','El coste no normalizó punto a coma');
assert(await page.evaluate(()=>document.activeElement?.id)==='q_cost','El campo de coste perdió el foco');
await page.locator('#q_pvp').fill('5,70');
await page.locator('#q_disc').fill('10');
await page.waitForTimeout(100);
assert((await page.locator('#q_out_real').innerText()).includes('4,04'),'Cálculo de coste real incorrecto');
assert((await page.locator('#q_out_sale').innerText()).includes('5,13'),'Cálculo de venta final incorrecto');

// Cajas: isolated page and live cash calculation.
await page.getByRole('button',{name:'Cajas',exact:true}).click();await heading('Cajas');
await field('Tarjeta').fill('333,31');
const closeInputs=page.locator('label').filter({hasText:'queda en caja'}).locator('..').locator('input');
assert(await closeInputs.count()===2,'Hortimatic debe mostrar dos cajas');
await field('Caja vape · apertura').fill('100');
await field('Caja vape · queda en caja').fill('130');
await field('Caja head · apertura').fill('100');
await field('Caja head · queda en caja').fill('120');
await field('Salida de caja').fill('50');
await page.waitForTimeout(100);
assert((await page.locator('#ops_close_cashsales').innerText()).includes('100,00'),'Cálculo efectivo de cierre incorrecto');
await page.getByRole('button',{name:'Guardar cierre',exact:true}).click();
await page.waitForTimeout(200);
assert(fixtures.ops_daily_closings.length===1,'El cierre no se guardó');
assert(Number(fixtures.ops_daily_closings[0].cash_sales)===100,'El cierre guardado tiene efectivo incorrecto');
assert(fixtures.ops_daily_closing_drawers.length===2,'No se guardaron las dos cajas de Hortimatic');

// Gastos: internal-only quick helpers.
await page.getByRole('button',{name:'Gastos',exact:true}).click();await heading('Gastos');
await page.getByRole('button',{name:'Almacén 300 €',exact:true}).click();
assert(await page.locator('#ops_management_only').isChecked(),'Almacén debe quedar como solo control interno');
assert(await field('Proveedor / servicio').inputValue()==='Almacén','Proveedor interno almacén incorrecto');
await page.getByRole('button',{name:'Horas extra',exact:true}).click();
assert(await page.locator('#ops_management_only').isChecked(),'Horas extra debe quedar fuera de fiscalidad');
await page.evaluate(()=>opsNewExpense());
await field('Proveedor / servicio').fill('Proveedor QA');
await field('NIF / CIF proveedor').fill('B12345678');
await field('Nº factura proveedor').fill('PROV-QA-001');
await field('Base').fill('100');
await page.waitForTimeout(180);
await page.locator('#ops_exp_file').setInputFiles({name:'factura-proveedor-qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nFACTURA QA\n%%EOF')});
await page.getByRole('button',{name:'Guardar gasto',exact:true}).click();
await page.waitForTimeout(250);
assert(fixtures.ops_expenses.some(x=>x.invoice_number==='PROV-QA-001'),'El gasto con factura no se guardó');
const savedExpense=fixtures.ops_expenses.find(x=>x.invoice_number==='PROV-QA-001');
assert(savedExpense.document_id,'El gasto no quedó enlazado a su factura adjunta');
assert(fixtures.ops_documents.some(x=>x.linked_entity_type==='expense'&&x.linked_entity_id===savedExpense.id),'El documento del gasto no quedó archivado');

// Facturación: invoice/proforma separation, line calculator and PDF preview.
await page.getByRole('button',{name:'Facturación',exact:true}).click();await heading('Facturación');
await page.getByRole('heading',{name:'Factura',exact:true}).waitFor();
await page.getByRole('button',{name:'Rectificativas',exact:true}).click();
await page.getByRole('heading',{name:'Factura rectificativa',exact:true}).waitFor();
await page.getByRole('button',{name:'Proformas',exact:true}).click();
await page.getByRole('heading',{name:'Proforma',exact:true}).waitFor();
await field('Cliente / razón social').fill('Cliente QA');
await field('Descripción').fill('Servicio QA');
await field('Cant.').fill('2');
await field('Precio base').fill('100');
await field('Dto %').fill('10');
await page.waitForTimeout(200);
assert((await page.locator('.ops-invoice-total').innerText()).includes('217,80'),'Total de proforma incorrecto');
let dl;
const pdfDownload=page.waitForEvent('download');
await page.getByRole('button',{name:'Vista previa PDF',exact:true}).click();
const pdf=await pdfDownload;
assert((await pdf.suggestedFilename()).endsWith('.pdf'),'Vista previa no descargó PDF');
await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
await page.waitForTimeout(250);
const savedProforma=fixtures.ops_sales_invoices.find(x=>x.document_type==='proforma'&&x.customer_name==='Cliente QA');
assert(savedProforma,'La proforma no se guardó');
assert(fixtures.ops_sales_invoice_lines.some(x=>x.invoice_id===savedProforma.id),'La proforma no guardó sus líneas');
assert(Math.abs(Number(savedProforma.total_amount)-217.8)<0.01,'Total persistido de proforma incorrecto');
await page.getByRole('button',{name:'Proformas',exact:true}).click();
const row=page.locator('tr').filter({hasText:'Cliente QA'}).first();
const issuedPdfDownload=page.waitForEvent('download');
await row.getByRole('button',{name:'Emitir',exact:true}).click();
const issuedPdf=await issuedPdfDownload;
assert((await issuedPdf.suggestedFilename()).endsWith('.pdf'),'La emisión no generó su PDF');
await page.waitForTimeout(250);
assert(savedProforma.status==='emitida','La proforma no se emitió');
assert(savedProforma.display_number,'La proforma emitida no recibió numeración');


// Documentos: UI completo subir -> recargar -> descargar.
await page.getByRole('button',{name:'Documentos',exact:true}).click();await heading('Documentos');
await field('Proveedor / cliente').fill('Proveedor QA');
await field('Nº documento').fill('QA-2026-001');
await page.locator('#ops_doc_file').setInputFiles({name:'qa.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nQA\n%%EOF')});
assert((await page.locator('#ops_doc_file').inputValue()).includes('qa.pdf'),'Selector documental no cargó archivo');
await page.getByRole('button',{name:'Subir',exact:true}).click();
await page.locator('td').filter({hasText:'qa.pdf'}).first().waitFor({timeout:10000});
const qaDoc=fixtures.ops_documents.find(x=>x.original_name==='qa.pdf');
assert(qaDoc,'El documento QA no tiene registro persistido');
const beforeStorageDownloads=storageDownloads;
await page.evaluate(id=>window.opsDownloadDocument(id),qaDoc.id);
await page.waitForTimeout(180);
assert(storageDownloads===beforeStorageDownloads+1,'Descarga documental no consultó Supabase Storage');
assert(fixtures.ops_documents.some(x=>x.original_name==='qa.pdf'),'El documento independiente no persistió');


// Fiscalidad: counters and simulator.
await page.getByRole('button',{name:'Fiscalidad',exact:true}).click();await heading('Fiscalidad');
await page.getByRole('heading',{name:/Contador IRPF/}).waitFor();
await field('Gasto deducible adicional').fill('500');
await page.waitForTimeout(250);
assert(await page.getByText('Reserva fiscal',{exact:false}).count()>0,'No aparece reserva fiscal');

// Informes: estructura gestoría + XLSX, PDF and ZIP generators.
const reportQa=await page.evaluate(()=>{
  const g=window.__TotusOpsTest.managerExpenseRows('2026-01-01','2026-12-31');
  const s=window.__TotusOpsTest.managerExpenseSummaryRows('2026-01-01','2026-12-31');
  const i=window.__TotusOpsTest.managerIncomeRows('2026-01-01','2026-12-31');
  return {g,s,i};
});
assert(reportQa.g[0].join('|')==='Orden|Fecha|Nºfra.rec.|Nºfra.proveedor|Rt|Identificación|Concepto|Base IVA|%|Cuota IVA|Base R. Equiv.|% R.Eq.|Cuota R.Equiv.|Imputable a IRPF|Base retención|% ret.|Cuota retenida','Cabecera de gastos no coincide con gestoría');
assert(reportQa.g.some(r=>String(r[6]).includes('IVA SOPORTADO(RECARGO - REAGYP)')),'Falta fila separada de IVA/RE en gastos');
assert(reportQa.g.at(-1)[6]==='TOTAL ACUMULADO','Falta total acumulado en gastos');
assert(reportQa.s[0][0]==='Descripción'&&reportQa.s[0][5]==='Imputable IRPF','Desglose de conceptos incorrecto');
assert(reportQa.i[0][0]==='Orden'&&reportQa.i[0][2]==='Nº factura'&&reportQa.i[0][4]==='Identificación del Cliente','Cabecera de ingresos no coincide con gestoría');
assert(reportQa.i.at(-1)[5]==='TOTAL ACUMULADO','Falta total acumulado en ingresos');
assert(reportQa.i.slice(1,-1).every(r=>/^\d{2}\/\d{2}\/\d{4}$/.test(String(r[1]))),'Fechas de ingresos no están en DD/MM/AAAA');

await page.getByRole('button',{name:'Informes',exact:true}).click();await heading('Informes');
dl=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar XLSX'}).first().click();assert((await (await dl).suggestedFilename()).endsWith('.xlsx'),'Informe XLSX no generado');
dl=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF'}).click();assert((await (await dl).suggestedFilename()).endsWith('.pdf'),'Informe fiscal PDF no generado');
dl=page.waitForEvent('download');await page.getByRole('button',{name:'Preparar paquete'}).click();assert((await (await dl).suggestedFilename()).endsWith('.zip'),'Paquete gestor ZIP no generado');

// Administración: separated configuration and template controls.
await page.getByRole('button',{name:'Administración',exact:true}).click();await heading('Usuarios');
await page.getByRole('button',{name:'Configuración',exact:true}).click();await heading('Configuración');
await page.getByText('Datos fiscales',{exact:true}).waitFor();
await field('Color de texto').waitFor();
await field('Posición logo').waitFor();
await field('Título factura').waitFor();
await field('Título proforma').waitFor();
await page.locator('#ops_tpl_logo').setInputFiles({name:'logo-qa.png',mimeType:'image/png',buffer:Buffer.from('PNG-QA')});
await page.getByRole('button',{name:'Subir logo',exact:true}).click();
await page.waitForTimeout(150);

// Encargado: facturación debe quedar estrictamente en modo consulta.
fixtures.team_members[0].role='encargado';
fixtures.profiles[0].role='encargado';
await page.reload({waitUntil:'networkidle'});
await heading('Totus Central');
await page.getByRole('button',{name:'Facturación',exact:true}).click();await heading('Facturación');
await page.getByText('Modo consulta:',{exact:false}).waitFor();
assert(await page.getByRole('button',{name:'Guardar borrador',exact:true}).count()===0,'El encargado no debe poder guardar facturas');
assert(await page.getByRole('button',{name:'+ Nuevo',exact:true}).count()===0,'El encargado no debe poder crear facturas');
assert(await page.getByRole('button',{name:'Facturas',exact:true}).count()===1,'El encargado debe poder consultar facturas');
assert(await page.getByRole('button',{name:'Proformas',exact:true}).count()===1,'El encargado debe poder consultar proformas');

// Responsive smoke.
await page.setViewportSize({width:390,height:844});
await page.locator('.app-home-logo').click();await heading('Totus Central');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
assert(overflow<=8,'Desbordamiento global móvil: '+overflow+'px');

// No unexpected JS dialogs/errors should have fired during non-destructive smoke.
assert(!dialogs.some(x=>/no se pudo|error/i.test(x)),'Se detectó diálogo de error: '+dialogs.join(' | '));
assert(pageErrors.length===0,'Errores JavaScript en navegador: '+pageErrors.join('\n---\n'));

console.log(JSON.stringify({ok:true,modules:['Pricing','Cajas','Gastos','Facturación','Documentos','Fiscalidad','Informes','Administración'],dialogs,pageErrors},null,2));
await browser.close();
