import { BadRequestException } from '@nestjs/common';
import { DEFAULT_LOYALTY_SETTINGS, loyaltySettingsSchema, LoyaltyService, validateRedemption } from '../src/loyalty/loyalty.service';
import { OperationsService } from '../src/operations/operations.service';
import { businessSchema } from '../src/settings/business-settings';

describe('Production loyalty and sale rules', () => {
  const settings = {...DEFAULT_LOYALTY_SETTINGS, maxPercentPayableWithPoints:50};
  it.each([
    [{...settings,enabled:false},10,100,100,'ACTIVE'],
    [settings,51,100,100,'ACTIVE'],
    [settings,9,100,100,'ACTIVE'],
    [settings,20,100,19,'ACTIVE'],
    [settings,20,100,100,'BLOCKED'],
    [settings,20,100,100,'SUSPENDED'],
    [settings,20,100,100,'CANCELLED'],
  ])('rejects an invalid redemption %#', (rules, amount, total, balance, status) => {
    expect(()=>validateRedemption(rules as typeof settings, amount as number,total as number,balance as number,status as never)).toThrow(BadRequestException);
  });
  it('uses the configured monetary value without floating point over-debit',()=>{
    expect(validateRedemption({...settings,redemptionPointValue:0.1},2.1,100,100,'ACTIVE')).toBe(21);
  });
  it.each([{earnRateAmount:0},{maxPercentPayableWithPoints:101},{minPointsToRedeem:1.5},{enabled:'true'}])('rejects invalid settings %j', patch=>{
    expect(loyaltySettingsSchema.safeParse({...settings,...patch}).success).toBe(false);
  });
  it('requires an enabled payment method',()=>{expect(businessSchema.safeParse({paymentMethods:[]}).success).toBe(false);});
  const user={id:'u',organizationId:'o',branchId:'b',permissions:['sales.create']};
  it.each([
    {payments:[{method:'LOYALTY_POINTS',amount:100}]},
    {clientId:'c',payments:[{method:'LOYALTY_POINTS',amount:1},{method:'LOYALTY_POINTS',amount:99}]},
    {payments:[{method:'CASH',amount:100}],items:[{type:'OTHER',description:'test',quantity:0,unitPrice:100}]}
  ])('rejects a malformed or unbacked payment before writing %j',async patch=>{
    const transaction=jest.fn(); const svc=new OperationsService({$transaction:transaction} as never,{} as never,{} as never);
    await expect(svc.createSale(user,{items:[{type:'OTHER',description:'test',quantity:1,unitPrice:100}],...patch})).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('does not replace a foreign client card',async()=>{
    const tx={$executeRaw:jest.fn(),client:{findFirst:jest.fn().mockResolvedValue(null)},loyaltyCard:{create:jest.fn(),updateMany:jest.fn()}};
    const service=new LoyaltyService({$transaction:async(fn:any)=>fn(tx)} as never,{} as never);
    await expect(service.replaceCard({organizationId:'o',branchId:'b'},{clientId:'foreign'},user)).rejects.toThrow();
    expect(tx.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:'o',branchId:'b',id:'foreign',deletedAt:null}}));
    expect(tx.loyaltyCard.create).not.toHaveBeenCalled();
  });
  it('returns the existing receipt on retry without charging twice',async()=>{
    const existing={id:'sale'};const tx={$executeRaw:jest.fn(),sale:{findFirst:jest.fn().mockResolvedValue(existing)}};
    const service=new OperationsService({$transaction:async(fn:any)=>fn(tx)} as never,{} as never,{} as never);
    expect(await service.createSale(user,{idempotencyKey:'1234567890123456',items:[{type:'OTHER',description:'Test',unitPrice:100}],payments:[{method:'CASH',amount:100}]})).toEqual(existing);
  });
});
