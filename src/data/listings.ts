/**
 * Flat listings (no-broker) — scraped from Facebook flatmate groups by
 * scripts/scrape-listings.mjs into /public/listings.json, loaded here at runtime so
 * a fresh scrape shows up without a rebuild. Falls back to a bundled synthetic
 * sample (below) so the UI always renders (dev, fresh clone, or scrape offline).
 */
import sample from './listings.sample.json'

export interface FlatVideo {
  /** poster/thumbnail image URL */
  thumb: string | null
  /** direct video URL if capturable (often null — link out via `permalink`) */
  src: string | null
}

export interface FlatListing {
  id: string
  postId: string | null
  /** original Facebook post permalink (opens the source post + its video) */
  permalink: string | null
  author: string | null
  /** full post text — shown as-is (phone numbers are NOT hidden) */
  text: string
  /** phone numbers parsed from the text, for the Call button (tel:) */
  phones: string[]
  rent: number | null
  bhk: string | null
  location: string | null
  gender: string | null
  occupancy: string | null
  images: string[]
  video: FlatVideo | null
  hasVideo: boolean
  hasImages: boolean
  /** absolute posted time if captured (e.g. "about an hour ago") */
  postedAbs: string | null
  /** feed order — smaller = more recently posted */
  seq: number
}

export interface ListingsDoc {
  group: { id: string; url: string }
  scrapedAt: string
  count: number
  listings: FlatListing[]
}

/** Load scraped listings (live /listings.json), falling back to the bundled sample. */
export async function loadListings(): Promise<ListingsDoc> {
  try {
    const res = await fetch('/listings.json', { cache: 'no-store' })
    if (res.ok) {
      const d = (await res.json()) as ListingsDoc
      if (d && Array.isArray(d.listings) && d.listings.length) return normalize(d)
    }
  } catch {
    /* offline / no scrape yet → sample */
  }
  return normalize(sample as ListingsDoc)
}

/** Newest first (by feed order), defensive against missing seq. */
function normalize(d: ListingsDoc): ListingsDoc {
  const listings = [...d.listings].sort((a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9))
  return { ...d, listings, count: listings.length }
}
