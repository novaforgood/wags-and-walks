'use client'

import ApplicantsSheet from '../components/ApplicantsSheet'

export default function CurrentPage() {
  return (
    <ApplicantsSheet
      title="Current"
      status="current"
      moveToStatus="in-progress"
      moveButtonLabel="Move to In Progress"
    />
  )
}
