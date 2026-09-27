import { AIRenderError } from './openai-image-render.js';
import type { ImageStudy } from './image-studio-contract.js';
import type { ImageStudioProviderOptions } from './image-studio-provider.js';

/** Michaels' Weave split: content describes the subject; scenic direction owns
 * light, colour and photographic treatment. Never rewrite the latter implicitly. */
export async function assistPrompt(study: ImageStudy, instruction: string, options: ImageStudioProviderOptions & { suggestModel?: string }) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIRenderError(503, 'Prompt assistance is not configured on this server.');
  const model = options.suggestModel ?? process.env.OPENAI_SUGGEST_MODEL ?? 'gpt-5-mini';
  const response = await (options.fetchImpl ?? fetch)('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({ model, store: false, max_output_tokens: 4096,
      instructions: `You are a NAMCHE editorial art director helping someone iterate an image prompt. Return an improved CONTENT prompt and a short explanation of your changes. Preserve the user's intent and concrete subjects. Write the content prompt in English and the explanation in the user's language. Treat the supplied scenic prompt as fixed art direction, not something to replace. Keep the content complementary: no contradictory light, colour or style directions. For photographs, specify subject, action, viewpoint, framing, spatial relationships and the one decisive visual detail. Keep it concrete and economical. Hestia uses hard red chiaroscuro and dark screens; Filter uses diffuse warm silhouettes on cool blue-violet, never a rainbow heat map; Close-ups use tactile gestures, intimate crops, grain and shallow focus. For 3D Metaball, describe material identity, palette, characteristic real microstructure and finish, never substitute generic coral-like nubs for a material's own forms. Do not change the sculpture's topology or camera. Do not generate an image. Maximum content length ${study.object ? 1200 : 6000} characters.`,
      input: JSON.stringify({ studio: study.object ? '3D Metaball' : study.variant, content: study.scene, scenic: study.style, instruction }),
      text: { format: { type: 'json_schema', name: 'prompt_suggestion', strict: true,
        schema: { type: 'object', additionalProperties: false, required: ['content', 'explanation'], properties: { content: { type: 'string' }, explanation: { type: 'string' } } } } },
    }),
  });
  if (!response.ok) throw new AIRenderError(response.status === 429 ? 429 : 502, 'Prompt assistant could not complete this request.');
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = payload.output_text ?? payload.output?.flatMap(item => item.content ?? []).map(part => part.text ?? '').join('');
  let value: { content?: unknown; explanation?: unknown };
  try { value = JSON.parse(text ?? '') as typeof value; } catch { throw new AIRenderError(502, 'Prompt assistant returned no usable suggestion.'); }
  if (!value || typeof value.content !== 'string' || !value.content.trim() || value.content.length > (study.object ? 1200 : 6000) || typeof value.explanation !== 'string' || value.explanation.length > 3000) throw new AIRenderError(502, 'Prompt assistant returned an invalid suggestion.');
  return { content: value.content.trim(), explanation: value.explanation, model };
}
