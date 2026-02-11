'use client'

import ApplicantsSheet from '../components/ApplicantsSheet'

export default function InProgressPage() {
  return (
    <ApplicantsSheet
      title="In Progress"
      status="in-progress"
      moveToStatus="approved"
      moveButtonLabel="Move to Approved"
    />
  )
}
