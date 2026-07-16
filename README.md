# Cognitive Ambulance System: Real-Time Spatial Routing & AI Dispatch
*(Project Codename: Golden Minutes)*

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
[![PostGIS](https://img.shields.io/badge/PostGIS-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)
[![Groq](https://img.shields.io/badge/Groq_LLaMA_3.1-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)

An intelligent, multi-tier emergency dispatch platform engineered to eliminate the "fatal latency" of traditional ambulance hailing. Utilizing ride-hailing style spatial routing algorithms, PostGIS telemetry, and Groq-powered Agentic AI, this system autonomously categorizes emergencies, dynamically routes to the most optimized hospital, and dispatches nearby verified Community First Responders (CFRs).

## 🚀 Core Architecture & Features

*   **🎙️ Agentic AI Voice Dispatch (Multi-Lingual):** Leverages `Groq LLaMA-3.1-8b-instant` and Whisper to transcribe and autonomously classify emergency intents from raw voice audio, enabling instant, zero-touch SOS triggers.
*   **🗺️ Smart Rank Spatial Routing:** Replaces standard proximity searches with an optimized algorithm utilizing PostGIS. It scores hospitals based on live ETA (via OSRM), trauma specialty match percentages, and facility tiering to find the optimal destination.
*   **📡 Real-Time CFR Telemetry:** Uses Supabase WebSockets (`postgres_changes`) to create a live broadcast pager system. Pings verified medical responders within a 2km radius of the incident with exact GPS coordinates and routing instructions.
*   **🏥 HPAP (Hospital Pre-Arrival Preparation):** Securely bundles the victim's JSONB medical profile (Blood Type, Allergies, Chronic Conditions) and POSTs it to a serverless Edge Function the millisecond an ambulance is dispatched, simulating ER pre-activation.
*   **🔗 Cryptographic Contact Verification:** Bypasses vulnerable OTP loops using a stateless "Magic Link" architecture, utilizing device-native SMS payloads to securely verify emergency contacts via deep-linked serverless functions.
*   **🤖 Generative First-Aid Coach:** While awaiting the ambulance, the app generates ultra-low-latency, incident-specific triage steps via the Groq API to guide bystanders in stabilizing the victim.

## 🛠️ Tech Stack

*   **Frontend:** React Native, Expo, TypeScript, React Native Maps
*   **Backend / Database:** Supabase, PostgreSQL, PostGIS (Geospatial querying)
*   **Serverless:** Supabase Edge Functions (Deno)
*   **AI / LLM:** Groq API (LLaMA-3.1, Whisper)
*   **APIs:** OSRM (Open Source Routing Machine), Expo Location, Expo SMS

## ⚙️ Installation & Setup

To run this project locally, you will need Node.js, Expo CLI, and a Supabase project configured with the PostGIS extension.

**1. Clone the repository**
\`\`\`bash
git clone https://github.com/yourusername/agentic-ambulance.git
cd agentic-ambulance
\`\`\`

**2. Install dependencies**
\`\`\`bash
npm install
# Or use Expo CLI for exact versions
npx expo install
\`\`\`

**3. Configure Environment Variables**
Create a \`.env\` file in the root directory and add your API keys:
\`\`\`env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
\`\`\`

**4. Database Setup (Supabase SQL Editor)**
Ensure the \`postgis\` extension is enabled in your database. Run the included \`schema.sql\` (located in the \`/docs\` folder) in your Supabase SQL editor to generate the \`profiles\` and \`emergencies\` tables, establish the JSONB medical profile structures, and define the geospatial \`POINT\` columns.

**5. Start the Application**
\`\`\`bash
npx expo start -c
\`\`\`
*Scan the generated QR code with the Expo Go app on your physical iOS/Android device to test the native SMS and Location APIs.*

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. Prepared for technical review and academic publication.
