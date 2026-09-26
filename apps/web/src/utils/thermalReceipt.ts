import type { Sale } from "../api/client";

export type ReceiptFormat = "80mm" | "a4";

export interface BusinessProfile {
  name?: string;
  nuit?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  email?: string;
  footerText?: string;
}

const defaultProfile: BusinessProfile = {name: "PJ&LJ Salão Unissex", footerText: "Obrigado pela preferência!"};

function formatMoney(value: string | number): string {
  const num = Number(value) || 0;
  return `${num.toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT`;
}

function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString("pt-MZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return dateString;
  }
}

export function buildThermalReceiptHtml(sale: Sale, profile: BusinessProfile = sale.businessProfile ?? defaultProfile): string {
  const p = { ...defaultProfile, ...profile };
  const dateStr = formatDate(sale.createdAt);

  const itemsHtml = sale.items
    .map(
      (item) => `
      <tr class="item-row">
        <td class="item-desc">
          <div class="item-name">${escapeHtml(item.description)}</div>
          ${item.employee?.name ? `<div class="item-staff">Atendido por: ${escapeHtml(item.employee.name)}</div>` : ""}
        </td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-price">${formatMoney(item.unitPrice)}</td>
        <td class="item-total">${formatMoney(item.total)}</td>
      </tr>
    `
    )
    .join("");

  const paymentsHtml = sale.payments
    .map(
      (pay) => `
      <div class="flex-between">
        <span>Método: ${translatePaymentMethod(pay.method)}</span>
        <span>${formatMoney(pay.amount)}</span>
      </div>
    `
    )
    .join("");

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=80mm, initial-scale=1.0" />
  <title>Recibo ${escapeHtml(sale.receiptNumber)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      font-family: 'Courier New', Courier, monospace, sans-serif;
    }
    body {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 4mm 3mm;
      background: #fff;
      color: #000;
      font-size: 11px;
      line-height: 1.3;
    }
    .header {
      text-align: center;
      padding-bottom: 4px;
      border-bottom: 1px dashed #000;
      margin-bottom: 6px;
    }
    .header h2 {
      font-size: 14px;
      font-weight: bold;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .header p {
      margin: 1px 0;
      font-size: 10px;
    }
    .doc-info {
      text-align: center;
      margin: 6px 0;
      padding-bottom: 6px;
      border-bottom: 1px dashed #000;
    }
    .doc-title {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .doc-num {
      font-size: 13px;
      font-weight: bold;
      margin: 2px 0;
    }
    .client-box {
      margin: 6px 0;
      padding-bottom: 6px;
      border-bottom: 1px dashed #000;
      font-size: 10px;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
    }
    table.items th {
      border-bottom: 1px solid #000;
      text-align: left;
      font-size: 9px;
      padding-bottom: 2px;
    }
    table.items th.num { text-align: right; }
    .item-row td {
      padding: 3px 0;
      vertical-align: top;
      font-size: 10px;
    }
    .item-desc { width: 45%; }
    .item-qty { width: 12%; text-align: center; }
    .item-price { width: 21%; text-align: right; }
    .item-total { width: 22%; text-align: right; font-weight: bold; }
    .item-name { font-weight: bold; }
    .item-staff { font-size: 9px; font-style: italic; color: #444; }
    .totals {
      border-top: 1px solid #000;
      margin-top: 4px;
      padding-top: 4px;
    }
    .flex-between {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .grand-total {
      font-size: 13px;
      font-weight: bold;
      border-top: 1px double #000;
      border-bottom: 1px double #000;
      padding: 4px 0;
      margin: 4px 0;
    }
    .payments-box {
      margin: 6px 0;
      padding-top: 4px;
      border-top: 1px dashed #000;
      font-size: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #000;
      font-size: 9px;
    }
    .qr-stub {
      margin: 8px auto 4px auto;
      width: 64px;
      height: 64px;
      border: 2px solid #000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      text-align: center;
      font-weight: bold;
    }
    @media print {
      body { width: 80mm; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${escapeHtml(p.name || "")}</h2>
    ${p.nuit ? `<p>NUIT: ${escapeHtml(p.nuit)}</p>` : ""}
    ${p.address ? `<p>${escapeHtml(p.address)}</p>` : ""}
    ${p.phone ? `<p>Tel: ${escapeHtml(p.phone)}</p>` : ""}
  </div>

  <div class="doc-info">
    <div class="doc-title">Recibo de Venda</div>
    <div class="doc-num">${escapeHtml(sale.receiptNumber)}</div>
    <div>Data/Hora: ${dateStr}</div>
  </div>

  ${
    sale.client
      ? `
  <div class="client-box">
    <div><strong>Cliente:</strong> ${escapeHtml(sale.client.firstName)} ${escapeHtml(sale.client.lastName ?? "")}</div>
    ${sale.client.phone ? `<div><strong>Contactos:</strong> ${escapeHtml(sale.client.phone)}</div>` : ""}
    ${sale.client.loyaltyPoints !== undefined ? `<div><strong>Pontos Fidelização:</strong> ${sale.client.loyaltyPoints} pts</div>` : ""}
  </div>
  `
      : `
  <div class="client-box">
    <div><strong>Cliente:</strong> Consumidor Final</div>
  </div>
  `
  }

  <table class="items">
    <thead>
      <tr>
        <th class="item-desc">Item</th>
        <th class="item-qty num">Qtd</th>
        <th class="item-price num">Preço</th>
        <th class="item-total num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="flex-between">
      <span>Subtotal:</span>
      <span>${formatMoney(sale.subtotal ?? sale.total)}</span>
    </div>
    ${
      Number(sale.discount || 0) > 0
        ? `
    <div class="flex-between">
      <span>Desconto:</span>
      <span>-${formatMoney(sale.discount || 0)}</span>
    </div>
    `
        : ""
    }
    ${
      Number(sale.tipAmount || 0) > 0
        ? `
    <div class="flex-between">
      <span>Gorjeta:</span>
      <span>${formatMoney(sale.tipAmount || 0)}</span>
    </div>
    `
        : ""
    }
    <div class="flex-between grand-total">
      <span>TOTAL A PAGAR:</span>
      <span>${formatMoney(sale.total)}</span>
    </div>
  </div>

  <div class="payments-box">
    <div style="font-weight:bold; margin-bottom:2px;">Pagamentos:</div>
    ${paymentsHtml}
    <div class="flex-between" style="margin-top:3px;">
      <span>Valor Entregue:</span>
      <span>${formatMoney(sale.paidAmount)}</span>
    </div>
    <div class="flex-between">
      <span>Troco:</span>
      <span>${formatMoney(sale.changeAmount)}</span>
    </div>
  </div>

  <div class="footer">
    <p>${escapeHtml(p.footerText ?? "Obrigado pela preferência!")}</p>
  </div>
</body>
</html>`;
}

export function buildA4InvoiceHtml(sale: Sale, profile: BusinessProfile = sale.businessProfile ?? defaultProfile): string {
  const p = { ...defaultProfile, ...profile };
  const dateStr = formatDate(sale.createdAt);

  const itemsRows = sale.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:center;">${idx + 1}</td>
        <td style="padding:10px; border-bottom:1px solid #e5e7eb;">
          <strong>${escapeHtml(item.description)}</strong>
          ${item.employee?.name ? `<br/><small style="color:#6b7280;">Profissional: ${escapeHtml(item.employee.name)}</small>` : ""}
        </td>
        <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:center;">${item.quantity}</td>
        <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:right;">${formatMoney(item.unitPrice)}</td>
        <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:right;"><strong>${formatMoney(item.total)}</strong></td>
      </tr>
    `
    )
    .join("");

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Fatura/Recibo ${escapeHtml(sale.receiptNumber)}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; margin: 0; padding: 40px; background: #fff; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #111827; }
    .brand h1 { margin: 0 0 4px 0; color: #111827; font-size: 26px; font-weight: 800; }
    .brand p { margin: 2px 0; color: #4b5563; font-size: 13px; }
    .doc-details { text-align: right; }
    .doc-details h2 { margin: 0; font-size: 20px; color: #0284c7; text-transform: uppercase; }
    .doc-details p { margin: 4px 0; font-size: 13px; color: #374151; }
    .info-grid { display: flex; justify-content: space-between; margin: 30px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; }
    .info-box h3 { margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
    .info-box p { margin: 2px 0; font-size: 14px; font-weight: 600; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f3f4f6; color: #374151; text-align: left; padding: 12px 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .totals-area { display: flex; justify-content: flex-end; margin-top: 24px; }
    .totals-table { width: 320px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .grand-total { font-size: 18px; font-weight: 800; color: #111827; border-top: 2px solid #111827; border-bottom: 2px solid #111827; padding: 10px 0; margin-top: 6px; }
    .footer { margin-top: 50px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <h1>${escapeHtml(p.name || "")}</h1>
        <p>${escapeHtml(p.address || "")}</p>
        <p>NUIT: ${escapeHtml(p.nuit || "")} | Tel: ${escapeHtml(p.phone || "")}</p>
      </div>
      <div class="doc-details">
        <h2>Fatura / Recibo</h2>
        <p><strong>Nº:</strong> ${escapeHtml(sale.receiptNumber)}</p>
        <p><strong>Data:</strong> ${dateStr}</p>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3>Cliente</h3>
        <p>${sale.client ? `${escapeHtml(sale.client.firstName)} ${escapeHtml(sale.client.lastName ?? "")}` : "Consumidor Final"}</p>
        ${sale.client?.phone ? `<p style="font-weight:normal; font-size:13px; color:#4b5563;">Tel: ${escapeHtml(sale.client.phone)}</p>` : ""}
      </div>
      <div class="info-box" style="text-align:right;">
        <h3>Estado do Pagamento</h3>
        <p style="color:#059669;">PAGO (${sale.payments.map((pay) => translatePaymentMethod(pay.method)).join(", ")})</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>Descrição do Serviço / Produto</th>
          <th style="width:80px; text-align:center;">Qtd</th>
          <th style="width:120px; text-align:right;">Preço Unit.</th>
          <th style="width:140px; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="totals-area">
      <div class="totals-table">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${formatMoney(sale.subtotal ?? sale.total)}</span>
        </div>
        ${
          Number(sale.discount || 0) > 0
            ? `<div class="totals-row"><span>Desconto:</span><span>-${formatMoney(sale.discount || 0)}</span></div>`
            : ""
        }
        ${
          Number(sale.tipAmount || 0) > 0
            ? `<div class="totals-row"><span>Gorjeta:</span><span>${formatMoney(sale.tipAmount || 0)}</span></div>`
            : ""
        }
        <div class="totals-row grand-total">
          <span>TOTAL:</span>
          <span>${formatMoney(sale.total)}</span>
        </div>
        <div class="totals-row" style="color:#6b7280; font-size:13px; margin-top:8px;">
          <span>Valor Recebido:</span>
          <span>${formatMoney(sale.paidAmount)}</span>
        </div>
        <div class="totals-row" style="color:#6b7280; font-size:13px;">
          <span>Troco:</span>
          <span>${formatMoney(sale.changeAmount)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>${escapeHtml(p.footerText || "")}</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildWhatsAppShareText(sale: Sale, profile: BusinessProfile = sale.businessProfile ?? defaultProfile): string {
  const p = { ...defaultProfile, ...profile };
  const dateStr = formatDate(sale.createdAt);

  const lines = [
    `*${p.name}*`,
    `Recibo: *${sale.receiptNumber}*`,
    `Data: ${dateStr}`,
    `----------------------------`,
    ...sale.items.map((item) => `• ${item.quantity}x ${item.description} - ${formatMoney(item.total)}`),
    `----------------------------`,
    `*TOTAL: ${formatMoney(sale.total)}*`,
    `Pago via: ${sale.payments.map((pay) => translatePaymentMethod(pay.method)).join(", ")}`,
    ``,
    `${p.footerText}`
  ];

  return lines.join("\n");
}

export function printThermalReceipt(sale: Sale, profile?: BusinessProfile): void {
  const popup = window.open("", "_blank", "width=420,height=700");
  if (!popup) return;
  popup.document.write(buildThermalReceiptHtml(sale, profile));
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    popup.print();
  }, 250);
}

export function buildPdfBlob(sale: Sale, format: ReceiptFormat = "80mm", profile?: BusinessProfile): Blob {
  profile = profile ?? sale.businessProfile ?? defaultProfile;
  const plainSummary = [
    `${profile?.name || "PJ&LJ Salão Unissex"}`,
    profile.nuit ? `NUIT: ${profile.nuit}` : "",
    profile.address ?? "",
    profile.phone ? `Tel: ${profile.phone}` : "",
    `Recibo: ${sale.receiptNumber}`,
    `Data: ${formatDate(sale.createdAt)}`,
    `Cliente: ${sale.client ? `${sale.client.firstName} ${sale.client.lastName || ""}` : "Consumidor Final"}`,
    `========================================`,
    ...sale.items.map((item) => `${item.quantity}x ${item.description} - ${formatMoney(item.total)}`),
    `========================================`,
    `Subtotal: ${formatMoney(sale.subtotal ?? sale.total)}`,
    Number(sale.discount || 0) > 0 ? `Desconto: -${formatMoney(sale.discount || 0)}` : "",
    `TOTAL: ${formatMoney(sale.total)}`,
    `Pago (${sale.payments.map((p) => translatePaymentMethod(p.method)).join(", ")}): ${formatMoney(sale.paidAmount)}`,
    `Troco: ${formatMoney(sale.changeAmount)}`,
    `========================================`,
    `${profile?.footerText || "Obrigado pela preferencia!"}`
  ].filter(Boolean);

  const pdfString = generateValidPdf(plainSummary, format);
  return new Blob([pdfString], { type: "application/pdf" });
}

function generateValidPdf(lines: string[], format: ReceiptFormat): Uint8Array<ArrayBuffer> {
  const thermal = format === "80mm";
  const width = thermal ? 227 : 595;
  const maxChars = thermal ? 34 : 85;
  const wrapped = lines.flatMap(line => {
    const parts: string[] = [];
    let rest = line;
    while (rest.length > maxChars) {let cut = rest.lastIndexOf(" ", maxChars); if (cut < 1) cut = maxChars; parts.push(rest.slice(0, cut)); rest = rest.slice(cut).trimStart();}
    parts.push(rest); return parts;
  });
  const perPage = thermal ? 90 : 46;
  const chunks = Array.from({length: Math.ceil(wrapped.length / perPage)}, (_,i)=>wrapped.slice(i*perPage,(i+1)*perPage));
  const objects: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
  const pageIds: number[] = [];
  for (const chunk of chunks) {
    const height = thermal ? Math.max(180, chunk.length * 13 + 48) : 842;
    const pageId = objects.length + 1; pageIds.push(pageId);
    const stream = ["BT", thermal ? "/F1 9 Tf" : "/F1 11 Tf", "20 " + (height-30) + " Td", thermal ? "13 TL" : "16 TL", ...chunk.map(line=>"("+escapePdfString(toLatin1(line))+") Tj T*"), "ET"].join("\n");
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + width + " " + height + "] /Resources << /Font << /F1 3 0 R >> >> /Contents " + (pageId+1) + " 0 R >>");
    objects.push("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
  }
  objects[1] = "<< /Type /Pages /Kids [" + pageIds.map(id=>id+" 0 R").join(" ") + "] /Count " + pageIds.length + " >>";
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj,idx)=>{offsets.push(pdf.length); pdf += (idx+1) + " 0 obj\n" + obj + "\nendobj\n";});
  const xref = pdf.length;
  pdf += "xref\n0 " + (objects.length+1) + "\n0000000000 65535 f \n";
  offsets.slice(1).forEach(off=>{pdf += String(off).padStart(10,"0") + " 00000 n \n";});
  pdf += "trailer\n<< /Size " + (objects.length+1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return Uint8Array.from(pdf, c=>c.charCodeAt(0));
}

function translatePaymentMethod(method: string): string {
  const dict: Record<string, string> = {
    CASH: "Numerário",
    MPESA: "M-Pesa",
    EMOLA: "e-Mola",
    CARD: "Cartão / POS",
    BANK_TRANSFER: "Transferência",
    LOYALTY_POINTS: "Pontos de fidelidade",
    OTHER: "Outro"
  };
  return dict[method] || method;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toLatin1(str: string): string {
  return str.replace(/[^\x20-\x7E\xA0-\xFF]/g, "-");
}
