#!/usr/bin/env node
/**
 * Reads a Firebase service account JSON file and sets FIREBASE_SERVICE_ACCOUNT_JSON in .env.local.
 *
 * Usage:
 *   node scripts/sync-firebase-env-local.mjs [path/to/key.json]
 *
 * Default path (repo root): FIREBASE_SERVICE_ACCOUNT_JSON
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const keyPath = path.resolve(root, process.argv[2] || 'FIREBASE_SERVICE_ACCOUNT_JSON')
const envPath = path.join(root, '.env.local')

if (!fs.existsSync(keyPath)) {
  console.error('Missing file:', keyPath)
  process.exit(1)
}

const raw = fs.readFileSync(keyPath, 'utf8').trim()
if (!raw) {
  console.error(
    'Key file is empty. Paste your Firebase private key JSON into the file and save, or pass the path to the downloaded .json:',
    '\n  node scripts/sync-firebase-env-local.mjs ~/Downloads/wags-and-walks-*.json',
  )
  process.exit(1)
}

let keyObj
try {
  keyObj = JSON.parse(raw)
} catch (e) {
  console.error('Invalid JSON:', e.message)
  process.exit(1)
}

if (keyObj.type !== 'service_account' || !keyObj.private_key) {
  console.error('File does not look like a Firebase service account JSON.')
  process.exit(1)
}

const valueLine =
  'FIREBASE_SERVICE_ACCOUNT_JSON=' + JSON.stringify(JSON.stringify(keyObj))

let existing = ''
if (fs.existsSync(envPath)) {
  existing = fs.readFileSync(envPath, 'utf8')
}

const lines = existing.split(/\r?\n/).filter((l) => l.trim().length > 0)
const filtered = lines.filter((l) => !l.startsWith('FIREBASE_SERVICE_ACCOUNT_JSON='))
const next = [...filtered, valueLine].join('\n') + '\n'

fs.writeFileSync(envPath, next, 'utf8')
console.log('Wrote FIREBASE_SERVICE_ACCOUNT_JSON to .env.local — restart `npm run dev`.')
