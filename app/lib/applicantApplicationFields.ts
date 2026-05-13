import type { Person } from '@/app/lib/peopleTypes'

/**
 * Canonical foster application questions from the Google Form / Sheet.
 * `rawKeys` are tried in order (handles minor header variants like trailing "?").
 */
export type ApplicationFieldDef = {
  readonly rawKeys: readonly string[]
  /** Polished label shown in the UI */
  readonly label: string
  /** Full original wording — shown as a native tooltip on the label */
  readonly fullQuestionTitle?: string
}

export type ApplicationSectionDef = {
  readonly sectionTitle: string
  readonly fields: readonly ApplicationFieldDef[]
}

/** Optional sheet variants used elsewhere in the app (FilterDropdown, legacy columns). */
const LIVING = ['What is your living arrangement', 'What is your living arrangement?'] as const
const EXPERIENCE = ['How would you rate your experience with dogs', 'How would you rate your experience with dogs?'] as const
const CHILDREN_COUNT = ['How many children are in your home', 'How many children are in your home?'] as const
const CURRENT_PETS = ['Do you currently have any pets at home', 'Do you currently have any pets at home?'] as const
const OWNED_BEFORE = ['Have you ever owned a pet before', 'Have you ever owned a pet before?'] as const

export const APPLICATION_FORM_SECTIONS: readonly ApplicationSectionDef[] = [
  {
    sectionTitle: 'Application',
    fields: [
      {
        rawKeys: ['Submitted On'],
        label: 'Submitted on',
        fullQuestionTitle: 'Submitted on',
      },
      { rawKeys: ['Name'], label: 'Name' },
      { rawKeys: ['Email'], label: 'Email' },
      { rawKeys: ['Phone'], label: 'Phone' },
      { rawKeys: ['Address'], label: 'Address' },
      {
        rawKeys: ['How old are you'],
        label: 'How old are you?',
        fullQuestionTitle: 'How old are you?',
      },
      {
        rawKeys: ['What do you do for a living'],
        label: 'What do you do for a living?',
        fullQuestionTitle: 'What do you do for a living?',
      },
    ],
  },
  {
    sectionTitle: 'Household',
    fields: [
      {
        rawKeys: [...LIVING],
        label: 'What is your living arrangement?',
        fullQuestionTitle: 'What is your living arrangement?',
      },
      {
        rawKeys: [...CHILDREN_COUNT],
        label: 'How many children are in your home?',
        fullQuestionTitle: 'How many children are in your home?',
      },
      {
        rawKeys: ['How old are they Check all that apply'],
        label: "Children's ages (check all that apply)",
        fullQuestionTitle:
          'How old are your children? Check all that apply.',
      },
      {
        rawKeys: ['Other than yourself how many additional adults do you share your home with'],
        label: 'Other adults in the home',
        fullQuestionTitle:
          'Other than yourself, how many additional adults do you share your home with?',
      },
      {
        rawKeys: ['How old are they'],
        label: "Other adults' ages",
        fullQuestionTitle: 'How old are they?',
      },
      {
        rawKeys: ['What is their relationship to you'],
        label: 'Relationship to other adults',
        fullQuestionTitle: 'What is their relationship to you?',
      },
    ],
  },
  {
    sectionTitle: 'Pet experience',
    fields: [
      {
        rawKeys: [...OWNED_BEFORE],
        label: 'Have you ever owned a pet before?',
        fullQuestionTitle: 'Have you ever owned a pet before?',
      },
      {
        rawKeys: ['What kind of pets have you owned check all that apply'],
        label: 'Kinds of pets owned (check all that apply)',
        fullQuestionTitle: 'What kind of pets have you owned? Check all that apply.',
      },
      {
        rawKeys: [...CURRENT_PETS],
        label: 'Do you currently have any pets at home?',
        fullQuestionTitle: 'Do you currently have any pets at home?',
      },
      {
        rawKeys: [
          'Please list ALL pets that you CURRENTLY own Include type dogcat breed age gender length of time in your care etc',
        ],
        label: 'Current pets (details)',
        fullQuestionTitle:
          'Please list all pets you currently own, including type (dog/cat), breed, age, sex, and how long they have been in your care.',
      },
      {
        rawKeys: ['Are your current pets spayedneutered'],
        label: 'Are your current pets spayed or neutered?',
        fullQuestionTitle: 'Are your current pets spayed/neutered?',
      },
    ],
  },
  {
    sectionTitle: 'Foster care plan',
    fields: [
      {
        rawKeys: [...EXPERIENCE],
        label: 'Experience with dogs',
        fullQuestionTitle: 'How would you rate your experience with dogs?',
      },
      {
        rawKeys: ['Where will your foster dog be when you are not home'],
        label: 'Where will the foster dog be when you are not home?',
        fullQuestionTitle: 'Where will your foster dog be when you are not home?',
      },
      {
        rawKeys: ['Where will your foster dog sleep during the night'],
        label: 'Where will the foster dog sleep at night?',
        fullQuestionTitle: 'Where will your foster dog sleep during the night?',
      },
      {
        rawKeys: ['When would you like to take your foster dog home'],
        label: 'When would you like to bring your foster dog home?',
        fullQuestionTitle: 'When would you like to take your foster dog home?',
      },
      {
        rawKeys: [
          'Please share your preferences in terms of size breed energy level etc Fosters for large dogs 45 lbs are always our biggest need Please note that you do not need a house or yard to foster a large dog Many bigger dogs are just fine in apartments and our team will pair you with a dog that will be a great match',
        ],
        label: 'Dog size, breed, and energy preferences',
        fullQuestionTitle:
          'Please share your preferences for size, breed, and energy level. Fosters for large dogs (45+ lbs) are always our biggest need. You do not need a house or yard to foster a large dog—many bigger dogs do well in apartments, and our team will help match you.',
      },
      {
        rawKeys: [
          'Are you willing to foster dogs with special needs If so please check all that apply below',
        ],
        label: 'Willing to foster dogs with special needs?',
        fullQuestionTitle:
          'Are you willing to foster dogs with special needs? If so, please check all that apply below.',
      },
      {
        rawKeys: ['Are you willing to foster dogs with medical needs'],
        label: 'Willing to foster dogs with medical needs?',
        fullQuestionTitle: 'Are you willing to foster dogs with medical needs?',
      },
      {
        rawKeys: ['Are you willing to foster pregnant mamas andor mamas and their litters'],
        label: 'Willing to foster pregnant moms or moms with litters?',
        fullQuestionTitle:
          'Are you willing to foster pregnant moms and/or moms with their litters?',
      },
      {
        rawKeys: ['Are you willing to foster dogs that need training upkeepbehavior rehabilitation'],
        label: 'Willing to foster dogs that need training or behavior help?',
        fullQuestionTitle:
          'Are you willing to foster dogs that need training, upkeep, behavior, or rehabilitation?',
      },
    ],
  },
  {
    sectionTitle: 'How they found us',
    fields: [
      {
        rawKeys: ['How did you hear about us'],
        label: 'How did you hear about us?',
        fullQuestionTitle: 'How did you hear about us?',
      },
      {
        rawKeys: ['If someone referred you please list their name here so we may thank them'],
        label: "Referrer's name (if someone referred you)",
        fullQuestionTitle:
          'If someone referred you, please list their name here so we may thank them.',
      },
    ],
  },
  {
    sectionTitle: 'Agreements',
    fields: [
      {
        rawKeys: [
          'Wags and Walks dogs will often have a transition period of 12 weeks after leaving the shelter and may exhibit signs of separation anxiety andor may have accidents in their new foster homes until they feel safe Please check that you agree to understanding that there could be a transition period',
        ],
        label: 'Transition period (up to ~12 weeks)',
        fullQuestionTitle:
          'Wags and Walks dogs often need a transition period of up to 12 weeks after leaving the shelter. They may show separation anxiety or have accidents until they feel safe. Do you understand and agree that there may be a transition period?',
      },
      {
        rawKeys: [
          'Aside from emergencies we require 48 hours notice if you need to return your foster dog Is that something you feel you can accommodate',
        ],
        label: '48-hour notice to return a foster (except emergencies)',
        fullQuestionTitle:
          'Aside from emergencies, we require 48 hours’ notice if you need to return your foster dog. Is that something you can accommodate?',
      },
      {
        rawKeys: [
          'I understand that any misrepresentation of the above information authorizes Wags  Walks to deny application andor reclaim the pet that is in my home I acknowledge that Wags  Walks cannot guarantee any animals against parasites diseases or destructive behavior If I foster a dog from Wags  Walks I will not hold Wags  Walks responsible nor seek any compensation for damages medical fees or other liabilities incurred by the pet I foster',
        ],
        label: 'Accuracy, risks, and liability',
        fullQuestionTitle:
          'I understand that misrepresentation may result in denial of my application or reclaiming of the pet in my care. I acknowledge that Wags & Walks cannot guarantee animals against parasites, disease, or destructive behavior, and I will not hold Wags & Walks responsible or seek compensation for damages, medical fees, or other liabilities related to the pet I foster.',
      },
      {
        rawKeys: [
          'I understand that I must follow all Wags and Walks protocols for fostering a dog which includes always having a collar on keeping a leash on my foster dog at all times when in public and using a crate for my foster dog when heshe is alone',
        ],
        label: 'Foster protocols (collar, leash, crate)',
        fullQuestionTitle:
          'I understand that I must follow all Wags & Walks fostering protocols, including keeping a collar on my foster dog, using a leash whenever the dog is in public, and using a crate when the dog is alone.',
      },
    ],
  },
] as const

export const ALL_APPLICATION_FIELD_RAW_KEYS: ReadonlySet<string> = new Set(
  APPLICATION_FORM_SECTIONS.flatMap(s => s.fields.flatMap(f => [...f.rawKeys]))
)

function firstRawValue(raw: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const v = raw[key]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function formatSubmittedOn(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Resolved display string for one application field (sheet + sensible Person fallbacks).
 */
export function applicationFieldDisplayValue(person: Person, field: ApplicationFieldDef): string {
  const raw = person.raw ?? {}
  const direct = firstRawValue(raw, field.rawKeys)
  if (direct) return direct

  if (field.rawKeys.includes('Submitted On') && person.appliedAt) {
    return formatSubmittedOn(person.appliedAt)
  }
  if (field.rawKeys.includes('Name')) {
    const n = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
    if (n) return n
  }
  if (field.rawKeys.includes('Email') && person.email?.trim()) return person.email.trim()
  if (field.rawKeys.includes('Phone') && person.phone?.trim()) return person.phone.trim()
  if (field.rawKeys.includes('Address') && person.address?.trim()) return person.address.trim()

  return ''
}
