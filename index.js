import Fastify from "fastify";
import FastifyWS from "@fastify/websocket";
import FastifyFormBody from "@fastify/formbody";
import WebSocket from "ws";

const SYSTEM_PROMPT = `You are a virtual leasing assistant for Astra Living, helping prospective tenants find apartments at The Cornerstone and Petro Fina Residences in downtown Calgary. Be upfront immediately that you're a virtual assistant. Be efficient, friendly, and direct. Keep the conversation moving. Do not use any tools or attempt to call any external systems.

OPENING LINE: "Hi, thanks for calling Astra Living! I'm a virtual assistant here to help you find your next home and get you connected with our team. What are you looking for?"

COMMUNICATION STYLE:
- Short, natural responses. No speeches.
- Ask one question at a time.
- Never repeat information already given.
- Don't over-thank or over-apologize. Keep it moving.
- Slightly upbeat but not cheesy.

QUALIFICATION ORDER (one at a time, skip if already answered):
1. Which property - Petro Fina, The Cornerstone, or both
2. Bedroom count
3. Move-in timeline
4. Monthly budget
5. Name
6. Email address
7. Phone number
8. Pets (only ask if not already mentioned)

PROPERTY 1: THE CORNERSTONE
Address: 909 5th Avenue SW, Calgary West End
AVAILABLE UNITS:
- Unit 606 Sandstone: 2 bed/1 bath, 846 sqft, $2300/mo, heat and water included, available immediately
- Unit 610 Ammolite: 2 bed/1 bath, 653 sqft, $1800/mo, heat and water included, available immediately
- Unit 508 Jasper: 3 bed/1 bath, 928 sqft, $2400/mo, heat and water included, available immediately
- Unit 513 Jade: 3 bed/1 bath, 950 sqft, $2500/mo, heat and water included, available immediately
FEATURES: Elevator, AC, in-suite laundry, dishwasher, balcony with city views, high ceilings, quartz counters
PARKING: Underground at $275/month extra. PETS: Dogs and cats negotiable. Non-smoking.
PROMOTION: Limited-time seasonal reduced rates on select suites.

PROPERTY 2: PETRO FINA RESIDENCES
Address: 736 8 Avenue SW, Calgary Connaught
AVAILABLE UNITS:
- Unit 309 Type B: 3 bed/2 bath, 1058 sqft, $2800/mo, heat and water included, available immediately
- Unit 306 Type B2: 3 bed/2 bath, 1164 sqft, $2800/mo, heat and water included, available immediately
- Unit 305 Type C: 3 bed/2 bath, 1135 sqft, $2800/mo, heat and water included, available immediately
- Unit 303 Type E: 3 bed/2 bath, 1172 sqft, $2800/mo, heat and water included, available immediately
- Unit 301 Type G Work/Live: 3 bed/2 bath, 1242 sqft, $3400/mo, heat and water included, available immediately
- Unit 1104 Penthouse J: 2 bed/2 bath, 1050 sqft, $3500/mo, heat and water included, available immediately
- Unit 1102 Penthouse K: 2 bed/2 bath, 1000 sqft, $3500/mo, heat and water included, available immediately
- Unit 302 Type F2: 2 bed/2 bath, 918 sqft, $2400/mo, heat and water included, available immediately
- Unit 710 Type D Accessible: 2 bed/1 bath, 853 sqft, $2150/mo, heat and water included, available immediately
FEATURES: Elevator, AC, in-suite laundry, dishwasher, balcony with city and mountain views, raised ceilings, quartz counters, triple-pane windows, walk-in closets, stainless steel appliances, secure keyless entry
BUILDING: Staffed security, party room, bike room, tenant lounge, rooftop patios, free WiFi in common areas
PARKING: No on-site parking. PETS: Dogs and cats negotiable. Non-smoking.
LOCATION: Direct plus-15 to UCalgary, steps from CTrain, near CORE Shopping, Eau Claire, Bow River.
PROMOTION: Free rent and move-in bonuses on select suites.

END GOALS - Every call ends with one of these:

OPTION 1 - BOOK A TOUR:
Tours available Monday to Friday 9am to 5pm. Collect preferred day and time.
If outside hours say we can try to accommodate and the team will confirm.
If out of town offer a virtual tour.
Say: "Perfect, our leasing team will reach out to confirm and send a calendar invite to your email."
Do NOT use any tools or book anything yourself.

OPTION 2 - CALLBACK OR EMAIL:
Ask if they prefer a call back or email. Collect contact details.
Say: "Our team will be in touch within one business day."

CLOSING: "Great, we will be in touch soon. Thanks for calling Astra Living!"
IF HESITANT: "No pressure, I can just have someone reach out with more info."
COMPLIANCE: Never approve or reject applicants. Never ask about protected characteristics. No legal advice.
ESCALATION: If frustrated or wants human, collect contact info and say someone will reach out directly.`;

const XAI_API_KEY = process.env.XAI_API_KEY;
const PORT = process.env.PORT || 8080;

const app = Fastify({ logger: false });
await app.register(FastifyFormBody);
await app.register(FastifyWS);

app.get("/", async () => ({ status: "Astra Living Voice Agent Running" }));

app.post("/incoming", async (req, reply) => {
  const host = req.headers.host;
  console.log(`[INCOMING] Call received, host: ${host}`);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/stream" />
  </Connect>
</Response>`;
  reply.header("Content-Type", "text/xml");
  return reply.send(twiml);
});

app.register(async (fastify) => {
  fastify.get("/stream", { websocket: true }, (twilioWS) => {
    let grokWS = null;
    let streamSid = null;
    let greeted = false;
    let audioDeltaCount = 0;

    console.log("[STREAM] Twilio WebSocket connected");

    grokWS = new WebSocket(
      "wss://api.x.ai/v1/realtime?model=grok-voice-think-fast-1.0",
      { headers: { Authorization: `Bearer ${XAI_API_KEY}` } }
    );

    grokWS.on("open", () => {
      console.log("[GROK] WebSocket connected to xAI");
      grokWS.send(JSON.stringify({
        type: "session.update",
        session: {
          voice: "ara",
          instructions: SYSTEM_PROMPT,
          turn_detection: {
            type: "server_vad",
            threshold: 0.85,
            silence_duration_ms: 600,
            prefix_padding_ms: 333,
          },
          tools: [],
          audio: {
            input:  { format: { type: "audio/pcmu" } },
            output: { format: { type: "audio/pcmu" } },
          },
        },
      }));

      // Trigger greeting after session is set up
      setTimeout(() => {
        if (!greeted) {
          greeted = true;
          console.log("[GROK] Triggering opening greeting");
          grokWS.send(JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: "Hello" }],
            },
          }));
          grokWS.send(JSON.stringify({ type: "response.create" }));
        }
      }, 1000);
    });

    grokWS.on("message", (data) => {
      let event;
      try {
        event = JSON.parse(data.toString());
      } catch {
        return;
      }

      // Log every event type so we can debug
      if (event.type !== "response.output_audio.delta") {
        console.log(`[GROK EVENT] ${event.type}${event.error ? " ERROR: " + JSON.stringify(event.error) : ""}`);
      }

      // Audio from Grok → send to Twilio caller
      if (event.type === "response.output_audio.delta") {
        audioDeltaCount++;
        if (audioDeltaCount === 1) {
          console.log("[GROK] First audio delta received - sending to Twilio");
        }
        if (streamSid && twilioWS.readyState === 1) {
          twilioWS.send(JSON.stringify({
            event: "media",
            streamSid,
            media: { payload: event.delta },
          }));
        } else {
          console.log(`[WARN] Audio delta but streamSid=${streamSid}, twilioWS.readyState=${twilioWS.readyState}`);
        }
      }

      // Log transcript so we can see what Grok is saying
      if (event.type === "response.output_audio_transcript.delta") {
        process.stdout.write(event.delta);
      }
      if (event.type === "response.output_audio_transcript.done") {
        console.log("\n[GROK TRANSCRIPT DONE]");
      }

      if (event.type === "response.done") {
        console.log(`[GROK] Response done. Total audio deltas sent: ${audioDeltaCount}`);
        audioDeltaCount = 0;
      }
    });

    grokWS.on("error", (err) => console.error("[GROK ERROR]", err.message));
    grokWS.on("close", (code, reason) => console.log(`[GROK] Closed: ${code} ${reason?.toString()}`));

    twilioWS.on("message", (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.event === "connected") {
        console.log("[TWILIO] Media stream connected");
      }

      if (msg.event === "start") {
        streamSid = msg.start.streamSid;
        console.log(`[TWILIO] Stream started. streamSid: ${streamSid}`);
        console.log(`[TWILIO] Encoding: ${msg.start?.mediaFormat?.encoding}, SampleRate: ${msg.start?.mediaFormat?.sampleRate}`);
      }

      if (msg.event === "media") {
        if (grokWS?.readyState === WebSocket.OPEN) {
          grokWS.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: msg.media.payload,
          }));
        }
      }

      if (msg.event === "stop") {
        console.log("[TWILIO] Stream stopped");
        grokWS?.close();
      }
    });

    twilioWS.on("close", () => {
      console.log("[TWILIO] WebSocket closed");
      grokWS?.close();
    });

    twilioWS.on("error", (err) => console.error("[TWILIO ERROR]", err.message));
  });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`[SERVER] Running on port ${PORT}`);
