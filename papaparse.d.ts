declare module 'papaparse' {
  export interface ParseResult<T> {
    data: T[]
    errors: unknown[]
    meta: unknown
  }

  export interface ParseConfig<T> {
    header?: boolean
    skipEmptyLines?: boolean | 'greedy'
    complete?: (results: ParseResult<T>) => void
  }

  export function parse<T>(input: string, config: ParseConfig<T>): void

  const Papa: {
    parse: typeof parse
  }

  export default Papa
}

