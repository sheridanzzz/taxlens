# AI backups

Ledgr uses Gemini 3.5 Flash first, then Qwen 3.8 27B on Groq. Independent
Cloudflare backups are GPT-OSS 120B for text, Gemma 4 for text/images, and
Mistral Small 3.1 for text. The existing Google Flash Lite and Gemma models
remain last in the chain. The Cloudflare Mistral endpoint is treated as text
only; image scans retain their images and skip text-only endpoints.

Unconfigured providers are skipped. Each model has a timeout, failed models
cool down for a minute, and empty answers advance to the next model. Normal
calls have a 45-second overall limit. The Airtail shortlist keeps its tighter
22-second limit and returns clearly labelled rules if AI cannot finish.

## Production setup

The private Worker lives in `cloudflare/ai-backup`. `vercel.json` supplies its
base URL, `https://ledgr-ai-backup.sheridan-portfolio.workers.dev/v1`. No
Cloudflare account token is stored in Vercel or sent to the browser.

The server uses `CLOUDFLARE_AI_API_KEY` when set; otherwise it derives a key
using HMAC-SHA256 with `AUTH_SECRET` and the purpose `ledgr:cloudflare-ai:v1`.
Store that derived key as the Worker's `LEDGR_API_KEY` secret. Update the
Worker secret whenever that auth secret or optional explicit key is rotated.
For another environment, deploy a separate Worker and register its URL/key.

The bridge accepts only the three models above, bounds requests to 4 MiB
and 7,000 output tokens, and limits authenticated traffic to 20 requests per
minute per Cloudflare location. It does not enable request logging. Models
requiring paid billing, such as the latest DeepSeek/Kimi/GLM endpoints, are
excluded. Workers AI's daily free allocation is shared with other Workers on
the account; actual billing follows the account's Workers plan.

Receipt suggestions still require review. Connecting Airtail, retrieving
receipts and running AI create no expenses or deductions.

## Verification

`npm run check` includes failure, empty-output, timeout, cooldown, image-routing
and private-bridge checks. Production smoke checks use synthetic receipt
summaries/images, rather than sending real email evidence to additional models.
Check the connected owner's original Gmail/Yahoo emails separately through
Ledgr's authenticated connector routes.

Official references: [Cloudflare models](https://developers.cloudflare.com/workers-ai/models/),
[pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/),
and [data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/).
