'use client'

import { useState } from 'react'
import EmailModal from '../components/EmailModal'
import ApplicantsSheet from '../components/ApplicantsSheet'
import { normalizeEmailKey } from '../lib/peopleTypes'

export default function OnboardingPage() {
  const [sheetManualSelectedEmails, setSheetManualSelectedEmails] = useState<Set<string>>(
    new Set()
  )
  const [emailModalSelectedEmails, setEmailModalSelectedEmails] = useState<Set<string>>(
    new Set()
  )

  const sheetSelectedEmails = new Set<string>([
    ...sheetManualSelectedEmails,
    ...emailModalSelectedEmails
  ])
  return (
    <>
      <ApplicantsSheet
        title="Onboarding"
        status="new"
        moveToStatus="in-progress"
        moveButtonLabel="Move to Selecting"
        splitFlagged={true}
        highlightEmails={emailModalSelectedEmails}
        selectedEmails={sheetSelectedEmails}
        onSelectedEmailsChange={(next) => {
          // Keep email-modal selections intact; store only the "manual" remainder from the sheet UI.
          const manual = new Set<string>()
          for (const email of next) {
            if (!emailModalSelectedEmails.has(email)) manual.add(email)
          }
          setSheetManualSelectedEmails(manual)
        }}
        toolbarCenter={
          <EmailModal
            sendToStatus="in-progress"
            preselectedEmailKeys={Array.from(sheetSelectedEmails)}
            onSelectedEmailsChange={(emails) => {
              setEmailModalSelectedEmails(new Set(emails.map(e => normalizeEmailKey(e)).filter(Boolean)))
            }}
            onSentEmails={() => {
              setEmailModalSelectedEmails(new Set())
            }}
          />
        }
      />
    </>
  )
}
