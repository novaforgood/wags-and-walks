'use client'

import { useState } from 'react'
import EmailModal from '../components/EmailModal'
import ApplicantsSheet from '../components/ApplicantsSheet'
import { normalizeEmailKey } from '../lib/peopleTypes'

export default function NewPage() {
  const [emailModalSelectedEmails, setEmailModalSelectedEmails] = useState<Set<string>>(new Set())
  return (
    <>
      <ApplicantsSheet
        title="New"
        status="new"
        moveToStatus="in-progress"
        moveButtonLabel="Move to In Progress"
        highlightEmails={emailModalSelectedEmails}
        toolbarCenter={
          <EmailModal
            sendToStatus="in-progress"
            onSelectedEmailsChange={(emails) => {
              setEmailModalSelectedEmails(
                new Set(emails.map(e => normalizeEmailKey(e)).filter(Boolean))
              )
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
