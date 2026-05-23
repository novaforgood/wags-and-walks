// Run: node scripts/migrate_overrides.js
// Requires: dev server running on localhost:3000, FIREBASE_SERVICE_ACCOUNT_PATH set (or FIREBASE_SERVICE_ACCOUNT_JSON)

const admin = require('firebase-admin')
const path = require('path')

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  || path.join(__dirname, '..', 'service-account.json')

let credential
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
} else {
  credential = admin.credential.cert(require(serviceAccountPath))
}

admin.initializeApp({ credential })
const db = admin.firestore()

async function migrate() {
  const res = await fetch('http://localhost:3000/api/people')
  const { people } = await res.json()

  if (!Array.isArray(people)) {
    console.error('Failed to fetch people. Is the dev server running on port 3000?')
    process.exit(1)
  }

  console.log(`Migrating ${people.length} applicants to applicantOverrides...`)

  const BATCH_SIZE = 400
  let batch = db.batch()
  let count = 0
  let total = 0

  for (const person of people) {
    if (!person.email) continue
    const key = person.email.trim().toLowerCase()
    const ref = db.collection('applicantOverrides').doc(key)

    const override = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'migration-script',
    }
    if (person.status)            override.status = person.status
    if (person.starred != null)   override.starred = person.starred
    if (person.notes)             override.notes = person.notes
    if (person.notesUpdatedAt)    override.notesUpdatedAt = person.notesUpdatedAt
    if (person.signedDocument)    override.signedDocument = person.signedDocument

    batch.set(ref, override, { merge: true })
    count++
    total++

    if (count >= BATCH_SIZE) {
      await batch.commit()
      console.log(`  Committed ${total} so far...`)
      batch = db.batch()
      count = 0
    }
  }

  if (count > 0) await batch.commit()
  console.log(`Done. Migrated ${total} applicant overrides.`)
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
