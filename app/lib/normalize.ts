// server-only safe
export function toArray<T = any>(v: any): T[] {
  if (!v) return []
  if (Array.isArray(v)) return v as T[]
  if (Array.isArray((v as any)?.data)) return (v as any).data as T[]
  try {
    if (typeof v === 'object' && v !== null) {
      const maybeArr = (v as any).records || (v as any).items || (v as any).rows
      if (Array.isArray(maybeArr)) return maybeArr as T[]
    }
  } catch {}
  return []
}

export function sortByDateAsc<T extends { date?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const da = a?.date ? Date.parse(a.date) : 0
    const db = b?.date ? Date.parse(b.date) : 0
    return da - db
  })
}
