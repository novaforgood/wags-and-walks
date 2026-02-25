'use client'

import ApplicantsSheet from '../components/ApplicantsSheet'

export default function CurrentPage() {
  return (
    <ApplicantsSheet
      title="Current Candidates"
      status="current"
      moveToStatus={undefined}
      moveButtonLabel={undefined}
    />
  )
}
