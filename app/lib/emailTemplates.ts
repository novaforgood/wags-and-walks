/** Known W&W links — update here when Resource Center goes live. */
export const EMAIL_LINKS = {
  orientationRsvp:
    'https://give.wagsandwalks.org/event/la-foster-orientation/e752560/register/new/select-tickets',
  fosterSurvey:
    'https://docs.google.com/forms/d/1vY1ue-Iqtzw9woTtP2mdFMjnxu5rfeC_GzOfh6weBwo/viewform',
  contentDrive:
    'https://drive.google.com/drive/folders/16BGPycjDGDyRCJIvqMcA85HPCYIWuagk',
  resourceCenter: 'https://wagsandwalksresource.vercel.app',
  crateTraining: 'https://wagsandwalksresource.vercel.app/crate-training',
  fosterTeamPhone: '(747) 302-4822',
  medicalTeamPhone: '(310) 730-5463',
} as const

const SIGNATURE = `--

Wags & Walks Foster Team
wagsandwalks.org
To reach the foster team: ${EMAIL_LINKS.fosterTeamPhone}
To reach our medical team: ${EMAIL_LINKS.medicalTeamPhone}`

export type EmailTemplateId = 'orientation' | 'survey-content' | 'welcome' | 'check-in'

export type EmailTemplateVars = {
  firstName?: string
  dogNames?: string[]
}

export type EmailTemplate = {
  id: EmailTemplateId
  label: string
  description: string
  subject: string
  buildBody: (vars: EmailTemplateVars) => string
}

function formatDogList(dogNames: string[]): string | null {
  const dogs = dogNames.filter(Boolean)
  if (dogs.length === 0) return null
  if (dogs.length === 1) return dogs[0]
  return `${dogs.slice(0, -1).join(', ')} and ${dogs[dogs.length - 1]}`
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'orientation',
    label: 'Orientation invitation',
    description: 'After application review — RSVP for in-person orientation',
    subject: 'Invitation: Wags & Walks Foster Orientation',
    buildBody: () => `Hello!

Thank you so much for applying to foster with Wags & Walks. We are incredibly grateful for your willingness to step up and help save lives, and we're so excited to welcome you into our foster community.

The next step in the process is attending an in-person foster orientation, where you'll learn more about our foster program, expectations, and how to get involved. Foster orientations take place every other Wednesday evening, and you only need to attend one session. At this time, we do not offer a virtual orientation option.

Orientation details:

Wags & Walks Adoption Center: 2236 Federal Ave, Los Angeles, CA 90064

Time: 6:00–7:00 PM

Please RSVP here for the upcoming session that works best for you:
${EMAIL_LINKS.orientationRsvp}

Please plan to arrive at the center early to allow for parking. We will kindly ask you to reschedule if you are more than 10 minutes late.

We can't thank you enough for your interest in fostering and being part of the Wags & Walks community. We look forward to meeting you soon!

With gratitude,

Eitan & Erica

${SIGNATURE}`,
  },
  {
    id: 'survey-content',
    label: 'Survey & content collection',
    description: 'Weekly foster survey + photo/video upload instructions',
    subject: '(PLEASE READ) W&W Foster Survey//Content Collection!',
    buildBody: () => `Hello wonderful fosters!

Welcome to another week of the foster survey and content collection process! Your responses and the photos/videos you share are so important — they help our adoptions team place dogs in their forever homes.

Please complete the weekly survey here:
${EMAIL_LINKS.fosterSurvey}

We have a new method for collecting photos and videos from you all! Our social media team is restructuring our Instagram account to help get pups adopted.

NOTE: We have included below some best practices that are proven to help get your dogs adopted!

Please drop your content into your pup's album in Google Drive:
${EMAIL_LINKS.contentDrive}

Do not create new folders — find your dog's existing folder (use Cmd+F or Ctrl+F to search). Puppies may be organized by litter name.

General tips & tricks:

• Find a well-lit area — face the dog toward the light source (like a window), especially for dark-furred dogs.
• Make silly noises to get head tilts or ear flops (audio can be edited out of videos).
• Take photos after a walk or playtime when the dog is calm.
• Aim for variety — different locations (inside and outside) and positions.
• Turn your phone upside down for smaller dogs to get the camera closer to the ground.
• Puppies: capture individual photos even in a litter; include nursing moms when relevant.
• Clean your camera lens before shooting.
• Use a slip lead instead of a crate for better visibility in photos/videos.

Photos:
We need 8–10 photos per post for website profiles and Instagram. Take solo shots and shots with other pets; get down to the dog's eye level; use toys/treats for attention; use the "puppy hold" for small, wiggly puppies.

Videos:
Aim for 5–10 second clips. Capture headshot equivalents (walking toward camera, sitting, smiling) and relaxed moments. Provide at least 30 seconds of usable footage for single-dog reels. Show silly behaviors, progress for shy dogs, and everyday routines (breakfast, walks).

We can't share photos or videos that include:
• Profane words (visible text cannot be edited out)
• Bare feet
• Drug paraphernalia
• Personal information
• The foster dog off-leash in a public place

Please let us know if you have any questions. Thank you for opening your home & helping us to save more dogs!

${SIGNATURE}`,
  },
  {
    id: 'welcome',
    label: 'Welcome (post-pickup)',
    description: 'Agreement highlights, emergency contacts, puppy FAQs',
    subject: 'Wags & Walks Foster Agreement, Emergency Contact and Puppy FAQs',
    buildBody: ({ firstName }) => {
      const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi,'
      return `${greeting}

Thank you so much for fostering with Wags & Walks! We're so grateful to have you on the team.

Please review and sign the foster agreement if you haven't already. You can find the agreement, orientation deck, and training materials in our Resource Center:
${EMAIL_LINKS.resourceCenter}

Key contract points:

1. Dogs must be on a leash at all times in public. Use the leash or tool we provide and communicate with the team before making any changes to gear.

2. If your foster dog is lost, call the foster team immediately at ${EMAIL_LINKS.fosterTeamPhone}.

3. All medical needs must go through our approved vet partners.

Medical emergencies or questions:
Call the medical team at ${EMAIL_LINKS.medicalTeamPhone}. Leave a voicemail for emergencies; text for non-emergency questions (include your name and the pup's name).

Weekly survey & content:
${EMAIL_LINKS.fosterSurvey}

Upload photos and videos here:
${EMAIL_LINKS.contentDrive}

FAQs for Fosters: Puppy Edition

When can my puppy go on walks?
Puppies need three rounds of vaccinations (usually around 3–4 months old) before being cleared for walks in public.

Potty training tips?
Establish a routine. If your puppy isn't cleared for walks yet, use a private outdoor space or pee pads.

Crate training?
See our Resource Center guide: ${EMAIL_LINKS.crateTraining}

What leash should I use?
Use the slip lead we provide. Do not use harnesses or other collars without consulting the team first.

Can my puppy meet other dogs?
Only meet dogs that are 100% vaccinated. Avoid other puppies or unvaccinated adults.

Socialization?
Once cleared, gradually expose your puppy to new people and environments.

What if my puppy isn't eating?
It's normal for a puppy not to eat well for the first day or two. Contact the medical team if it persists.

When will my puppy be spayed or neutered?
We cover spay/neuter for all dogs in our care. We typically do not perform surgery prior to 6 months of age. Our surgery coordinator will reach out when your foster is ready.

${SIGNATURE}`
    },
  },
  {
    id: 'check-in',
    label: 'Quick check-in',
    description: 'Short personal follow-up',
    subject: 'Checking in!',
    buildBody: ({ firstName, dogNames }) => {
      const greeting = firstName?.trim() ? `Hey ${firstName.trim()},` : 'Hey,'
      const dogList = formatDogList(dogNames ?? [])
      if (dogList) {
        return `${greeting}

Just checking in on ${dogList} — how are things going?

${SIGNATURE}`
      }
      return `${greeting}

Just checking in — how are things going?

${SIGNATURE}`
    },
  },
]

export const DEFAULT_TEMPLATE_BY_CONTEXT = {
  applicant: 'orientation' as EmailTemplateId,
  foster: 'survey-content' as EmailTemplateId,
}

export function getEmailTemplate(id: EmailTemplateId): EmailTemplate {
  const template = EMAIL_TEMPLATES.find(t => t.id === id)
  if (!template) throw new Error(`Unknown email template: ${id}`)
  return template
}

export function buildEmailFromTemplate(
  id: EmailTemplateId,
  vars: EmailTemplateVars = {},
): { subject: string; body: string } {
  const template = getEmailTemplate(id)
  let subject = template.subject
  const dogList = formatDogList(vars.dogNames ?? [])
  if (id === 'check-in' && dogList) {
    subject = `Checking in on ${dogList}!`
  }
  return {
    subject,
    body: template.buildBody(vars),
  }
}

/** Gmail compose URLs break on very long bodies — warn staff to copy instead. */
export const GMAIL_COMPOSE_URL_WARN_CHARS = 6000

export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    to: to.trim(),
    su: subject,
    body,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}
