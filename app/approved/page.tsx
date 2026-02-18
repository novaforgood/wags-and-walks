'use client'

import ApplicantsSheet from '../components/ApplicantsSheet'

export default function ApprovedPage() {
  return (
    <ApplicantsSheet
      title="Approved"
      status="approved"
      moveToStatus="current"
      moveButtonLabel="Move to Current"
    />
  )
}
