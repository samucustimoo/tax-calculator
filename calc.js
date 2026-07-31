// Pure calculation functions — kept separate so they can be unit-tested.

// Sales tax / VAT on a value.
// mode: 'excl' = amount is before tax (add tax), 'incl' = amount already includes tax (extract it)
export function calcSalesTax(amount, ratePct, mode) {
  const r = ratePct / 100
  if (!(amount > 0)) return { net: 0, tax: 0, gross: 0 }
  if (mode === 'incl') {
    const net = amount / (1 + r)
    return { net, tax: amount - net, gross: amount }
  }
  const tax = amount * r
  return { net: amount, tax, gross: amount + tax }
}

// Import estimate: duty on customs value (goods + shipping if provided),
// then import VAT/GST on (customs value + duty) — the standard method in most countries.
export function calcImport({ goodsValue, shipping = 0, dutyRatePct, vatRatePct, valuation = 'cif' }) {
  const goods = goodsValue || 0
  const cif = goods + (shipping || 0)
  const customsValue = valuation === 'cif' ? cif : goods
  const duty = customsValue * (dutyRatePct / 100)
  const vatBase = (valuation === 'fob' ? customsValue : cif) + duty
  const importVat = vatBase * (vatRatePct / 100)
  return {
    customsValue,
    duty,
    vatBase,
    importVat,
    totalCharges: duty + importVat,
    landedCost: cif + duty + importVat,
  }
}

export function fmt(n) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function belowDeMinimis(country, customsValue) {
  const dm = country.deMinimis
  if (!dm || !(dm.amount > 0)) return false
  return customsValue <= dm.amount
}
