/**
 * Shared parsing + display for the sheet "Flags" column (often SCREAMING_SNAKE_CASE tokens).
 */

const SPLIT_RE = /[;,|]/

function isNoiseToken(t: string): boolean {
    const low = t.toLowerCase()
    return low === 'ok' || low === 'none'
}

/** Individual flag tokens from a raw sheet value (noise tokens like ok/none dropped). */
export function parseRawFlagsTokens(raw: string | null | undefined): string[] {
    const s = String(raw ?? '').trim()
    if (!s) return []
    return s
        .split(SPLIT_RE)
        .map(part => part.trim())
        .filter(part => part.length > 0 && !isNoiseToken(part))
}

/** One token → Title Case words, underscores → spaces (e.g. UNDER_21 → Under 21). */
export function formatFlagToken(token: string): string {
    const t = token.trim().replace(/\s+/g, ' ')
    if (!t) return ''

    const isScreamingSnake = /^[A-Z0-9_]+$/.test(t)
    const parts = (isScreamingSnake ? t.split(/_+/) : t.replace(/_/g, ' ').split(/\s+/)).filter(Boolean)

    return parts
        .map(part => {
            if (/^\d+$/.test(part)) return part
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        })
        .join(' ')
}

/** Full sheet value → comma-separated readable flags, or null if none. */
export function formatFlagsForDisplay(raw: string | null | undefined): string | null {
    const tokens = parseRawFlagsTokens(raw)
    if (tokens.length === 0) return null
    return tokens.map(formatFlagToken).join(', ')
}

/** True when the sheet has at least one meaningful flag token. */
export function rawFlagsHasMeaningfulTokens(raw: string | null | undefined): boolean {
    return parseRawFlagsTokens(raw).length > 0
}
