import Handlebars from 'handlebars';

export const INVOICE_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    padding: 40px;
    color: #0f172a;
    background-color: #ffffff;
    line-height: 1.5;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 3px solid #0f172a;
    padding-bottom: 20px;
  }
  .brand {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .brand img.logo {
    max-height: 64px;
    max-width: 140px;
    object-fit: contain;
  }
  .brand-text h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #0f172a;
  }
  .brand-text .subtext {
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
  }
  .meta {
    text-align: right;
    font-size: 12px;
  }
  .meta .serial {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.5px;
  }
  .meta .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background-color: #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .client-block {
    margin-top: 28px;
    display: flex;
    justify-content: space-between;
    background-color: #f8fafc;
    padding: 16px 20px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
  .client-block div {
    font-size: 12px;
  }
  .client-block strong {
    color: #0f172a;
    font-size: 13px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 32px;
  }
  th {
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 12px 10px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  th:last-child, td:last-child {
    text-align: right;
  }
  td {
    padding: 12px 10px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 12px;
    color: #334155;
  }
  tr:nth-child(even) {
    background-color: #f8fafc;
  }
  .totals-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
  }
  .totals {
    width: 300px;
    text-align: right;
    font-size: 13px;
    border-top: 2px solid #e2e8f0;
    padding-top: 12px;
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
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    border-top: 2px solid #0f172a;
    margin-top: 8px;
    padding-top: 8px;
  }
  .footer {
    margin-top: 60px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  }
  .seal-container {
    text-align: center;
  }
  .seal {
    max-height: 90px;
    opacity: 0.92;
    object-fit: contain;
  }
  .seal-disclaimer {
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
    width: 200px;
    margin-bottom: 8px;
    padding-top: 8px;
  }
  .signatory .ceo-title {
    font-size: 11px;
    color: #64748b;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      {{#if logoUrl}}
      <img class="logo" src="{{logoUrl}}" alt="Logo" />
      {{/if}}
      <div class="brand-text">
        <h1>{{companyName}}</h1>
        {{#if companyAddress}}
        <div class="subtext">{{companyAddress}}</div>
        {{/if}}
        {{#if companyNtn}}
        <div class="subtext">NTN: {{companyNtn}}</div>
        {{/if}}
      </div>
    </div>
    <div class="meta">
      <div class="serial">{{serial}}</div>
      <div>Date: {{issueDate}}</div>
      <div class="badge">{{category}}</div>
    </div>
  </div>

  <div class="client-block">
    <div>
      <div>Billed To:</div>
      <strong>{{clientName}}</strong>
      {{#if clientLocation}}
      <div>{{clientLocation}}</div>
      {{/if}}
    </div>
    <div style="text-align: right;">
      <div>Project:</div>
      <strong>{{projectName}}</strong>
      <div>{{projectType}} | {{projectArea}} {{projectUnit}}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Description</th>
        <th style="width: 80px;">Category</th>
        <th style="width: 60px; text-align: center;">Qty</th>
        <th style="width: 100px; text-align: right;">Rate (PKR)</th>
        <th style="width: 110px;">Amount (PKR)</th>
      </tr>
    </thead>
    <tbody>
      {{#each lineItems}}
      <tr>
        <td>{{inc @index}}</td>
        <td>{{desc}}</td>
        <td>{{category}}</td>
        <td style="text-align: center;">{{qty}}</td>
        <td style="text-align: right;">{{formatRate rate}}</td>
        <td>{{formatRate amount}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals-container">
    <div class="totals">
      <div class="row">
        <span>Subtotal</span>
        <span>PKR {{formatRate subtotal}}</span>
      </div>
      <div class="row">
        <span>Tax ({{taxRate}}%)</span>
        <span>PKR {{formatRate tax}}</span>
      </div>
      <div class="grand">
        <span>Total</span>
        <span>PKR {{formatRate total}}</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="seal-container">
      {{#if sealUrl}}
      <img class="seal" src="{{sealUrl}}" alt="Seal" />
      {{/if}}
      <div class="seal-disclaimer">
        * This seal is a company visual mark, not a certified digital signature.
      </div>
    </div>
    <div class="signatory">
      <div class="line"></div>
      <strong>{{ceoName}}</strong>
      <div class="ceo-title">Chief Executive Officer</div>
    </div>
  </div>
</body>
</html>`;

Handlebars.registerHelper('inc', function(value) {
  return parseInt(value) + 1;
});

Handlebars.registerHelper('formatRate', function(val) {
  if (typeof val !== 'number') return val;
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

export function renderInvoiceHtml(data: {
  logoUrl?: string | null;
  sealUrl?: string | null;
  companyName: string;
  companyAddress?: string;
  companyNtn?: string;
  ceoName: string;
  serial: string;
  issueDate: string;
  category: string;
  clientName: string;
  clientLocation?: string;
  projectName: string;
  projectType: string;
  projectArea: number;
  projectUnit: string;
  lineItems: Array<{
    desc: string;
    category: string;
    qty: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
}): string {
  const template = Handlebars.compile(INVOICE_HTML_TEMPLATE);
  return template(data);
}
