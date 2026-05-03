export function getCurrencySymbol(currency: string = 'BDT'): string {
  switch (currency.toUpperCase()) {
    case 'BDT': return '\u09F3'; // ৳
    case 'USD': return '$';
    default: return currency;
  }
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(num: number | string, decimals: number = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0'.repeat(decimals).replace('0', '.0');
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRate: number): number {
  if (fromCurrency === toCurrency) return Number(amount.toFixed(2));
  
  // Convert to BDT first (Base)
  const amountInBDT = fromCurrency === 'USD' ? amount * exchangeRate : amount;
  
  // Convert from BDT to target
  const result = toCurrency === 'USD' ? amountInBDT / exchangeRate : amountInBDT;
  return Number(result.toFixed(2));
}
