import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {openCash,closeCash,type OperationsBootstrap} from '../api/client';
export function CashPanel({data,refresh}:{data:OperationsBootstrap;refresh:()=>void}) {
  const [amount,setAmount]=useState(data.settings.defaultOpeningBalance);
  const qc=useQueryClient();
  const action=useMutation({mutationFn:()=>data.cash?closeCash(amount):openCash(amount),onSuccess:()=>{refresh();qc.invalidateQueries({queryKey:['dashboard-summary']});setAmount(0);}});
  const allowed=data.permissions.includes(data.cash?'cash.close':'cash.open');
  return <section className="tool-panel cash-panel">
    <header className="panel-heading compact"><div><span>Operação financeira</span><h2>{data.cash?'Caixa aberto':'Caixa fechado'}</h2></div></header>
    {data.cash && <p className="cash-balance"><span>Saldo esperado</span><strong>{Number(data.cash.expectedBalance).toLocaleString('pt-MZ',{minimumFractionDigits:2,maximumFractionDigits:2})} MT</strong></p>}
    {allowed && <form onSubmit={e=>{e.preventDefault();action.mutate();}}><label>{data.cash?'Numerário contado no fecho (MT)':'Saldo inicial (MT)'}<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(Number(e.target.value))} required/></label>
      {data.cash && <p className="cash-difference">Diferença: {(amount-Number(data.cash.expectedBalance)).toLocaleString('pt-MZ',{minimumFractionDigits:2,maximumFractionDigits:2})} MT</p>}
      <button disabled={action.isPending}>{action.isPending?'A guardar…':data.cash?'Fechar e conferir caixa':'Abrir caixa'}</button>
    </form>}
    {action.isError && <p role="alert">{action.error.message}</p>}
  </section>;
}
