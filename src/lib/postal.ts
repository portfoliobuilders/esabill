export const PINCODE_RE = /^[1-9][0-9]{5}$/

export type PostalOffice = {
  pincode: string
  officeName: string
  officeType: string | null
  deliveryStatus: string | null
  circleName: string | null
  regionName: string | null
  divisionName: string | null
  districtName: string | null
  stateName: string | null
  talukName: string | null
}

export type PostalCommon = {
  district: string | null
  state: string | null
  region: string | null
  division: string | null
  circle: string | null
  taluk: string | null
  postOffice: string | null
}

export type PostalLookup = {
  pincode: string
  found: boolean
  offices: PostalOffice[]
  common: PostalCommon
  askPostOffice: boolean
  source: 'local' | 'fallback' | 'none'
}

export function isValidPincode(value: string): boolean {
  return PINCODE_RE.test(value.trim())
}

export function normalizeOfficeType(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (upper === 'HO' || /HEAD/.test(upper)) return 'HO'
  if (upper === 'SO' || /SUB/.test(upper)) return 'SO'
  if (upper === 'BO' || /BRANCH/.test(upper)) return 'BO'
  return raw
}

export function isPrimaryOfficeType(value: string | null | undefined): boolean {
  const type = normalizeOfficeType(value)
  return type === 'HO' || type === 'SO'
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = (value ?? '').trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function sharedValue(values: Array<string | null | undefined>): string | null {
  const unique = uniqueNonEmpty(values)
  return unique.length === 1 ? unique[0] : null
}

/** Pick a default post office only when it is unambiguous or a single SO/HO among BOs. */
export function defaultPostOffice(offices: PostalOffice[]): string | null {
  if (offices.length === 0) return null
  if (offices.length === 1) return offices[0].officeName
  const primary = offices.filter((office) => isPrimaryOfficeType(office.officeType))
  if (primary.length === 1) return primary[0].officeName
  return null
}

export function summarizePostalOffices(pincode: string, offices: PostalOffice[], source: PostalLookup['source']): PostalLookup {
  const pin = pincode.trim()
  if (offices.length === 0) {
    return {
      pincode: pin,
      found: false,
      offices: [],
      common: {
        district: null,
        state: null,
        region: null,
        division: null,
        circle: null,
        taluk: null,
        postOffice: null,
      },
      askPostOffice: false,
      source: 'none',
    }
  }

  const postOffice = defaultPostOffice(offices)
  const common: PostalCommon = {
    district: sharedValue(offices.map((office) => office.districtName)),
    state: sharedValue(offices.map((office) => office.stateName)),
    region: sharedValue(offices.map((office) => office.regionName)),
    division: sharedValue(offices.map((office) => office.divisionName)),
    circle: sharedValue(offices.map((office) => office.circleName)),
    taluk: sharedValue(offices.map((office) => office.talukName)),
    postOffice,
  }

  return {
    pincode: pin,
    found: true,
    offices,
    common,
    askPostOffice: offices.length > 1,
    source,
  }
}

export function compactLocationLine(common: PostalCommon): string {
  return [common.district, common.state].filter(Boolean).join(', ')
}

export type LocationForMail = {
  postOffice?: string
  district?: string
  state?: string
  postalRegion?: string
  taluk?: string
  division?: string
  circle?: string
}

export function locationFromLookup(
  lookup: PostalLookup | null,
  selectedOfficeName?: string,
): LocationForMail {
  if (!lookup?.found) return {}
  const selected =
    lookup.offices.find((office) => office.officeName === selectedOfficeName) ??
    lookup.offices.find((office) => office.officeName === lookup.common.postOffice) ??
    null
  return {
    postOffice: selected?.officeName || lookup.common.postOffice || undefined,
    district: selected?.districtName || lookup.common.district || undefined,
    state: selected?.stateName || lookup.common.state || undefined,
    postalRegion: selected?.regionName || lookup.common.region || undefined,
    taluk: selected?.talukName || lookup.common.taluk || undefined,
    division: selected?.divisionName || lookup.common.division || undefined,
    circle: selected?.circleName || lookup.common.circle || undefined,
  }
}

export type PostalIdentityFields = {
  postOffice: string
  district: string
  state: string
  postalRegion: string
  taluk: string
}

/** Flatten lookup + selected office into the form/letter identity fields. */
export function postalIdentityFromLookup(
  lookup: PostalLookup | null,
  selectedOfficeName?: string,
): PostalIdentityFields {
  const location = locationFromLookup(lookup, selectedOfficeName)
  return {
    postOffice: location.postOffice ?? '',
    district: location.district ?? '',
    state: location.state ?? '',
    postalRegion: location.postalRegion ?? '',
    taluk: location.taluk ?? '',
  }
}

export function withPostalIdentity<T extends { district: string; taluk?: string }>(
  details: T,
  identity: Partial<PostalIdentityFields>,
): T & PostalIdentityFields {
  return {
    ...details,
    postOffice: identity.postOffice ?? '',
    state: identity.state ?? '',
    postalRegion: identity.postalRegion ?? '',
    taluk: (details.taluk || identity.taluk) ?? '',
    district: identity.district || details.district,
  }
}

export function mapDirectoryRow(row: {
  pincode: string
  office_name: string
  office_type?: string | null
  delivery_status?: string | null
  circle_name?: string | null
  region_name?: string | null
  division_name?: string | null
  district_name?: string | null
  state_name?: string | null
  taluk_name?: string | null
}): PostalOffice {
  return {
    pincode: row.pincode,
    officeName: row.office_name,
    officeType: normalizeOfficeType(row.office_type),
    deliveryStatus: row.delivery_status ?? null,
    circleName: row.circle_name ?? null,
    regionName: row.region_name ?? null,
    divisionName: row.division_name ?? null,
    districtName: row.district_name ?? null,
    stateName: row.state_name ?? null,
    talukName: row.taluk_name?.trim() || null,
  }
}
