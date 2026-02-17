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
