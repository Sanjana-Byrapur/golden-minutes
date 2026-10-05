# 🚑 Cognitive Ambulance System: Real-Time Spatial Routing & AI Dispatch

### Project Codename: Golden Minutes

[![React Native](https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
[![PostGIS](https://img.shields.io/badge/PostGIS-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgis.net/)
[![Groq](https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)

Golden Minutes is an intelligent, real-time emergency dispatch application designed to reduce the time between an emergency occurring and help being dispatched.

The application combines AI-powered voice emergency detection, GPS location tracking, spatial hospital recommendation, Community First Responder (CFR) dispatch, real-time updates, emergency contact notification, and AI-powered first-aid guidance.

---

# 🚀 Core Features

## 🎙️ AI Voice Emergency Detection

The application allows users to describe an emergency using their voice.

The voice pipeline is:

```text
User speaks
     ↓
Expo Audio
     ↓
Audio Recording
     ↓
Groq Whisper
     ↓
Speech-to-Text
     ↓
Groq LLM
     ↓
Emergency Classification
     ↓
Emergency Dispatch Workflow
```

The system can identify emergency categories such as:

- Cardiac emergencies
- Trauma / Accidents
- Stroke
- Choking
- Severe bleeding
- Burns
- Seizures
- Unconsciousness

---

## 🗺️ Smart Spatial Routing

Hospitals are recommended using location-aware ranking.

The system considers factors such as:

- Distance
- Estimated travel time
- Emergency / specialty matching
- Hospital tier
- Hospital ranking

OSRM is used for route and ETA calculations.

---

## 📍 Real-Time Location Tracking

The application:

- Obtains the user's current GPS location.
- Displays the user's location on the map.
- Shares emergency location with relevant responders.
- Displays responder and victim locations when applicable.

---

## 🗺️ Map & Routing

The application uses:

- `react-native-maps`
- OpenStreetMap / CARTO map tiles
- Expo Location
- OSRM

The current project is configured for **Expo SDK 57** and uses CARTO-based map tiles for the current Expo Go setup.

The map can display:

- User location
- Responder location
- Victim location when applicable
- Routing information

OSRM is used for route and ETA calculations.

---

## 📡 Real-Time Community First Responder (CFR) Dispatch

Verified Community First Responders can receive nearby emergency alerts.

The CFR workflow is:

```text
Emergency Triggered
        ↓
Emergency Stored in Supabase
        ↓
Nearby CFRs Notified
        ↓
CFR Receives Emergency
        ↓
CFR Accepts / Rejects
        ↓
Victim Location Displayed
        ↓
CFR Travels Toward Victim
```

CFRs can:

- Receive emergency alerts.
- View the victim's location.
- Accept or reject an emergency.
- View distance and estimated arrival information.
- Navigate toward the victim.

---

## 🏥 Smart Hospital Recommendation

Hospitals are recommended using location and emergency-related information.

The general workflow is:

```text
User GPS Location
        ↓
Supabase / PostGIS
        ↓
Nearby Hospitals
        ↓
Emergency Specialty Matching
        ↓
Hospital Ranking
        ↓
OSRM Route Calculation
        ↓
Distance + ETA
        ↓
Recommended Hospital
```

The system considers:

- Distance
- Estimated travel time
- Emergency / specialty matching
- Hospital tier
- Ranking information

---

## 🏥 Hospital Pre-Arrival Preparation

The system supports hospital pre-arrival preparation through Supabase backend functionality.

Relevant emergency information can be sent when an emergency dispatch is initiated, allowing the hospital-side workflow to be prepared in advance.

---

## 🩺 AI First-Aid Coach

While the user waits for emergency services, the application provides emergency-specific first-aid guidance using the Groq API.

The aim is to provide short and actionable instructions appropriate to the detected emergency.

---

## 📱 Emergency Contact SMS

The application can send an SOS message containing emergency information and location details to the configured emergency contact.

The SMS functionality uses the device's native SMS capabilities.

---

# 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Mobile Application | React Native |
| Framework | Expo SDK 57 |
| Language | TypeScript |
| Navigation | Expo Router |
| Maps | React Native Maps + OpenStreetMap/CARTO |
| Location | Expo Location |
| Audio | Expo Audio |
| Speech-to-Text | Groq Whisper |
| AI / LLM | Groq API |
| Backend | Supabase |
| Database | PostgreSQL |
| Geospatial Database | PostGIS |
| Real-Time Updates | Supabase Realtime |
| Serverless Functions | Supabase Edge Functions |
| Routing / ETA | OSRM |
| SMS | Expo SMS |

---

# ⚙️ Installation & Setup

## 1. Prerequisites

Before running the project, make sure the following are installed.

### Git

Download and install Git from:

https://git-scm.com/downloads

Verify the installation:

```bash
git --version
```

### Node.js

Install the **Node.js LTS version** from:

https://nodejs.org/

Verify the installation:

```bash
node --version
npm --version
```

### Expo Go

Install **Expo Go** on your Android or iOS device.

This project currently uses **Expo SDK 57**.

---

## 2. Clone the Repository

Open PowerShell, Command Prompt, Terminal, or Git Bash and run:

```bash
git clone https://github.com/Sanjana-Byrapur/golden-minutes.git
```

Move into the project directory:

```bash
cd golden-minutes
```

---

## 3. Install Dependencies

Run:

```bash
npm install
```

The repository contains:

- `package.json`
- `package-lock.json`

These files define the required project dependencies.

> This is an Expo / React Native project, so a Python `requirements.txt` file is not required.

---

## 4. Configure Environment Variables

Create a file named:

```text
.env
```

in the root directory of the project.

Add the required environment variables:

```env
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_CARTO_KEY=your_carto_key
EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1
```

Replace the placeholder values with the appropriate credentials.

### Environment Variables Used

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_GROQ_API_KEY` | Groq AI and Whisper functionality |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase frontend connection |
| `EXPO_PUBLIC_CARTO_KEY` | CARTO map configuration |
| `EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK` | Expo Router configuration |

### Important

The `.env` file is for local configuration and should **not** be committed to GitHub.

Do not share or commit a Supabase **service-role / secret key**.

Only the Supabase URL and anon/public key should be used by the frontend.

---

# 🗄️ Supabase Backend

Golden Minutes uses a hosted Supabase backend for:

- User profiles
- Emergency records
- Hospital information
- Geospatial queries
- Real-time emergency updates
- Backend functionality

Cloning the GitHub repository does **not** create a new Supabase database.

The application connects to the configured Supabase project using the Supabase URL and anon/public key.

Therefore, when another developer clones the project, they need the appropriate Supabase connection values in their local `.env` file, unless those values are already configured directly in the project.

The existing hosted Supabase project can continue to be used by the cloned application.

> A new Supabase project would require the database schema, PostGIS configuration, functions, policies, Realtime configuration, and backend functions to be recreated separately.

---

# 🤖 AI Configuration

The application uses the Groq API for AI functionality including:

- Speech-to-text using Whisper
- Emergency classification
- AI-powered first-aid guidance

Configure the Groq API key in `.env`:

```env
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
```

The API key should not be committed to GitHub.

---

# 🗺️ Map Configuration

The current application uses:

- React Native Maps
- OpenStreetMap / CARTO map tiles
- Expo Location
- OSRM

The current project is configured for **Expo SDK 57**.

The CARTO-based map configuration is used for the current Expo Go setup.

The application can display:

- User location
- Responder location
- Victim location when applicable
- Routing information

OSRM is used for route and ETA calculations.

---

# ▶️ Running the Application

After configuring the `.env` file, start the development server:

```bash
npx expo start -c
```

The `-c` option clears the Metro bundler cache.

A QR code will appear in the terminal.

Scan the QR code using Expo Go on your physical device.

---

## Android

1. Install Expo Go on your Android phone.
2. Connect the phone and computer to the same Wi-Fi network.
3. Start the application:

```bash
npx expo start -c
```

4. Scan the QR code using Expo Go.

---

## iOS

1. Install Expo Go on your iPhone.
2. Connect the phone and computer to the same Wi-Fi network.
3. Start the application:

```bash
npx expo start -c
```

4. Scan the QR code using Expo Go.

---

## If the QR Code Does Not Connect

Make sure:

- The phone and computer are connected to the same network.
- The Expo development server is running.
- The firewall is not blocking the connection.

You can also use Expo tunnel mode:

```bash
npx expo start --tunnel
```

Then scan the newly generated QR code.

---

# 🔐 Required Permissions

Depending on the functionality being used, the application may request permission for:

- Location
- Microphone
- SMS

Allow the required permissions for the corresponding features to work correctly.

---

# 📂 Project Structure

```text
golden-minutes/
│
├── app/
│   ├── (tabs)/
│   │   └── index.tsx
│   └── _layout.tsx
│
├── assets/
│   └── images/
│
├── components/
│
├── hooks/
│
├── constants/
│
├── scripts/
│
├── supabase/
│   └── functions/
│
├── app.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── .gitignore
└── README.md
```

---

# 🧪 Useful Development Commands

### Start the project

```bash
npx expo start
```

### Start with cache cleared

```bash
npx expo start -c
```

### Start using a tunnel

```bash
npx expo start --tunnel
```

### Install dependencies

```bash
npm install
```

### Check Expo project compatibility

```bash
npx expo-doctor
```

### Check Expo CLI version

```bash
npx expo --version
```

### Run linting

```bash
npm run lint
```

---

# 🔄 Updating an Existing Clone

If the project has already been cloned, there is no need to clone it again.

Run:

```bash
cd golden-minutes
git pull origin main
npm install
```

Then start the project:

```bash
npx expo start -c
```

If the `.env` file already exists on the computer, it does not need to be recreated.

---

# ⚠️ Important Project Notes

## Expo SDK Version

This project currently uses:

```text
Expo SDK 57
React Native 0.86
```

Avoid upgrading Expo automatically unless the project is intentionally migrated to a newer SDK.

Check the Expo CLI version:

```bash
npx expo --version
```

Check project compatibility:

```bash
npx expo-doctor
```

---

## Environment Variables

Never commit sensitive credentials to GitHub.

Do not commit:

- `.env`
- Groq API keys
- Supabase service-role / secret keys
- Private credentials
- Other private API credentials

Before pushing changes to GitHub, check:

```bash
git status
```

Make sure `.env` and other sensitive files are not staged.

The Supabase anon/public key is intended for frontend use, but the database should have appropriate access policies configured.

---

# 🚀 Quick Start

For a developer who already has Git, Node.js, and Expo Go installed:

```bash
git clone https://github.com/Sanjana-Byrapur/golden-minutes.git
cd golden-minutes
npm install
```

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_CARTO_KEY=your_carto_key
EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1
```

Then start the application:

```bash
npx expo start -c
```

Scan the generated QR code using Expo Go.

---

# 📄 License

This project is licensed under the MIT License.
Prepared for technical review and academic purposes.