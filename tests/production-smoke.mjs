import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const credentials = JSON.parse(readFileSync('.audit/test-access.json','utf8'));
const results=[]; let token; let originalBusiness; let originalLoyalty; let limitedUser;
async function request(path,method='GET',body,expected=200,access=token) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(access?{Authorization:`Bearer ${access}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const raw=await response.text();
  const data=raw ? JSON.parse(raw) : null;
  assert.equal(response.status,expected,`${method} ${path}: ${response.status} ${JSON.stringify(data).slice(0,250)}`);
  return data;
}
function pass(name){results.push(name);console.log(`PASS ${name}`);}
try {
  const auth=await request('/auth/login','POST',{email:credentials.email,password:credentials.password},201);
  token=auth.accessToken;
  const me=await request('/auth/me');
  assert.equal(me.organizationId,credentials.organizationId,'Refusing writes outside the dedicated test organization');
  const renewed=await request('/auth/refresh','POST',{refreshToken:auth.refreshToken},201);token=renewed.accessToken;
  await request('/health/db'); pass('login, refresh, database and isolated test identity');
  const boot=await request('/operations/bootstrap');originalBusiness=boot.settings;originalLoyalty=boot.loyaltySettings;
  await request('/settings/business-profile','PUT',{...boot.settings,name:'PJ&LJ · TESTE SEM VALOR COMERCIAL',nuit:'',address:'Ambiente de testes',paymentMethods:['CASH','MPESA'],requireOpenCash:true,maxDiscountPercent:20});
  await request('/loyalty/settings','PUT',{enabled:true,earnRateAmount:10,earnRatePoints:1,redemptionPointValue:2,minSaleAmountToEarn:10,minPointsToRedeem:10,maxPercentPayableWithPoints:50,allowPointsEarningOnPointsPaid:false});
  await request('/loyalty/settings','PUT',{earnRateAmount:0},400);
  await request('/settings/business-profile','PUT',{paymentMethods:[]},400);
  assert.equal((await request('/loyalty/settings')).redemptionPointValue,2);pass('configuration persistence and invalid settings rejected');
  const suffix=randomUUID().slice(0,8);
  const client=await request('/clients','POST',{firstName:`Teste ${suffix}`,notes:'Smoke test isolado, sem operação comercial'},201);
  const service=await request('/services','POST',{name:`Serviço QA ${suffix}`,categoryName:'Testes',price:100,durationMinutes:30},201);
  const product=await request('/products','POST',{name:`Produto QA ${suffix}`,sku:`QA-${suffix}`,stock:2,salePrice:10,minimumStock:1},201);
  const card=await request('/loyalty/cards/issue','POST',{clientId:client.id},201);
  await request('/loyalty/movements/adjust','POST',{clientId:client.id,points:100,reason:'Saldo inicial de teste'},201);
  const saleBody={clientId:client.id,items:[{type:'SERVICE',serviceId:service.id,quantity:1}],payments:[{method:'LOYALTY_POINTS',amount:40},{method:'CASH',amount:60}]};
  const current=await request('/cash/current');if(current)await request('/cash/close','POST',{countedBalance:Number(current.expectedBalance)},201);
  await request('/sales','POST',saleBody,400);
  const cash=await request('/cash/open','POST',{openingBalance:0},201);
  await request('/sales','POST',{...saleBody,clientId:undefined},400);
  await request('/sales','POST',{...saleBody,payments:[{method:'LOYALTY_POINTS',amount:1},{method:'LOYALTY_POINTS',amount:99}]},400);
  await request('/sales','POST',{...saleBody,payments:[{method:'LOYALTY_POINTS',amount:60},{method:'CASH',amount:40}]},400);
  await request('/sales','POST',{...saleBody,payments:[{method:'LOYALTY_POINTS',amount:10},{method:'CASH',amount:90}]},400);
  await request('/sales','POST',{...saleBody,payments:[{method:'CARD',amount:100}]},400);
  await request('/sales','POST',{...saleBody,discount:30,payments:[{method:'CASH',amount:70}]},400);
  pass('POS rejects missing client, duplicate points, cap, minimum, disabled payment, excess discount and closed cash');
  const key=randomUUID();
  const [sale,retry]=await Promise.all([request('/sales','POST',{...saleBody,idempotencyKey:key},201),request('/sales','POST',{...saleBody,idempotencyKey:key},201)]);
  assert.equal(sale.id,retry.id);assert.equal(sale.client.loyaltyPoints,86);assert.equal(sale.businessProfile.name,'PJ&LJ · TESTE SEM VALOR COMERCIAL');
  assert.equal(Number((await request('/cash/current')).expectedBalance),60);
  const movements=await request(`/loyalty/clients/${client.id}/history`);
  assert.equal(movements.filter(m=>m.saleId===sale.id).length,2);
  assert.ok(movements.some(m=>m.points===-20));assert.ok(movements.some(m=>m.points===6));pass('mixed payment, ledger, cash and concurrent idempotent retry');
  await request('/loyalty/cards/'+card.id+'/status','PATCH',{status:'SUSPENDED'});
  await request('/sales','POST',saleBody,400);
  await request('/loyalty/cards/'+card.id+'/status','PATCH',{status:'ACTIVE'});
  await request('/loyalty/settings','PUT',{enabled:false});await request('/sales','POST',saleBody,400);
  await request('/loyalty/settings','PUT',{enabled:true});pass('suspended card and disabled programme cannot redeem');
  const productBody={items:[{type:'PRODUCT',productId:product.id,quantity:1}],payments:[{method:'CASH',amount:10}]};
  const concurrent=await Promise.allSettled(Array.from({length:3},()=>request('/sales','POST',{...productBody,idempotencyKey:randomUUID()},201)));
  assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,2);
  assert.equal(Number((await request('/products')).find(p=>p.id===product.id).stock),0);pass('concurrent stock sales cannot oversell');
  const entry=await request('/queue','POST',{customerName:`Teste ${suffix}`,clientId:client.id,serviceId:service.id},201);
  await request(`/queue/${entry.id}/status`,'PATCH',{status:'IN_SERVICE'});await request(`/queue/${entry.id}/status`,'PATCH',{status:'COMPLETED'});
  await request('/appointments','POST',{customerName:`Teste ${suffix}`,serviceId:service.id,clientId:client.id,startsAt:new Date(Date.now()+86400000).toISOString(),durationMinutes:30},201);pass('queue through completion and appointment persistence');
  const replacement=await request('/loyalty/cards/replace','POST',{clientId:client.id,reason:'Teste de substituição'},201);
  assert.notEqual(replacement.id,card.id);assert.equal((await request('/loyalty/cards/lookup?query='+encodeURIComponent(card.cardNumber))).card.status,'CANCELLED');
  await request('/loyalty/cards/'+card.id+'/status','PATCH',{status:'ACTIVE'},400);pass('card replacement preserves cancellation');
  const password=randomBytes(18).toString('base64url');
  limitedUser=await request('/users','POST',{name:'Receção QA',email:`rececao.${suffix}@pjlj.local`,password,roles:['receptionist']},201);
  const receptionist=await request('/auth/login','POST',{email:limitedUser.email,password},201);
  const limitedBoot=await request('/operations/bootstrap','GET',undefined,200,receptionist.accessToken);assert.deepEqual(limitedBoot.sales,[]);
  await request('/sales','GET',undefined,403,receptionist.accessToken);
  await request('/loyalty/settings','GET',undefined,200,receptionist.accessToken);
  await request('/loyalty/settings','PUT',{enabled:false},403,receptionist.accessToken);
  await request('/loyalty/movements/adjust','POST',{clientId:client.id,points:100,reason:'Forbidden'},403,receptionist.accessToken);pass('receptionist can read rules but cannot access sales reports, adjust points or change settings');
  const expectedCash=Number((await request('/cash/current')).expectedBalance);
  const closed=await request('/cash/close','POST',{countedBalance:expectedCash},201);assert.equal(Number(closed.difference),0);
  const dashboard=await request('/dashboard/summary');assert.ok(dashboard.metrics);
  assert.ok((await request('/sales')).some(s=>s.id===sale.id));await request('/audit');await request('/loyalty/reports/summary');pass('cash reconciliation, persisted receipt, dashboard, reports and audit');
  mkdirSync('.audit',{recursive:true});writeFileSync('.audit/last-smoke-sale.json',JSON.stringify(sale,null,2));
} catch(error){console.error(error.message);process.exitCode=1;}
finally {
  if(token){
    if(limitedUser)await request('/users/'+limitedUser.id,'DELETE').catch(()=>{});
    if(originalBusiness)await request('/settings/business-profile','PUT',originalBusiness).catch(e=>{console.error('Settings restore:',e.message);process.exitCode=1;});
    if(originalLoyalty)await request('/loyalty/settings','PUT',originalLoyalty).catch(e=>{console.error('Loyalty restore:',e.message);process.exitCode=1;});
  }
  writeFileSync('.audit/smoke-'+(base.includes('127.0.0.1')?'local':'production')+'.json',JSON.stringify({base,date:new Date().toISOString(),passed:!process.exitCode,checks:results},null,2));
}
