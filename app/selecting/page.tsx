'use client'

import ApplicantsSheet from '../components/ApplicantsSheet'

export default function SelectingPage() {
  return (
    <ApplicantsSheet
      title="Selecting"
      status={['in-progress', 'approved']}
      moveToStatus="current"
      moveButtonLabel="Move to Fostering"
    />
  )
}
