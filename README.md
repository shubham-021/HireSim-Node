## HireSimTS Backend

HireSimTS is the realtime hiring backend that powers the AI interviewer experience. It authenticates talent with Clerk, ingests their resumes, synthesizes a tailored interview script with LangGraph + OpenAI, and streams the conversation over WebSockets/WebRTC while persisting the full outcome for review.

### Highlights
- `Express` + `ws` server exposes REST APIs for resume management and websockets for live interview control.
- Authenticated endpoints use Clerk (`requireAuth`, `verifyUser`) to ensure every resume, interview, and score is tied to a verified candidate.
- Prisma models (`User`, `Resume`, `Interview`, `InterviewResponse`) store long-lived state in PostgreSQL.
- Resumes are parsed via `pdf-parse`, text-indexed, and the source files are stored on ImageKit for later retrieval.
- Scripts and interviewer personas are generated on-demand (`def_script`, `Entity`) using LangChain, LangGraph, and GPT-4o mini.
- The interviewer speaks through `@roamhq/wrtc` by converting LLM replies into PCM audio (`gpt-4o-mini-tts`) and streaming them to the browser while waiting for `user_response` events.
- After each session, structured scoring feedback is produced (`Entity.results`) and written back to the `Interview` tables for dashboards.

### Request & Realtime Flow
1. **User bootstrap**: `POST /api/create` ensures a Clerk user exists in PostgreSQL and captures profile metadata.
2. **Resume upload**: `POST /api/upload/resume` accepts PDFs, extracts text, uploads the binary to ImageKit, and persists metadata plus parsed text for prompt grounding.
3. **Resume access**: candidates can list (`GET /api/get/resumes/list`) and retrieve (`GET /api/resumes/:id`) their own files, enforced via Clerk auth checks.
4. **Interview start**:
   - Frontend opens a WebSocket, sends `init` with `{ userId, resumeId, role }`.
   - Backend retrieves resume text, creates a bespoke script (`def_script`), and acknowledges readiness.
   - Client shares WebRTC SDP (`offer`) and ICE candidates; backend answers via `PeerConnection`.
5. **Conversation loop**:
   - `Entity.invoke_graph` runs a LangGraph state machine that alternates interviewer turns with `interrupt` points that await `user_response` from the socket.
   - Each AI message is synthesized to PCM audio (`stream_audio`) and pushed into the WebRTC track so the candidate hears a natural voice.
6. **Completion**:
   - When the end-of-interview classifier fires, the backend compiles question/answer pairs, asks a reviewer model for scores/remarks, stores the result, and emits `{ type: "complete", data: interviewId }`.

### Core Components
- `src/app.ts` – Express app with CORS and JSON middleware.
- `src/routes.ts` – REST surface for user bootstrap, resume CRUD, and interview history fetches.
- `src/main.ts` – HTTP + WebSocket server bootstrap.
- `src/user_services/` – Prisma client, ImageKit integration, WebRTC peer connection wrapper, and the `Connection` orchestration class.
- `src/script.ts` & `src/prompts/` – Prompt builders used to derive interviewer scripts, end-of-interview checks, and reviewer grading instructions.
- `src/types/` – Zod schemas for LangGraph state, interviewer termination checks, and review output typing.

### Technology Stack
- Runtime: Node.js + Express 5, ws, WebRTC (`@roamhq/wrtc`)
- AI orchestration: LangChain, LangGraph, OpenAI GPT-4o mini (chat + TTS)
- Auth: Clerk (JWT middleware for REST, future token-based WS upgrade)
- Persistence: PostgreSQL via Prisma Client
- File storage: ImageKit for resume binaries and thumbnails
- Utilities: Multer, pdf-parse, uuid, dotenv/cors

### Required Configuration
- `CLERK_*` keys for REST authentication.
- `OPENAI_API_KEY` for chat, reviewer, and TTS models.
- `DATABASE_URL` for Prisma.
- `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` for resume storage.

