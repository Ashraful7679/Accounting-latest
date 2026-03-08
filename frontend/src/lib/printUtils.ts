/**
 * Shared print utility for all financial documents.
 * Generates a consistent company header and document wrapper for print views.
 */

export interface CompanyInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  website?: string;
  registrationNumber?: string;
}

/**
 * Returns the HTML string for a company letterhead header.
 */
export function companyHeader(company: CompanyInfo): string {
  return `
    <div style="display:flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e293b; padding-bottom: 20px; margin-bottom: 32px;">
      <div>
        <h2 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0;">${company.name}</h2>
        ${company.address ? `<p style="font-size: 12px; color: #64748b; margin: 2px 0;">${company.address}</p>` : ''}
        ${company.phone ? `<p style="font-size: 12px; color: #64748b; margin: 2px 0;">📞 ${company.phone}</p>` : ''}
        ${company.email ? `<p style="font-size: 12px; color: #64748b; margin: 2px 0;">✉ ${company.email}</p>` : ''}
        ${company.website ? `<p style="font-size: 12px; color: #64748b; margin: 2px 0;">🌐 ${company.website}</p>` : ''}
      </div>
      <div style="text-align: right;">
        ${company.taxId ? `<p style="font-size: 11px; color: #94a3b8; margin: 2px 0;"><strong>TIN/Tax ID:</strong> ${company.taxId}</p>` : ''}
        ${company.registrationNumber ? `<p style="font-size: 11px; color: #94a3b8; margin: 2px 0;"><strong>Reg No:</strong> ${company.registrationNumber}</p>` : ''}
      </div>
    </div>
  `;
}

/**
 * Returns the shared CSS styles used in all print views.
 */
export function printStyles(): string {
  return `
    <style>
      @page { margin: 1.5cm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 40px; font-size: 13px; line-height: 1.5; }
      h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin: 0 0 4px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th { background: #f8fafc; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e2e8f0; }
      td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
      .meta-field label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; display: block; margin-bottom: 3px; }
      .meta-field span { font-weight: 600; color: #1e293b; }
      .totals { text-align: right; margin-top: 24px; }
      .totals p { margin: 4px 0; font-size: 13px; }
      .totals .grand-total { font-size: 18px; font-weight: 900; color: #0f172a; border-top: 2px solid #1e293b; padding-top: 8px; margin-top: 8px; }
      .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; background: #ecfdf5; color: #059669; }
      footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    </style>
  `;
}

/**
 * Wraps document HTML in a full print page with company header and footer.
 */
export function buildPrintDocument(opts: {
  title: string;
  company: CompanyInfo;
  body: string;
}): string {
  return `
    <html>
      <head>
        <title>${opts.title}</title>
        ${printStyles()}
      </head>
      <body>
        ${companyHeader(opts.company)}
        ${opts.body}
        <footer>
          <span>${opts.company.name}</span>
          <span>Printed on ${new Date().toLocaleString()}</span>
        </footer>
      </body>
    </html>
  `;
}

/**
 * Opens a new window with the given HTML and triggers print.
 */
export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.print();
}
