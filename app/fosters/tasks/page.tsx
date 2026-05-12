import { redirect } from 'next/navigation'

/** Task inbox merged into `/fosters`; keep route for bookmarks. */
export default function FostersTasksRedirectPage() {
  redirect('/fosters')
}
