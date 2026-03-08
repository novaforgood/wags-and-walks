// @deprecated - This page should be deleted in the future as routing has moved to /candidates and /fosters

'use client'

import ApplicantsSheet from '../components/ApplicantsSheet'

export default function FosteringPage() {
  return (
    <ApplicantsSheet
      title="Fostering"
      status="current"
      moveToStatus="in-progress"
      moveButtonLabel="Move to Selecting"
    />
  )
}
