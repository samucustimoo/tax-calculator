import { useEffect, useMemo, useState } from 'react'
import bundledRates from './rates.json'
import { calcSalesTax, calcImport, fmt, belowDeMinimis } from './calc.js'

const LS_RATES = 'taxcalc_rates_v1'
const LS_URL = 'taxcalc_update_url'
const DUTY_KEY = { 'United Kingdom': 'uk', 'United States': 'us', 'Canada': 'ca', 'Australia': 'au', 'China': 'cn' }

function findScheme(schemes, country) {
  return (schemes || []).find(s => {
    if (s.appliesTo === 'eu') return !!country.eu
    if (Array.isArray(s.appliesTo)) return s.appliesTo.includes(country.name)
    return s.appliesTo === country.name
  })
}

function baseDutyFor(hs, country) {
  if (country.eu) return hs.duty.eu
  const key = DUTY_KEY[country.name]
  return (key && hs.duty[key] != null) ? hs.duty[key] : hs.duty.default
}

function loadRates() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_RATES))
    if (saved && saved.version && saved.version > bundledRates.version) return saved
  } catch { }
  return bundledRates
}

function EstimateBadge({ children = 'Estimate' }) {
  return <span className="badge badge-amber">{children}</span>
}

export default function App() {
  const [rates, setRates] = useState(loadRates)
  const [tab] = useState('import')
  const [countryName, setCountryName] = useState('United Kingdom')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('excl')
  const [rateChoice, setRateChoice] = useState('standard')
  const [customRate, setCustomRate] = useState('')
  const [shipping, setShipping] = useState('')
  const [weight, setWeight] = useState('')
  const [boxL, setBoxL] = useState('')
  const [boxW, setBoxW] = useState('')
  const [boxH, setBoxH] = useState('')
  const [boxes, setBoxes] = useState('1')
  const [ratePerKg, setRatePerKg] = useState('11')
  const [hsCode, setHsCode] = useState('6109.90')
  const [applyScheme, setApplyScheme] = useState(true)
  const [customDuty, setCustomDuty] = useState('')
  const [courierOn, setCourierOn] = useState(true)
  const [courierPct, setCourierPct] = useState('2.5')
  const [courierMin, setCourierMin] = useState('15')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [showSources, setShowSources] = useState(false)
  const [updateUrl, setUpdateUrl] = useState(() => localStorage.getItem(LS_URL) || import.meta.env.VITE_RATES_URL || '')

  const country = useMemo(
    () => rates.countries.find(c => c.name === countryName) || rates.countries[0],
    [rates, countryName]
  )
  const hs = (rates.hsCodes || []).find(h => h.code === hsCode) || (rates.hsCodes || [])[0]
  const scheme = findScheme(rates.schemes, country)

  const usesCustomRate = customRate !== '' && !isNaN(parseFloat(customRate))
  const activeRate = usesCustomRate
    ? parseFloat(customRate)
    : rateChoice === 'standard'
      ? country.standardRate
      : parseFloat(rateChoice)

  const amt = parseFloat(amount) || 0
  const grossKg = parseFloat(weight) || 0
  const nBoxes = Math.max(1, parseInt(boxes) || 1)
  const dimL = parseFloat(boxL) || 0
  const dimW = parseFloat(boxW) || 0
  const dimH = parseFloat(boxH) || 0
  const volKg = (dimL * dimW * dimH / 5000) * nBoxes
  const kg = Math.max(grossKg, volKg)
  const usesVol = volKg > grossKg && volKg > 0
  const kgRate = parseFloat(ratePerKg) || 0
  const freight = kg * kgRate
  const ship = shipping !== '' && !isNaN(parseFloat(shipping)) ? parseFloat(shipping) : freight
  const sales = calcSalesTax(amt, activeRate, mode)

  const baseDuty = hs ? baseDutyFor(hs, country) : 0
  const prefApplied = !!(scheme && scheme.prefDuty === 0 && applyScheme)
  let autoDuty = prefApplied ? 0 : baseDuty
  if (scheme && scheme.surcharge) autoDuty = baseDuty + scheme.surcharge
  const dutyRate = customDuty !== '' && !isNaN(parseFloat(customDuty)) ? parseFloat(customDuty) : autoDuty
  const imp = calcImport({ goodsValue: amt, shipping: ship, dutyRatePct: dutyRate, vatRatePct: country.standardRate, valuation: country.valuation || 'cif' })
  const dutyFree = belowDeMinimis(country, imp.customsValue)
  const cPct = parseFloat(courierPct) || 0
  const cMin = parseFloat(courierMin) || 0
  const courierFee = courierOn && imp.totalCharges > 0 ? Math.max(imp.totalCharges * cPct / 100, cMin) : 0
  const grandTotal = imp.landedCost + courierFee

  async function checkForUpdates(url) {
    const target = (url || updateUrl || '').trim()
    if (!target) { setUpdateStatus({ ok: false, msg: 'Set a rates URL first (see README - host rates.json on GitHub/Gist).' }); return }
    if (!navigator.onLine) { setUpdateStatus({ ok: false, msg: 'You are offline - using stored rates.' }); return }
    setUpdateStatus({ ok: true, msg: 'Checking...' })
    try {
      const res = await fetch(target, { cache: 'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (!data.version || !Array.isArray(data.countries)) throw new Error('Not a valid rates file')
      if (data.version > rates.version) {
        localStorage.setItem(LS_RATES, JSON.stringify(data))
        setRates(data)
        setUpdateStatus({ ok: true, msg: 'Updated to rates version ' + data.version + '.' })
      } else {
        setUpdateStatus({ ok: true, msg: 'Already up to date (version ' + rates.version + ').' })
      }
      localStorage.setItem(LS_URL, target)
    } catch (e) {
      setUpdateStatus({ ok: false, msg: 'Update failed: ' + e.message + '. Using stored rates.' })
    }
  }

  useEffect(() => {
    if (updateUrl && navigator.onLine) checkForUpdates(updateUrl)
  }, [])

  const regions = [...new Set(rates.countries.map(c => c.region))]

  return (
    <div className="app">
      <header>
        <h1>Global tax &amp; duty calculator</h1>
        <p className="sub">Import duty + tax estimator for shipments from Pakistan - all values in USD</p>
      </header>

      <div className="controls">
        <label className="field">
          <span>Destination country</span>
          <select value={countryName} onChange={e => setCountryName(e.target.value)}>
            {regions.map(r => (
              <optgroup key={r} label={r}>
                {rates.countries.filter(c => c.region === r).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Value (USD)</span>
          <input type="number" min="0" step="0.01" placeholder="e.g. 1000" value={amount}
            onChange={e => setAmount(e.target.value)} />
        </label>
      </div>


      {tab === 'import' && (
        <section className="card">
          <div className="rate-line">
            Shipping from <strong>Pakistan</strong> into <strong>{country.name}</strong>
            <EstimateBadge>Estimate - confirm exact HS line before quoting</EstimateBadge>
          </div>

          <div className="controls">
            <label className="field" style={{ flex: '2 1 320px' }}>
              <span>Item (HS code)</span>
              <select value={hsCode} onChange={e => setHsCode(e.target.value)}>
                {(rates.hsCodes || []).map(h => (
                  <option key={h.code} value={h.code}>{h.code === 'OTHER' ? h.desc : h.code + ' - ' + h.desc}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Gross weight (kg)</span>
              <input type="number" min="0" step="0.1" placeholder="e.g. 25" value={weight}
                onChange={e => setWeight(e.target.value)} />
            </label>
            <label className="field" style={{ flex: '1.5 1 240px' }}>
              <span>Box dimensions L x W x H (cm, per box)</span>
              <span style={{ display: 'flex', gap: '6px' }}>
                <input type="number" min="0" placeholder="L" value={boxL} onChange={e => setBoxL(e.target.value)} style={{ width: '33%' }} />
                <input type="number" min="0" placeholder="W" value={boxW} onChange={e => setBoxW(e.target.value)} style={{ width: '33%' }} />
                <input type="number" min="0" placeholder="H" value={boxH} onChange={e => setBoxH(e.target.value)} style={{ width: '33%' }} />
              </span>
            </label>
            <label className="field" style={{ flex: '0 1 110px' }}>
              <span>Boxes</span>
              <input type="number" min="1" step="1" value={boxes} onChange={e => setBoxes(e.target.value)} />
            </label>
            <label className="field">
              <span>Freight rate (USD per kg)</span>
              <input type="number" min="0" step="0.5" value={ratePerKg}
                onChange={e => setRatePerKg(e.target.value)} />
            </label>
            <label className="field">
              <span>Shipping cost override (USD, optional)</span>
              <input type="number" min="0" step="0.01" placeholder={kg > 0 ? 'auto ' + freight.toFixed(2) : 'auto from weight'} value={shipping}
                onChange={e => setShipping(e.target.value)} />
            </label>
            <label className="field">
              <span>Custom duty % (optional)</span>
              <input type="number" min="0" step="0.01" placeholder={'auto ' + autoDuty + '%'}
                value={customDuty} onChange={e => setCustomDuty(e.target.value)} />
            </label>
          </div>

          {(grossKg > 0 || volKg > 0) && (
            <p className={'note' + (usesVol ? '' : ' ok')}>
              Chargeable weight: <strong>{kg.toFixed(1)} kg</strong> - {usesVol
                ? 'DIMENSIONAL weight applies (' + dimL + ' x ' + dimW + ' x ' + dimH + ' / 5000 x ' + nBoxes + ' box' + (nBoxes > 1 ? 'es' : '') + ' = ' + volKg.toFixed(1) + ' kg > gross ' + grossKg.toFixed(1) + ' kg)'
                : 'gross weight applies (' + grossKg.toFixed(1) + ' kg' + (volKg > 0 ? ' > dimensional ' + volKg.toFixed(1) + ' kg' : '') + ')'}
            </p>
          )}

          {scheme && (
            <div className={'scheme ' + (scheme.prefDuty === 0 ? 'scheme-good' : scheme.surcharge ? 'scheme-bad' : 'scheme-check')}>
              <div className="scheme-head">
                <strong>{scheme.name}</strong>
                {scheme.prefDuty === 0 && <span className="badge badge-green">0% duty available</span>}
                {scheme.surcharge != null && <span className="badge badge-red">+{scheme.surcharge}% surcharge</span>}
                {scheme.prefDuty === null && !scheme.surcharge && <span className="badge badge-amber">Verify per HS line</span>}
              </div>
              <p>{scheme.status}</p>
              {scheme.requires && <p><em>Needed: {scheme.requires}</em></p>}
              {scheme.prefDuty === 0 && (
                <label className="checkline">
                  <input type="checkbox" checked={applyScheme} onChange={e => setApplyScheme(e.target.checked)} />
                  Apply preference - I can provide the proof of origin (otherwise MFN {baseDuty}% applies)
                </label>
              )}
            </div>
          )}

          {country.deMinimis && (
            <p className={dutyFree ? 'note ok' : 'note'}>
              De minimis - {country.deMinimis.note}.
              {dutyFree && ' Your value is under the threshold: duty may not apply.'}
            </p>
          )}

          <div className="results">
            {ship > 0 && (
              <div className="row">
                <span>Freight{shipping === '' && kg > 0 ? ' (' + kg.toFixed(1) + ' kg chargeable x ' + fmt(kgRate) + '/kg)' : ' (manual)'}</span>
                <span>{fmt(ship)}</span>
              </div>
            )}
            <div className="row">
              <span>Customs value {country.valuation === 'cif' ? '(goods + freight - CIF basis)' : '(goods only - FOB basis, freight not dutiable)'}</span>
              <span>{fmt(imp.customsValue)}</span>
            </div>
            <div className="row highlight">
              <span>
                Duty @ {dutyRate}%
                {customDuty !== '' ? ' (manual)' : prefApplied ? ' (' + scheme.name + ')' : scheme && scheme.surcharge ? ' (MFN ' + baseDuty + '% + ' + scheme.surcharge + '%)' : ' (estimate)'}
              </span>
              <span>{fmt(imp.duty)}</span>
            </div>
            <div className="row highlight">
              <span>Import {country.taxName === 'None' ? 'tax' : country.taxName} @ {country.standardRate}% on {country.valuation === 'fob' ? 'goods + duty' : 'goods + freight + duty'}</span>
              <span>{fmt(imp.importVat)}</span>
            </div>
            <div className="row"><span>Total government charges</span><span>{fmt(imp.totalCharges)}</span></div>
            {courierOn && (
              <div className="row highlight">
                <span>Courier clearance fee ({cPct}% of duty+tax, min {fmt(cMin)})</span>
                <span>{fmt(courierFee)}</span>
              </div>
            )}
            <div className="row total"><span>Estimated total landed cost</span><span>{fmt(grandTotal)}</span></div>
          </div>
          <div className="courier-bar">
            <label className="checkline">
              <input type="checkbox" checked={courierOn} onChange={e => setCourierOn(e.target.checked)} />
              Include courier clearance fee (DHL/FedEx disbursement / advance-payment fee)
            </label>
            {courierOn && (
              <span className="courier-inputs">
                <input type="number" min="0" step="0.1" value={courierPct} onChange={e => setCourierPct(e.target.value)} /> %
                &nbsp;min $
                <input type="number" min="0" step="1" value={courierMin} onChange={e => setCourierMin(e.target.value)} />
              </span>
            )}
          </div>
          <p className="note" style={{ marginTop: '12px' }}>
            Important: customs duty is always charged on the value ASSESSED by the destination customs office - not
            automatically on your declared invoice value. If customs considers the declared value too low, they can
            reassess it (using prices of similar goods, reference databases or minimum values) and charge duty and
            import tax on that higher assessed value. Keep invoices, payment proof and packing lists consistent to
            defend your declared value.
          </p>
          <p className="disclaimer">
            The courier fee is the carrier's typical charge for paying duty/tax on the receiver's behalf - check your carrier's tariff (DHL, FedEx and national posts differ). Estimates only. Actual charges depend on the exact HS code, rules of origin compliance, trade agreement status,
            carrier brokerage fees and current surcharges. Confirm with the destination customs authority or your carrier
            (DHL/FedEx duty calculators) before quoting customers.
          </p>
        </section>
      )}

      <footer>
        <div className="update-bar">
          <span>Rates version <strong>{rates.version}</strong> - last verified {rates.lastVerified}</span>
          <input type="url" placeholder="https://.../rates.json (update source)" value={updateUrl}
            onChange={e => setUpdateUrl(e.target.value)} />
          <button onClick={() => checkForUpdates()}>Check for updates</button>
          <button className="link" onClick={() => setShowSources(s => !s)}>
            {showSources ? 'Hide sources' : 'Data sources'}
          </button>
        </div>
        {updateStatus && <p className={updateStatus.ok ? 'note ok' : 'note warn'}>{updateStatus.msg}</p>}
        {showSources && (
          <ul className="sources">
            {rates.sources.map(s => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  )
}
