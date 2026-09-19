import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { updateBusinessProfile, type BusinessSettings } from "../api/client";

export function BusinessSettingsForm({profile, refresh}: {profile: BusinessSettings; refresh: () => void}) {
  const [draft, setDraft] = useState(profile);
  const qc = useQueryClient();
  const save = useMutation({mutationFn: updateBusinessProfile, onSuccess: () => {refresh(); qc.invalidateQueries({queryKey: ["settings"]});}});
  const textFields = [["name", "Nome apresentado no recibo"], ["nuit", "NUIT"], ["phone", "Telefone"], ["whatsapp", "WhatsApp"], ["address", "Endereço"], ["email", "E-mail"], ["footerText", "Mensagem de rodapé do recibo"]] as const;
  return <form className="tool-panel wide settings-form" onSubmit={e => {e.preventDefault(); save.mutate(draft);}}>
    <header className="panel-heading"><div><span>Identidade e operação</span><h2>Configurações do negócio</h2></div><p>As alterações aplicam-se às próximas vendas. Os recibos emitidos mantêm os dados originais.</p></header>
    <fieldset><legend>Identificação e recibos</legend><div className="form-grid two">
      {textFields.map(([key,label]) => <label key={key}>{label}<input value={draft[key]} required={key === "name"} type={key === "email" ? "email" : "text"} onChange={e => setDraft({...draft,[key]:e.target.value})}/></label>)}
      <label>Formato predefinido do recibo<select value={draft.receiptFormat} onChange={e => setDraft({...draft,receiptFormat:e.target.value as "80mm" | "A4"})}><option value="80mm">Térmico · 80 mm</option><option value="A4">A4</option></select></label>
    </div></fieldset>
    <fieldset><legend>Pagamentos, descontos e caixa</legend><div className="form-grid two">
      <label>Limite de desconto (%)<input type="number" min="0" max="100" step="0.01" required value={draft.maxDiscountPercent} onChange={e=>setDraft({...draft,maxDiscountPercent:Number(e.target.value)})}/><small>O utilizador também precisa da permissão para conceder descontos.</small></label>
      <label>Fundo de caixa sugerido (MT)<input type="number" min="0" step="0.01" required value={draft.defaultOpeningBalance} onChange={e=>setDraft({...draft,defaultOpeningBalance:Number(e.target.value)})}/></label>
      <label className="check-row"><input type="checkbox" checked={draft.requireOpenCash} onChange={e=>setDraft({...draft,requireOpenCash:e.target.checked})}/> Exigir caixa aberto para vender</label>
      <div className="payment-methods"><strong>Meios de pagamento disponíveis</strong>{[["CASH","Numerário"],["MPESA","M-Pesa"],["EMOLA","e-Mola"],["CARD","Cartão"],["BANK_TRANSFER","Transferência"]].map(([key,label])=><label className="check-row" key={key}><input type="checkbox" checked={draft.paymentMethods.includes(key)} onChange={e=>setDraft({...draft,paymentMethods:e.target.checked?[...draft.paymentMethods,key]:draft.paymentMethods.filter(p=>p!==key)})}/>{label}</label>)}</div>
    </div></fieldset>
    <p className="settings-hint">As taxas, pontos, mínimos e limites encontram-se em <Link to="/fidelizacao">Fidelização → Configurações do programa</Link>.</p>
    {save.isError && <p role="alert" className="form-message">{save.error.message}</p>}
    {save.isSuccess && <p role="status" className="notice">Configurações guardadas.</p>}
    <footer className="form-actions"><button className="primary-action" disabled={save.isPending || !draft.paymentMethods.length}>{save.isPending ? "A guardar…" : "Guardar configurações"}</button></footer>
  </form>;
}
