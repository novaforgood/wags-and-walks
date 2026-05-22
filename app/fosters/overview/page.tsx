import { redirect } from 'next/navigation'

/** Foster summary stats moved to `/overview` (Foster tasks section). */
export default function FostersOverviewRedirectPage() {
  redirect('/overview')
}
