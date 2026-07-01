/**
 * Flat listings page (no-broker) — the "Browse flats" entry. Renders scraped
 * flatmate-group posts as clean, comparable cards sorted newest-first: photos +
 * video, rent / BHK / locality / gender chips, the post text, and the poster's
 * phone shown OPENLY with a one-tap Call button (tel:) + a link to the source post.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useStore } from '../store'
import { loadListings, type FlatListing, type ListingsDoc } from '../data/listings'

const BHK_OPTIONS = ['1RK', '1BHK', '2BHK', '3BHK']

export function Listings() {
  const setStage = useStore((s) => s.setStage)
  const [doc, setDoc] = useState<ListingsDoc | null>(null)
  const [q, setQ] = useState('')
  const [bhk, setBhk] = useState<string | null>(null)
  const [gender, setGender] = useState<string | null>(null)
  const [photosOnly, setPhotosOnly] = useState(false)
  const [sort, setSort] = useState<'new' | 'rentLow' | 'rentHigh'>('new')

  useEffect(() => {
    let live = true
    loadListings().then((d) => { if (live) setDoc(d) })
    return () => { live = false }
  }, [])

  const rows = useMemo(() => {
    let list = doc?.listings ?? []
    const needle = q.trim().toLowerCase()
    if (needle) list = list.filter((l) => (l.text + ' ' + (l.location ?? '')).toLowerCase().includes(needle))
    if (bhk) list = list.filter((l) => l.bhk === bhk)
    if (gender) list = list.filter((l) => l.gender === gender)
    if (photosOnly) list = list.filter((l) => l.hasImages || l.hasVideo)
    const sorted = [...list]
    if (sort === 'rentLow') sorted.sort((a, b) => (a.rent ?? Infinity) - (b.rent ?? Infinity))
    else if (sort === 'rentHigh') sorted.sort((a, b) => (b.rent ?? -1) - (a.rent ?? -1))
    else sorted.sort((a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9)) // newest first
    return sorted
  }, [doc, q, bhk, gender, photosOnly, sort])

  const updated = doc ? new Date(doc.scrapedAt) : null

  return (
    <div className="listings">
      <header className="listings-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStage('start')} title="Back to home">⌂ Home</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>🏠 Flats near you</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>
              Direct from flatmate groups · no broker{doc ? ` · ${doc.count} listings` : ''}
              {updated ? ` · updated ${timeAgo(updated)}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="listings-search" placeholder="Search area, e.g. Andheri, Powai…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={bhk ?? ''} onChange={(v) => setBhk(v || null)} options={[['', 'Any BHK'], ...BHK_OPTIONS.map((b) => [b, b] as [string, string])]} />
          <Select value={gender ?? ''} onChange={(v) => setGender(v || null)} options={[['', 'Any gender'], ['female', 'Female'], ['male', 'Male']]} />
          <Select value={sort} onChange={(v) => setSort(v as typeof sort)} options={[['new', 'Newest'], ['rentLow', 'Rent ↑'], ['rentHigh', 'Rent ↓']]} />
          <label style={{ ...chipStyle, cursor: 'pointer', gap: 6 }}>
            <input type="checkbox" checked={photosOnly} onChange={(e) => setPhotosOnly(e.target.checked)} /> Photos
          </label>
        </div>
      </header>

      {!doc ? (
        <div style={emptyStyle}>Loading listings…</div>
      ) : rows.length === 0 ? (
        <div style={emptyStyle}>No listings match your filters.</div>
      ) : (
        <div className="listings-grid">
          {rows.map((l) => <ListingCard key={l.id} l={l} />)}
        </div>
      )}
    </div>
  )
}

function ListingCard({ l }: { l: FlatListing }) {
  const [i, setI] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const media = l.images
  const hasMedia = media.length > 0 || l.hasVideo
  const poster = media[i] || l.video?.thumb || null

  return (
    <article className="listing-card">
      <div className="listing-media" onClick={() => media.length > 1 && setI((i + 1) % media.length)} style={{ cursor: media.length > 1 ? 'pointer' : 'default' }}>
        {poster ? (
          <img src={poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="listing-media-empty">🏢</div>
        )}
        {media.length > 1 && <span className="listing-badge" style={{ right: 10 }}>{i + 1}/{media.length}</span>}
        {l.hasVideo && (
          <a className="listing-badge listing-video" style={{ left: 10 }} href={l.permalink ?? undefined} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>▶ Video</a>
        )}
      </div>

      <div className="listing-body">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          {l.rent != null && <span style={{ ...chipStyle, background: '#111', color: '#fff', fontWeight: 800 }}>₹{l.rent.toLocaleString('en-IN')}/mo</span>}
          {l.bhk && <span style={chipStyle}>{l.bhk}</span>}
          {l.location && <span style={chipStyle}>📍 {l.location}</span>}
          {l.gender && <span style={chipStyle}>{l.gender === 'female' ? '♀ Female' : '♂ Male'}</span>}
          {l.occupancy && <span style={chipStyle}>{cap(l.occupancy)} occ.</span>}
          {!hasMedia && <span style={{ ...chipStyle, color: 'var(--ink-3)' }}>No photos</span>}
        </div>

        <p className={expanded ? '' : 'listing-clamp'} style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{l.text}</p>
        {l.text.length > 160 && (
          <button className="listing-link" onClick={() => setExpanded((v) => !v)}>{expanded ? 'See less' : 'See more'}</button>
        )}

        <div className="listing-foot">
          <span style={{ color: 'var(--ink-3)', fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.author ? l.author : 'Posted'}{l.postedAbs ? ` · ${l.postedAbs}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>
            {l.permalink && <a className="listing-link" href={l.permalink} target="_blank" rel="noreferrer">View post ↗</a>}
            {l.phones[0] && (
              <a className="listing-call" href={`tel:+91${l.phones[0]}`} title={l.phones.map((p) => '+91 ' + p).join(', ')}>
                📞 Call {fmtPhone(l.phones[0])}
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select className="listings-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  )
}

const chipStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3b70022', border: '1px solid #e6e3dd',
  borderRadius: 999, padding: '3px 9px', fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap',
}
const emptyStyle: CSSProperties = { padding: '60px 20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 15 }

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function fmtPhone(p: string) { return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p }
function timeAgo(d: Date) {
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}
