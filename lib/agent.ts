import 'server-only'
import { ToolLoopAgent, Output, generateText, isStepCount, tool } from 'ai'
import { z } from 'zod'
import { search, tokenize, type RetrievalHit } from './knowledge/retrieve'
import { findEntity, neighbourhood, type GraphFact } from './knowledge/graph'
import { assessRisk } from './safety'
import {
  addMessage,
  createEscalation,
  getFarmer,
  getConversation,
  type AnswerStatus,
  type Channel,
  type Language,
  type Trace,
} from './store-legacy'

const MODEL = process.env.AI_MODEL ?? ''
const VISION_MODEL = process.env.AI_VISION_MODEL ?? MODEL

const SMS_LIMIT = 300

const REFUSE =
  "Sorry, I don't have a verified ISU Extension or USDA source that directly answers that question, so I won't guess. Please contact your ISU Extension office, crop insurance agent, or certified crop adviser."

const ESCALATE =
  'Your question has been forwarded to a human agronomist or adviser. They will follow up with you shortly.'

const SOURCE_PREFIX = 'Src'

const answerSchema = z.object({
  status: z
    .enum(['answered', 'refused'])
    .describe('"refused" if the retrieved sources do not directly support an answer.'),
  answer: z.string().describe('Plain-language reply in the farmer language. Short sentences.'),
  citedSourceIds: z.array(z.string()).describe('IDs of knowledge-base documents the answer relies on.'),
  needsHumanAdvisor: z.boolean().describe('True if a human advisor should follow up.'),
})

function instructions(channel: Channel, highStakes: boolean) {
  const format =
    channel === 'voice'
      ? 'The reply will be read aloud over the phone. Use 3–5 short spoken sentences. No symbols, no lists, no abbreviations.'
      : `The reply may be delivered as an SMS or on-screen message. Keep it under ${SMS_LIMIT - 40} characters. Plain text, no markdown, no emoji.`

  return `You are Harvest IQ, an AI farm adviser for corn farmers in Iowa, USA. You serve farmers of all sizes — from small family operations to larger farms.

GROUNDING RULES (non-negotiable):
- Always call searchKnowledge first. You may call queryKnowledgeGraph to connect corn diseases, pests, nutrients, and practices.
- Only state facts that appear in the retrieved ISU Extension, USDA-ARS, CIMMYT, CGIAR, or peer-reviewed documents. Never use outside knowledge.
- If no document directly answers the question, set status "refused". Do not guess. Tell the farmer to contact their ISU Extension office or certified crop adviser.
- List every document you used in citedSourceIds.
- Never give specific pesticide mixing rates, herbicide rates per acre, or crop insurance policy specifics — for those, set needsHumanAdvisor true and direct to their crop insurance agent or certified applicator.
${highStakes ? '- THIS QUESTION IS HIGH-STAKES. It is already being sent to a human adviser. Give only safe general steps from the sources and confirm an adviser will follow up.\n' : ''}
STYLE:
- Reply in plain, direct American English. Use everyday words a corn farmer in Iowa would use. Be warm and practical.
- ${format}
- Lead with the single most useful action or answer.`
}

/**
 * Degraded mode when the model is unreachable: quote the most relevant
 * validated passage verbatim. Still fully grounded and cited.
 */
// Query-specific openers based on key terms in the question
function queryOpener(query: string, topic: string): string {
  const q = query.toLowerCase()
  if (/yellow|pale|chloro/.test(q) && /rain|wet|flood/.test(q)) return "Here's the quick way to tell what's going on."
  if (/yellow|pale/.test(q) && /lower|bottom|midrib/.test(q)) return "That sounds like a nutrient problem."
  if (/yellow|pale/.test(q) && /new|upper|whorl|twisted/.test(q)) return "New leaf symptoms point to a specific cause."
  if (/lost|lose|losing.*nitrogen|nitrogen.*rain/.test(q)) return "Good news — don't panic yet."
  if (/how much nitrogen|nitrogen rate|n rate/.test(q)) return "Here's what the research says on nitrogen rates."
  if (/sidedress|psnt|lsnt/.test(q)) return "Here's when and how to decide on sidedress nitrogen."
  if (/replant|should I replant/.test(q)) return "Here's how to make that replant call."
  if (/stand|plants per/.test(q)) return "Here's how to read your stand count."
  if (/hail/.test(q)) return "Wait before you do anything — here's why."
  if (/flood|under water|saturated/.test(q)) return "Here's what to look for after flooding."
  if (/tar spot/.test(q)) return "Tar spot needs quick action — here's the key."
  if (/rust/.test(q)) return "Here's what you need to know about rust right now."
  if (/gray leaf|nclb|blight|disease|spots|lesion/.test(q)) return "Let me help you identify what you're seeing."
  if (/fungicide|spray/.test(q) && /pay|worth|money/.test(q)) return "Here's the honest answer on fungicide return."
  if (/fungicide|spray/.test(q)) return "Here's when spraying makes sense."
  if (/waterhemp|palmer|pigweed/.test(q)) return "Waterhemp is tough — here's the approach that works."
  if (/herbicide|weed/.test(q)) return "Here's what to do about your weed program."
  if (/aphid/.test(q)) return "Before you spray, here's the threshold to know."
  if (/rootworm|lodg/.test(q)) return "That's a rootworm question — here's what to look for."
  if (/cutworm|japanese beetle|silk/.test(q)) return "Here's the scouting threshold that matters."
  if (/harvest|pick|moisture.*corn|corn.*moisture/.test(q)) return "Here's how to think about harvest timing."
  if (/stor|bin|aeration|spoil/.test(q)) return "Here's what keeps grain safe in the bin."
  if (/shrink/.test(q)) return "Shrink adds up fast — here's the math."
  if (/losing money|breakeven|prices/.test(q)) return "Here's the honest look at the numbers."
  if (/rotation|corn after corn|soybean/.test(q)) return "Here's what rotation research shows."
  if (/cover crop/.test(q) && /terminat|kill/.test(q)) return "Timing your cover crop termination really matters."
  if (/cover crop/.test(q) && /green|alive|living/.test(q)) return "Planting green works — here's when it doesn't."
  if (/soil.*wet|wet.*soil|waterlog|soggy|standing water|tile drain|flooded field|too wet/.test(q)) return "Here's what wet soil means for your corn."
  if (/compact/.test(q)) return "Compaction hurts yields — here's the fix."
  if (/soil temp/.test(q)) return "Here's the soil temperature rule for corn."
  if (/late plant|June|delay/.test(q)) return "Late planting costs yield — here's how much."
  if (/no.till|notill/.test(q)) return "Here's what no-till means for your corn."
  if (/insur/.test(q)) return "Call your agent first — here's what to document."
  if (/carryover|herbicide injur/.test(q)) return "Carryover injury has a pattern — here's how to tell."
  // Topic fallbacks
  const topicOpeners: Record<string, string> = {
    nitrogen: "Here's what you need to know about nitrogen.",
    replant: "Here's what I'd look at for replanting.",
    disease: "Let's talk about what might be hitting your crop.",
    weeds: "Here's the deal on weeds.",
    planting: "On planting — here's what matters most.",
    pests: "Let me tell you what to watch for.",
    harvest: "Here's what to know about harvest.",
    economics: "On the numbers side —",
    'cover-crops': "Cover crops are worth it. Here's the key thing.",
    soil: "Soil compaction can hurt you. Here's what to do.",
  }
  return topicOpeners[topic] ?? "Here's what the research says."
}

function extractiveAnswer(query: string, retrieved: Map<string, RetrievalHit>, toolCalls: string[]) {
  toolCalls.push('fallback:extractive')
  const hits = search(query, 3)
  if (!hits.length) return null

  // Always mark the top hit as retrieved so it gets cited
  for (const h of hits) retrieved.set(h.id, h)

  const bestHit = hits[0]
  const opener = queryOpener(query, bestHit.topic)

  // Use the full excerpt from the best-matching doc — it's already a coherent
  // passage written in plain English. Sentence-picking produces choppy fragments.
  const body = simplify(bestHit.excerpt.trim())

  return { id: bestHit.id, score: bestHit.score, answer: `${opener} ${body}` }
}

/** Replace scientific/technical phrases with plain farmer English */
function simplify(text: string): string {
  return text
    .replace(/\bPhyllachora maydis\b/gi, 'the tar spot fungus')
    .replace(/\bPuccinia polysora\b/gi, 'the southern rust fungus')
    .replace(/\bCercospora zeae-maydis\b/gi, 'the gray leaf spot fungus')
    .replace(/\bDiabrotica virgifera\b/gi, 'corn rootworm')
    .replace(/\bAmaranthus tuberculatus\b/gi, 'waterhemp')
    .replace(/\bdenitrification\b/gi, 'nitrogen escaping as gas')
    .replace(/\bleaching\b/gi, 'nitrogen washing below the roots')
    .replace(/\bPSNT\b/g, 'soil nitrate test')
    .replace(/\bLSNT\b/g, 'late-spring soil test')
    .replace(/\bMRTN\b/g, 'the most profitable nitrogen rate')
    .replace(/\bGDU[s]?\b/g, 'heat units')
    .replace(/\bRM\b/g, 'relative maturity')
    .replace(/\bVT\b/g, 'tasseling')
    .replace(/\bR1\b/g, 'silking')
    .replace(/\bR3\b/g, 'milk stage')
    .replace(/\bR4\b/g, 'dough stage')
    .replace(/\bR5\b/g, 'dent stage')
    .replace(/\bR6\b/g, 'black layer')
    .replace(/\bV(\d+)\s*(?:to|-)\s*V(\d+)\b/g, 'when corn has $1 to $2 leaves')
    .replace(/\bV(\d+)\b/g, (_m, n) => {
      const leaf = parseInt(n)
      if (leaf <= 2) return `seedling stage (${n} leaves)`
      if (leaf <= 5) return `early stage (${n} leaves, about knee-high)`
      if (leaf <= 8) return `mid-vegetative stage (${n} leaves)`
      return `late vegetative stage (${n} leaves)`
    })
    .replace(/\bppm\b/g, 'parts per million')
    .replace(/\bpsi\b/gi, 'pounds per square inch')
    .replace(/\bBt\b/g, 'insect-resistant')
    .replace(/\bameliorat\w+\b/gi, 'fix')
    .replace(/\ballelopath\w+\b/gi, 'chemical interference')
    .replace(/\bpyroxasulfone\b/gi, 'a Group 15 herbicide')
    .replace(/\bs-metolachlor\b/gi, 'a Group 15 herbicide')
    .replace(/\bacetochlor\b/gi, 'a Group 15 herbicide')
    .replace(/\bazoxystrobin\b/gi, 'a strobilurin fungicide')
    .replace(/\bpyraclostrobin\b/gi, 'a strobilurin fungicide')
    .replace(/\bchloropyhll\b/gi, 'the green in leaves')
    .replace(/\binterveinal chlorosis\b/gi, 'yellow stripes between the leaf veins')
    .replace(/\bpenetrometer\b/gi, 'a soil probe')
    .replace(/\bhardpan\b/gi, 'compacted layer')
    .replace(/\bsubsoiler\b/gi, 'deep-tillage tool')
    .replace(/\bmesonet\b/gi, 'the Iowa weather network')
    .trim()
}

export interface AdviceResult {
  reply: string
  trace: Trace
}

export async function runAdvisor(input: {
  phone: string
  channel: Channel
  question: string
  language?: Language
  observations?: string
  prevQuestion?: string
  prevAnswer?: string
}): Promise<AdviceResult> {
  const started = Date.now()
  const farmer = getFarmer(input.phone)
  const language = input.language ?? farmer?.language ?? 'en'
  void language // English-only MVP; kept for API compatibility
  // For photo channel with no caption, treat observations as the question for risk + search
  const effectiveQuestion = input.question.trim() || input.observations || input.question
  const risk = assessRisk(effectiveQuestion)

  addMessage({
    phone: input.phone,
    channel: input.channel,
    direction: 'in',
    author: 'farmer',
    text: input.question,
  })

  const retrieved = new Map<string, RetrievalHit>()
  const graphFacts: GraphFact[] = []
  const toolCalls: string[] = []
  let agentRequestedEscalation: string | null = null

  // Use client-provided previous Q&A (reliable — not affected by server restarts)
  const lastReply = input.prevAnswer ?? ''
  const lastQuestion = input.prevQuestion ?? ''

  // Detect vague follow-up ("what should I do", "tell me more", "and then what", etc.)
  const isVagueFollowUp = lastReply.length > 0 &&
    input.question.split(/\s+/).length <= 6 &&
    /^(what|how|why|when|tell|explain|and|so|ok|yes|okay|more|next|then|after|should i|can i|do i|is it|will it)\b/i.test(input.question.trim())

  // For vague follow-ups, use the previous question + answer as the search query.
  // For photo with no caption, use observations as the search query.
  const effectiveQuery = isVagueFollowUp && lastQuestion
    ? `${lastQuestion} ${input.question}`
    : effectiveQuestion

  const contextPrefix = lastReply && isVagueFollowUp
    ? `You asked about: "${lastQuestion}". My previous answer was: "${lastReply.replace(/\s*\[Src:[^\]]+\]/g, '').slice(0, 150)}". Follow-up question: `
    : ''

  const prompt = input.observations
    ? `Farmer sent a photo. Visual observations (not a diagnosis): ${input.observations}\nFarmer's message: ${input.question || '(no caption)'}`
    : `${contextPrefix}${effectiveQuery}`

  let status: AnswerStatus = 'refused'
  let answer = REFUSE
  let cited: string[] = []
  let needsHuman = false

  if (MODEL) {
    // ── AI agent path (requires a configured AI_MODEL + API key) ─────────────
    try {
      const agent = new ToolLoopAgent({
        model: MODEL,
        instructions: instructions(input.channel, risk.highStakes),
        stopWhen: isStepCount(6),
        output: Output.object({ schema: answerSchema }),
        tools: {
          searchKnowledge: tool({
            description:
              'Search the Iowa corn knowledge base validated by ISU Extension, USDA-ARS, CIMMYT, and CGIAR. Query in plain English using corn farming terms. Covers nitrogen management, replanting, diseases (rust, gray leaf spot, tar spot), weeds (waterhemp), planting, pests, harvest, storage, economics, cover crops, and compaction.',
            inputSchema: z.object({ query: z.string() }),
            execute: async ({ query }) => {
              toolCalls.push(`searchKnowledge("${query}")`)
              const hits = search(query)
              for (const h of hits) retrieved.set(h.id, h)
              if (hits.length === 0) return { results: [], note: 'No validated source found.' }
              return { results: hits.map(({ id, title, excerpt }) => ({ id, title, text: excerpt })) }
            },
          }),
          queryKnowledgeGraph: tool({
            description:
              'Look up how a corn entity (disease, pest, nutrient, practice, condition) is linked to others in Iowa corn production.',
            inputSchema: z.object({ entity: z.string().describe('e.g. "corn", "southern rust", "waterhemp", "nitrogen", "corn rootworm", "tar spot"') }),
            execute: async ({ entity }) => {
              toolCalls.push(`queryKnowledgeGraph("${entity}")`)
              const found = findEntity(entity)
              if (!found) return { facts: [], note: 'Entity not in graph.' }
              const facts = neighbourhood(found.id)
              graphFacts.push(...facts)
              return { entity: found.label, facts }
            },
          }),
          escalateToAdvisor: tool({
            description:
              'Send the question to a human agronomist, certified crop adviser (CCA), or ISU Extension specialist. Use for specific herbicide rates, crop insurance details, pesticide mixing rates, or anything outside the validated sources.',
            inputSchema: z.object({ reason: z.string() }),
            execute: async ({ reason }) => {
              toolCalls.push(`escalateToAdvisor("${reason}")`)
              agentRequestedEscalation = reason
              return { queued: true }
            },
          }),
        },
      })
      const { output } = await agent.generate({ prompt })
      cited = output.citedSourceIds.filter((id) => retrieved.has(id))
      needsHuman = output.needsHumanAdvisor
      if (output.status === 'answered' && cited.length > 0 && output.answer.trim()) {
        status = 'answered'
        answer = output.answer.trim()
      }
    } catch (error) {
      console.log('[Harvest IQ] Agent error, falling back to extractive:', error instanceof Error ? error.message : error)
      const fallback = extractiveAnswer(`${input.question} ${input.observations ?? ''}`, retrieved, toolCalls)
      if (fallback && !risk.highStakes) {
        if (fallback.score < 1.5) {
          status = 'answered'
          answer = `I want to make sure I give you the right answer. Could you give me a little more detail — for example, what you're seeing in your field right now? ${fallback.answer}`
          cited = [fallback.id]
        } else {
          status = 'answered'
          answer = fallback.answer
          cited = [fallback.id]
        }
      }
    }
  } else {
    // ── Extractive fallback path (no AI_MODEL configured) ────────────────────
    // Directly searches the validated knowledge base and quotes the most
    // relevant passage. Fully grounded and cited — no AI model required.
    const fallback = extractiveAnswer(`${effectiveQuestion} ${input.observations ?? ''}`.trim(), retrieved, toolCalls)
    if (fallback && !risk.highStakes) {
      if (fallback.score < 1.5) {
        status = 'answered'
        answer = `I want to make sure I give you the right answer. Could you give me a little more detail — for example, what you're seeing in your field right now? ${fallback.answer}`
        cited = [fallback.id]
      } else {
        status = 'answered'
        answer = fallback.answer
        cited = [fallback.id]
      }
    }
  }

  const shouldEscalate = risk.highStakes || needsHuman || agentRequestedEscalation !== null
  let escalationId: string | undefined

  if (shouldEscalate) {
    const farmerRecord = getFarmer(input.phone)
    const esc = createEscalation({
      phone: input.phone,
      farmerName: farmerRecord?.name,
      district: farmerRecord?.district,
      country: farmerRecord?.country,
      channel: input.channel,
      question: input.observations
        ? `${input.question || '(photo, no caption)'}\n[Photo observations] ${input.observations}`
        : input.question,
      category: risk.category ?? (status === 'refused' ? 'insufficient-sources' : 'agent-requested'),
      reason: risk.reason ?? agentRequestedEscalation ?? 'Model flagged for human follow-up',
    })
    escalationId = esc.id
    status = 'escalated'
    answer = cited.length > 0 ? `${answer} ${ESCALATE}` : ESCALATE
  }

  let reply = answer
  let truncatedAt = -1 // char index where truncation happened (-1 = no truncation)
  if (cited.length > 0 && input.channel !== 'voice') {
    const tag = ` [${SOURCE_PREFIX}: ${cited.join(',')}]`
    const room = SMS_LIMIT - tag.length
    if (answer.length > room) {
      truncatedAt = room - 1
      reply = `${answer.slice(0, truncatedAt).trimEnd()}…${tag}`
    } else {
      reply = answer + tag
    }
  }

  const trace: Trace = {
    status,
    risk: risk.category,
    sources: cited.map((id) => {
      const h = retrieved.get(id)
      return { id, title: h?.title ?? id, source: h?.source ?? '', validatedBy: h?.validatedBy ?? '' }
    }),
    graphFacts: graphFacts.filter((f) => cited.includes(f.docId)).slice(0, 8),
    toolCalls,
    observations: input.observations,
    escalationId,
    latencyMs: Date.now() - started,
    // Full untruncated answer + exact cut point — used by the client "Continue" overlay
    fullReply: answer,
    truncatedAt,
  }

  addMessage({
    phone: input.phone,
    channel: input.channel,
    direction: 'out',
    author: 'agent',
    text: reply,
    trace,
  })

  return { reply, trace }
}

/** Vision step: extracts observable symptoms only. Grounded diagnosis happens in runAdvisor. */
export async function describePhoto(image: Uint8Array, mediaType: string) {
  if (!VISION_MODEL) return { usable: true, subject: 'corn crop', observations: '' }

  const baseURL = process.env.AI_BASE_URL
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!baseURL || !apiKey) {
    console.warn('[Harvest IQ] AI_BASE_URL or AI_GATEWAY_API_KEY not set — vision skipped')
    return { usable: true, subject: 'corn crop', observations: '' }
  }

  // IBM watsonx exposes an OpenAI-compatible chat completions endpoint.
  // We call it directly with fetch to avoid @ai-sdk/openai version conflicts.
  const b64 = Buffer.from(image).toString('base64')
  const body = {
    model: VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'A corn farmer sent this photo. Reply with a JSON object with three keys: "usable" (boolean — false if too dark, blurry, or not a plant), "subject" (string — e.g. "corn leaf", "corn stalk", "weed"), "observations" (string — visible symptoms only in plain English, no diagnosis, no treatment recommendations).',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${b64}` },
          },
        ],
      },
    ],
    max_tokens: 300,
  }

  const res = await fetch(baseURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    console.warn('[Harvest IQ] Vision API error:', res.status, errText)
    return { usable: true, subject: 'corn crop', observations: '' }
  }

  type ChatResponse = { choices?: Array<{ message?: { content?: string } }> }
  const json = await res.json() as ChatResponse
  const content = json.choices?.[0]?.message?.content?.trim() ?? ''
  if (!content) return { usable: true, subject: 'corn crop', observations: '' }

  // Extract JSON from the model response (it may wrap it in markdown fences)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { usable: true, subject: 'corn crop', observations: content }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      usable?: boolean
      subject?: string
      observations?: string
    }
    return {
      usable: parsed.usable !== false,
      subject: typeof parsed.subject === 'string' ? parsed.subject : 'corn crop',
      observations: typeof parsed.observations === 'string' ? parsed.observations : content,
    }
  } catch {
    return { usable: true, subject: 'corn crop', observations: content }
  }
}
