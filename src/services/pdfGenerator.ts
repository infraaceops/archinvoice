import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { InvoiceDoc, ProjectDoc, TenantDoc } from '../types';
import { formatDate } from '../util/dates';

export function buildInvoiceHtml(invoice: InvoiceDoc, tenant: TenantDoc, project?: ProjectDoc): string {
  const lineItemsRows = invoice.lineItems
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">
          <strong>${item.desc}</strong>
          ${item.pricingMode === 'per_sqft' ? '<div style="font-size: 10px; color: #64748b;">(Calculated @ Area Rate)</div>' : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; text-transform: capitalize;">${item.category}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; text-align: center;">${item.qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; text-align: right;">${item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #0f172a; text-align: right; font-weight: 600;">${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${invoice.serial}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    margin: 0;
    padding: 24px;
    line-height: 1.4;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid #0f172a;
    padding-bottom: 16px;
  }
  .brand {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .brand img.logo {
    max-height: 60px;
    max-width: 140px;
    object-fit: contain;
  }
  .brand h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
  }
  .meta {
    text-align: right;
    font-size: 12px;
  }
  .meta .serial {
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.5px;
  }
  .meta .category-badge {
    display: inline-block;
    padding: 3px 8px;
    background: #e2e8f0;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .info-grid {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 12px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 24px;
  }
  th {
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 10px;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
  }
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
  .totals {
    width: 280px;
    font-size: 13px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    color: #475569;
  }
  .totals .grand {
    display: flex;
    justify-content: space-between;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
    border-top: 2px solid #0f172a;
    padding-top: 8px;
    margin-top: 6px;
  }
  .footer {
    margin-top: 50px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #e2e8f0;
    padding-top: 20px;
  }
  .seal-box {
    text-align: center;
  }
  .seal {
    max-height: 85px;
    opacity: 0.92;
  }
  .disclaimer {
    font-size: 9px;
    color: #94a3b8;
    margin-top: 4px;
    max-width: 220px;
  }
  .signatory {
    text-align: center;
    font-size: 12px;
  }
  .signatory .line {
    border-top: 1.5px solid #0f172a;
    width: 180px;
    margin-bottom: 6px;
    padding-top: 6px;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      ${tenant.logoUrl ? `<img class="logo" src="${tenant.logoUrl}" alt="Logo" />` : ''}
      <div>
        <h1>${tenant.name}</h1>
        ${tenant.address ? `<div style="font-size: 11px; color: #64748b;">${tenant.address}</div>` : ''}
        ${tenant.ntn ? `<div style="font-size: 11px; color: #64748b;">NTN: ${tenant.ntn}</div>` : ''}
      </div>
    </div>
    <div class="meta">
      <div class="serial">${invoice.serial}</div>
      <div>Date: ${formatDate(invoice.issuedAt || invoice.createdAt)}</div>
      <div class="category-badge">${invoice.category}</div>
    </div>
  </div>

  <div class="info-grid">
    <div>
      <div style="color: #64748b; margin-bottom: 2px;">BILL TO:</div>
      <strong style="font-size: 14px; color: #0f172a;">${invoice.clientName}</strong>
      ${project?.location ? `<div>${project.location}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <div style="color: #64748b; margin-bottom: 2px;">PROJECT:</div>
      <strong style="font-size: 14px; color: #0f172a;">${project?.name || 'Project Work'}</strong>
      <div>Type: ${project?.type || 'commercial'} | Area: ${project?.area || 0} ${project?.unit || 'sqft'}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Description</th>
        <th style="width: 80px;">Category</th>
        <th style="width: 50px; text-align: center;">Qty</th>
        <th style="width: 100px; text-align: right;">Rate (PKR)</th>
        <th style="width: 110px; text-align: right;">Amount (PKR)</th>
      </tr>
    </thead>
    <tbody>
      ${lineItemsRows}
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      <div class="row">
        <span>Subtotal</span>
        <span>PKR ${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="row">
        <span>Tax (${invoice.taxRate || 0}%)</span>
        <span>PKR ${invoice.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="grand">
        <span>Total</span>
        <span>PKR ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="seal-box">
      ${tenant.sealUrl ? `<img class="seal" src="${tenant.sealUrl}" alt="Seal" />` : ''}
      <div class="disclaimer">* This seal is a company visual mark, not a certified digital signature.</div>
    </div>
    <div class="signatory">
      <div class="line"></div>
      <strong>${tenant.ceoName}</strong>
      <div style="font-size: 10px; color: #64748b;">Chief Executive Officer</div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateAndSharePdf(invoice: InvoiceDoc, tenant: TenantDoc, project?: ProjectDoc): Promise<string> {
  const html = buildInvoiceHtml(invoice, tenant, project);

  if (Platform.OS === 'web') {
    // On Web: Open printable window or print directly
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
    return 'web-printed';
  } else {
    // On Android & iOS: Native PDF file generation + share sheet
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice ${invoice.serial}`,
      });
    }

    return uri;
  }
}
