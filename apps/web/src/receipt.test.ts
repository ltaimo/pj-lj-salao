import {describe,it,expect} from 'vitest';
import {buildPdfBlob,buildThermalReceiptHtml} from './utils/thermalReceipt';
import type {Sale} from './api/client';
const sale={id:'s',receiptNumber:'TEST',createdAt:'2026-09-14T10:00:00Z',total:100,paidAmount:100,changeAmount:0,items:[{description:'Corte <script>alert(1)</script>',type:'SERVICE',quantity:1,unitPrice:100,total:100}],payments:[{method:'CASH',amount:100}],businessProfile:{name:'Salão de teste',nuit:'123456789',address:'Endereço configurado',footerText:'Até breve'}} as Sale;
describe('Receipts',()=>{
  it('uses saved identity and escapes customer-facing HTML',()=>{
    const html=buildThermalReceiptHtml(sale);expect(html).toContain('123456789');expect(html).toContain('Endereço configurado');expect(html).not.toContain('<script>');expect(html).not.toContain('400123456');
  });
  it('exports different page sizes and paginates long receipts',async()=>{
    const thermal=await buildPdfBlob(sale,'80mm').text();expect(thermal).toContain('/MediaBox [0 0 227');
    const long={...sale,items:Array.from({length:100},()=>sale.items[0])};
    const a4=await buildPdfBlob(long,'a4').text();expect(a4).toContain('/MediaBox [0 0 595 842]');expect(a4).not.toContain('/Count 1 ');expect(a4).toContain('123456789');
  });
});
