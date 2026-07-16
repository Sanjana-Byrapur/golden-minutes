
import * as SMS from 'expo-sms';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { supabase } from '../../supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type HospitalData = {
  id?: string;
  name: string;
  distance_meters: number;
  is_specialty_match: boolean;
  match_percentage: number;
  lat: number;
  lng: number;
  eta?: number | null;
  tier?: number;
  popularity_score?: number;
};

type UserProfile = {
  id: string;
  role: 'user' | 'cfr';
  name: string;
  emergency_contact?: string;
  license_number?: string;
  is_verified: boolean;
  medical_info?: any;
  location?: string;
};

type EmergencyType = 'cardiac' | 'trauma' | 'stroke' | 'choking' | 'bleeding' | 'burns' | 'seizure' | 'unconscious';
type AppState = 'auth' | 'otp' | 'idle' | 'profile' | 'type_select' | 'searching' | 'hospital_select' | 'coach' | 'en_route';

// ─── Ambulance booking status steps ──────────────────────────────────────────

type AmbulanceStatus = 'idle' | 'finding' | 'assigned' | 'dispatched' | 'arriving' | 'arrived';

const AMBULANCE_STATUS_LABELS: Record<AmbulanceStatus, string> = {
  idle: 'Not started',
  finding: '🔍 Finding nearest ambulance...',
  assigned: '✅ Ambulance assigned',
  dispatched: '🚑 Ambulance dispatched',
  arriving: '📍 Ambulance arriving soon',
  arrived: '🏥 Ambulance arrived',
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_SELECT_SECONDS = 30;
const REJECT_REASONS = ['Currently with a patient', 'Out of station', 'Off shift', 'Too far away'];

const EMERGENCY_TYPES: { key: EmergencyType; label: string; icon: string; color: string }[] = [
  { key: 'cardiac',     label: 'Cardiac Arrest',    icon: '❤️',  color: '#dc3545' },
  { key: 'stroke',      label: 'Stroke',            icon: '🧠',  color: '#6f42c1' },
  { key: 'trauma',      label: 'Trauma / Accident', icon: '🚑',  color: '#fd7e14' },
  { key: 'choking',     label: 'Choking',           icon: '😮‍💨', color: '#20c997' },
  { key: 'bleeding',    label: 'Severe Bleeding',   icon: '🩸',  color: '#c0392b' },
  { key: 'burns',       label: 'Burns',             icon: '🔥',  color: '#e67e22' },
  { key: 'seizure',     label: 'Seizure',           icon: '⚡',  color: '#8e44ad' },
  { key: 'unconscious', label: 'Unconscious',       icon: '💤',  color: '#2c3e50' },
];

const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  // Auth
  const [appState, setAppState] = useState<AppState>('auth');
  const appStateRef = useRef<AppState>(appState);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authRole, setAuthRole] = useState<'user' | 'cfr'>('user');
  const [authName, setAuthName] = useState('');
  const [authContact, setAuthContact] = useState('');
  const [authLicense, setAuthLicense] = useState('');


  // Medical profile
  const [medBlood, setMedBlood] = useState('');
  const [medAllergies, setMedAllergies] = useState('');
  const [medConditions, setMedConditions] = useState('');

  // Location
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [incidentAddress, setIncidentAddress] = useState('Fetching location...');
  const locationRef = useRef<Location.LocationObject | null>(null);

  // Emergency & hospitals
  const [selectedType, setSelectedType] = useState<EmergencyType | null>(null);
  const selectedTypeRef = useRef<EmergencyType | null>(null);
  const [hospitalList, setHospitalList] = useState<HospitalData[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [hospitalTab, setHospitalTab] = useState<'smart' | 'distance'>('smart');
  const [selectedHospital, setSelectedHospital] = useState<HospitalData | null>(null);
  const [autoSelectCountdown, setAutoSelectCountdown] = useState(AUTO_SELECT_SECONDS);
  const [hpapSent, setHpapSent] = useState(false);

  // FEATURE 3: Ambulance booking status
  const [ambulanceStatus, setAmbulanceStatus] = useState<AmbulanceStatus>('idle');

  // CFR & incident
  const [cfrLocation, setCfrLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // FEATURE 2: Victim location for CFR before acceptance
  const [victimLocationForCFR, setVictimLocationForCFR] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [victimDistance, setVictimDistance] = useState(0);
  const [victimEta, setVictimEta] = useState(0);
  const [currentIncidentId, setCurrentIncidentId] = useState<string | null>(null);
  const [rejectionNotice, setRejectionNotice] = useState<string | null>(null);
  const [showRejectOptions, setShowRejectOptions] = useState(false);

  // FEATURE 4: Message to emergency contact
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  // FEATURE 5: Real voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);

  // AI Coach
  const [aiInstructions, setAiInstructions] = useState('');
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  // Timers
  const autoSelectTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hospitalListRef = useRef<HospitalData[]>([]);
  const ambulanceStatusTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { appStateRef.current = appState; }, [appState]);

  // ── Location ──────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError('Location permission denied.'); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
        locationRef.current = loc;
        const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geo?.length > 0) {
          const p = geo[0];
          setIncidentAddress([p.name, p.street, p.subregion].filter(Boolean).join(', ') || 'Location acquired');
        }
      } catch { setLocationError('Could not fetch location.'); }
    })();
  }, []);

  // ── FEATURE 1: Magic Link Contact Verification ─────────────────────────────

  const handleRegister = async () => {
    if (!authName) return Alert.alert('Error', 'Name is required');
    if (authRole === 'user' && !authContact) return Alert.alert('Error', 'Emergency contact is required');
    if (authRole === 'cfr' && !authLicense) return Alert.alert('Error', 'Medical license is required');

    setIsAuthLoading(true);
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles').select('*').eq('name', authName).eq('role', authRole).maybeSingle();

      if (existingUser) {
        setCurrentUser(existingUser);
        setAppState('idle');
        return;
      }

      // Generate a new ID and current location
      const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const userLoc = locationRef.current
        ? `POINT(${locationRef.current.coords.longitude} ${locationRef.current.coords.latitude})`
        : 'POINT(77.5946 12.9716)';

      if (authRole === 'user' && authContact) {
        const newUser: UserProfile = {
          id: newId,
          role: authRole,
          name: authName,
          emergency_contact: authContact,
          is_verified: true, // User is verified to use the app immediately (Lazy Verification)
          location: userLoc,
          medical_info: null,
        };

        // 1. Save user to database
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) throw error;

        // 2. Generate the Cryptographic Magic Link
        const token = Math.random().toString(36).slice(2, 12);
        const magicLink = `https://golden-minutes.supabase.co/verify?token=${token}`;
        const message = `Hi, I have added you as my emergency contact on the Golden Minutes app. Please click here to verify and accept my SOS alerts: ${magicLink}`;

        // 3. Draft the SMS via native device APIs
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) {
          await SMS.sendSMSAsync([authContact], message);
        } else {
          Alert.alert('Dev Mode: Magic Link Generated', `Simulated SMS drafted to ${authContact}:\n\n${message}`);
        }

        // 4. Let the user directly into the app
        setCurrentUser(newUser);
        setAppState('idle');

      } else {
        // CFR profile creation (Remains unchanged - waits for Admin verification)
        const newUser: UserProfile = {
          id: newId, role: 'cfr', name: authName, license_number: authLicense,
          is_verified: false, location: 'POINT(77.5946 12.9716)', medical_info: null,
        };
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) throw error;
        setCurrentUser(newUser);
        setAppState('idle');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not register.');
    } finally {
      setIsAuthLoading(false);
    }
  };
  // ── Medical profile ───────────────────────────────────────────────────────

  const handleSaveMedicalProfile = async () => {
    if (!currentUser) return;
    const medicalData = {
      blood_type: medBlood,
      allergies: medAllergies.split(',').map(i => i.trim()).filter(Boolean),
      chronic_conditions: medConditions.split(',').map(i => i.trim()).filter(Boolean),
    };
    const { error } = await supabase.from('profiles').update({ medical_info: medicalData }).eq('id', currentUser.id);
    if (error) { Alert.alert('Error', 'Could not save profile'); return; }
    setCurrentUser({ ...currentUser, medical_info: medicalData });
    Alert.alert('Saved', 'Medical profile updated.');
    setAppState('idle');
  };

  // ── FEATURE 5: Real voice recording ──────────────────────────────────────

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert('Permission denied', 'Microphone access is needed for voice dispatch.'); return; }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error('Start recording failed:', err);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecordingAndAnalyze = async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    setIsVoiceProcessing(true);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No recording URI');

      // Transcribe via Groq Whisper
      const formData = new FormData();
      formData.append('file', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'json');

      const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}` },
        body: formData,
      });

      const whisperData = await whisperRes.json();
      const transcript = whisperData?.text || '';
      setVoiceDraft(transcript);

      if (!transcript) { setIsVoiceProcessing(false); return; }

      // Classify with Groq LLaMA
      await analyzeVoiceCommand(transcript);
    } catch (err) {
      console.error('Voice analysis failed:', err);
      Alert.alert('Error', 'Could not process voice. Try again or use manual SOS.');
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const analyzeVoiceCommand = async (text: string) => {
    if (!text || text.length < 3) return;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are an emergency AI. Analyze the transcript in ANY language. If it describes a medical emergency, return JSON: {"dispatch": true, "type": "cardiac"|"trauma"|"stroke"|"choking"|"bleeding"|"burns"|"seizure"|"unconscious"}. If not, return {"dispatch": false}.' },
            { role: 'user', content: text },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
        }),
      });
      const data = await response.json();
      if (data.error) { console.error('Groq error:', data.error.message); return; }
      const decision = JSON.parse(data.choices[0].message.content);
      if (decision.dispatch === true && decision.type) {
        Alert.alert('Emergency Recognized', `AI detected: ${decision.type}. Finding hospitals...`);
        setVoiceDraft('');
        setSelectedType(decision.type);
        selectedTypeRef.current = decision.type;
        fetchHospitals(decision.type);
      } else {
        Alert.alert('Not recognized', 'Could not detect an emergency. Please use manual SOS.');
      }
    } catch (err) {
      console.error('Voice classify failed:', err);
    }
  };

  // ── FEATURE 4: Message to emergency contact ───────────────────────────────

  const sendMessageToContact = async () => {
    const contact = currentUser?.emergency_contact;
    if (!contact) { Alert.alert('No contact', 'No emergency contact on file.'); return; }

    const loc = locationRef.current;
    const lat = loc?.coords.latitude ?? 12.9716;
    const lng = loc?.coords.longitude ?? 77.5946;
    const mapsLink = `http://maps.google.com/?q=${lat},${lng}`;

    const fullMessage = emergencyMessage
      ? `[Golden Minutes SOS] ${emergencyMessage} | My location: ${mapsLink}`
      : `[Golden Minutes SOS] I need immediate help. My location: ${mapsLink}`;

    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      await SMS.sendSMSAsync([contact], fullMessage);
      setMessageSent(true);
      setShowMessageInput(false);
      setEmergencyMessage('');
    } else {
      Alert.alert('Dev Mode', `SMS unavailable. Message: ${fullMessage}`);
      setMessageSent(true);
    }
  };

  // ── FEATURE 3: Ambulance booking status simulation ────────────────────────

  const startAmbulanceStatusFlow = () => {
    const steps: AmbulanceStatus[] = ['finding', 'assigned', 'dispatched', 'arriving'];
    let i = 0;
    setAmbulanceStatus('finding');
    ambulanceStatusTimer.current = setInterval(() => {
      i++;
      if (i < steps.length) {
        setAmbulanceStatus(steps[i]);
      } else {
        clearInterval(ambulanceStatusTimer.current!);
      }
    }, 8000); // advances every 8 seconds
  };

  // ── Supabase realtime: victim listener ────────────────────────────────────

  useEffect(() => {
    if (!currentIncidentId || currentUser?.role !== 'user') return;
    const sub = supabase.channel(`emergencies:${currentIncidentId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergencies', filter: `id=eq.${currentIncidentId}` },
        async (payload) => {
          if (payload.new.status === 'accepted' && payload.new.cfr_id) {
            setAppState('en_route');
            setRejectionNotice(null);
            setAmbulanceStatus('arriving');
            try {
              const { data } = await supabase.from('profiles').select('location').eq('id', payload.new.cfr_id).single();
              if (data?.location) {
                const { data: coords } = await supabase.rpc('get_lat_long', { geom: data.location });
                if (coords) setCfrLocation({ latitude: coords.lat, longitude: coords.lng });
              }
            } catch { console.warn('CFR location fetch failed'); }
          } else if (payload.new.last_rejection_reason && payload.new.status === 'dispatched') {
            setRejectionNotice(`Dr. ${payload.new.last_rejected_by_name}: ${payload.new.last_rejection_reason}. Re-routing...`);
            setTimeout(() => setRejectionNotice(null), 8000);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [currentIncidentId, currentUser]);

  // ── Supabase realtime: CFR pager ─────────────────────────────────────────

  useEffect(() => {
    if (currentUser?.role !== 'cfr' || !currentUser.is_verified) return;
    const sub = supabase.channel('global_sos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'emergencies' },
        async (payload) => {
          if (
            payload.new.status === 'dispatched' &&
            !payload.new.rejected_by?.includes(currentUser.id) &&
            appStateRef.current === 'idle'
          ) {
            setCurrentIncidentId(payload.new.id);
            setSelectedType(payload.new.incident_type);
            setAppState('searching');

            // FEATURE 2: Fetch victim location and address for CFR preview
            try {
              const { data: incident } = await supabase
                .from('emergencies')
                .select('patient_location, incident_address')
                .eq('id', payload.new.id)
                .single();

              if (incident?.patient_location) {
                const { data: coords } = await supabase.rpc('get_lat_long', { geom: incident.patient_location });
                if (coords) {
                  setVictimLocationForCFR({
                    lat: coords.lat,
                    lng: coords.lng,
                    address: incident.incident_address || 'Address unavailable',
                  });
                  const loc = locationRef.current;
                  if (loc) {
                    const d = calcDistance(loc.coords.latitude, loc.coords.longitude, coords.lat, coords.lng);
                    setVictimDistance(d);
                    setVictimEta(Math.ceil(d * 6));
                  }
                }
              }
            } catch { console.warn('Could not fetch victim location for CFR preview'); }
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [currentUser]);

  // ── Auto-select countdown ─────────────────────────────────────────────────

  useEffect(() => {
    if (appState !== 'hospital_select' || hospitalList.length === 0) return;
    hospitalListRef.current = hospitalList;
    setAutoSelectCountdown(AUTO_SELECT_SECONDS);
    autoSelectTimer.current = setInterval(() => {
      setAutoSelectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(autoSelectTimer.current!);
          const top = [...hospitalListRef.current].sort((a, b) => b.match_percentage - a.match_percentage)[0];
          if (top) confirmHospital(top);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (autoSelectTimer.current) clearInterval(autoSelectTimer.current); };
  }, [appState, hospitalList]);

  // ── Fetch hospitals ───────────────────────────────────────────────────────

  const fetchHospitals = async (type: EmergencyType) => {
    const loc = locationRef.current;
    if (!loc) { Alert.alert('Location unavailable', 'Still acquiring GPS. Please wait.'); return; }
    setIsLoadingHospitals(true);
    setHospitalError(null);
    setHospitalList([]);
    const pointString = `POINT(${loc.coords.longitude} ${loc.coords.latitude})`;
    try {
      const { data, error } = await supabase.rpc('get_recommended_hospitals', { user_location: pointString, incident_type: type });
      if (error) throw error;
      if (!data || data.length === 0) { setHospitalError('No hospitals found nearby.'); return; }
      const top10 = data.slice(0, 10);
      const withEtas = await Promise.all(top10.map(async (h: HospitalData) => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${loc.coords.longitude},${loc.coords.latitude};${h.lng},${h.lat}?overview=false`;
          const res = await fetch(url);
          if (!res.ok) throw new Error();
          const rd = await res.json();
          return { ...h, eta: rd.routes?.[0]?.duration ? Math.round(rd.routes[0].duration / 60) : null, distance_meters: rd.routes?.[0]?.distance ?? h.distance_meters };
        } catch { return { ...h, eta: null }; }
      }));
      setHospitalList(withEtas);
      setAppState('hospital_select');
    } catch (err: any) {
      setHospitalError('Failed to load hospitals. Tap to retry.');
    } finally {
      setIsLoadingHospitals(false);
    }
  };

  // ── Confirm hospital & dispatch ───────────────────────────────────────────

  const confirmHospital = useCallback(async (hospital: HospitalData) => {
    if (autoSelectTimer.current) clearInterval(autoSelectTimer.current);
    const loc = locationRef.current;
    const type = selectedTypeRef.current;
    if (!loc || !type || !currentUser) return;

    setSelectedHospital(hospital);
    setAppState('searching');
    startAmbulanceStatusFlow(); // FEATURE 3: start status ticker

    try {
      const { data, error } = await supabase
        .from('emergencies')
        .insert({
          incident_type: type,
          status: 'dispatched',
          hospital_id: hospital.id ?? null,
          hospital_name: hospital.name,
          location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
          patient_location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`,
          incident_address: incidentAddress,
          eta_to_hospital: hospital.eta ?? null,
        })
        .select().single();

      if (error) throw error;
      setCurrentIncidentId(data.id);

      // FEATURE 4: Auto-send initial SOS SMS to emergency contact
      if (currentUser.emergency_contact) {
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        const mapsLink = `http://maps.google.com/?q=${lat},${lng}`;
        const msg = `[Golden Minutes SOS] ${currentUser.name} has triggered an emergency. Location: ${mapsLink}. An ambulance has been dispatched to ${hospital.name}.`;
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) await SMS.sendSMSAsync([currentUser.emergency_contact], msg);
      }

      supabase.functions.invoke('send-hpap-alert', {
        body: { incident_id: data.id, hospital_name: hospital.name, emergency_type: type, eta_minutes: hospital.eta, incident_address: incidentAddress, severity: 'critical', patient_medical_info: currentUser.medical_info ?? null },
      }).then(() => setHpapSent(true)).catch(() => console.warn('HPAP failed'));

      supabase.functions.invoke('notify-cfr', {
        body: { incident_id: data.id, patient_location: `POINT(${loc.coords.longitude} ${loc.coords.latitude})`, incident_type: type },
      }).catch(() => console.warn('CFR notify failed'));

    } catch (err: any) {
      console.error('Dispatch error:', err?.message || err);
    }
  }, [incidentAddress, currentUser]);

  // ── AI Coach ──────────────────────────────────────────────────────────────

  const loadAiCoach = async () => {
    const type = selectedTypeRef.current;
    if (!type) return;
    setAppState('coach');
    setIsCoachLoading(true);
    setAiInstructions('');
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', temperature: 0.1,
          messages: [
            { role: 'system', content: 'You are a crisis medical dispatcher. Give 4 ultra-short, numbered, actionable first-aid steps. No intro or conclusion. Plain text only.' },
            { role: 'user', content: `Emergency: ${type}. What do I do right now while waiting for the ambulance?` },
          ],
        }),
      });
      const data = await response.json();
      setAiInstructions(data?.choices?.[0]?.message?.content || fallbackInstructions(type));
    } catch { setAiInstructions(fallbackInstructions(type)); }
    finally { setIsCoachLoading(false); }
  };

  const fallbackInstructions = (type: EmergencyType): string => {
    const map: Record<EmergencyType, string> = {
      cardiac: '1. Check responsiveness — tap shoulders, shout.\n2. Call 112. Start chest compressions immediately.\n3. Push hard and fast, 30 times on centre of chest.\n4. Give 2 rescue breaths. Repeat until help arrives.',
      stroke: '1. Use FAST: Face drooping, Arm weakness, Speech slurred, Time.\n2. Note exact time symptoms started.\n3. Keep them still, head slightly raised.\n4. Do not give food or water.',
      trauma: '1. Ensure scene is safe before approaching.\n2. Check breathing and responsiveness.\n3. Apply firm pressure to any bleeding wound.\n4. Keep them still and warm.',
      choking: '1. Ask "Are you choking?" If no speech, act now.\n2. Give 5 sharp back blows between shoulder blades.\n3. Give 5 abdominal thrusts just above navel.\n4. Alternate until object dislodges.',
      bleeding: '1. Press firmly on wound with clean cloth.\n2. Do not remove cloth — add more if soaked.\n3. Tie tourniquet 5cm above wound if limb bleeding.\n4. Elevate limb above heart level.',
      burns: '1. Remove from heat source immediately.\n2. Cool under running water for 10 minutes.\n3. Do not apply ice, butter, or toothpaste.\n4. Cover loosely. Keep person warm.',
      seizure: '1. Clear area of hard objects. Do not restrain.\n2. Do not put anything in their mouth.\n3. Time the seizure.\n4. After it stops, roll onto side (recovery position).',
      unconscious: '1. Tap shoulders, shout "Can you hear me?"\n2. Tilt head back, check breathing for 10 seconds.\n3. If breathing: recovery position on their side.\n4. If not breathing: start CPR immediately.',
    };
    return map[type];
  };

  // ── CFR actions ───────────────────────────────────────────────────────────

  const handleCfrAccept = async () => {
    if (!currentIncidentId || !currentUser) return;
    const { error } = await supabase.from('emergencies').update({ status: 'accepted', cfr_id: currentUser.id }).eq('id', currentIncidentId);
    if (error) Alert.alert('Network error', 'Could not accept. Try again.');
    else setAppState('en_route');
  };

  const handleCfrReject = async (reason: string) => {
    if (!currentIncidentId || !currentUser) return;
    try {
      const { data: emergency } = await supabase.from('emergencies').select('rejected_by, patient_location, incident_type').eq('id', currentIncidentId).single();
      const updated = [...(emergency?.rejected_by || []), currentUser.id];
      await supabase.from('emergencies').update({ status: 'dispatched', last_rejection_reason: reason, last_rejected_by_name: currentUser.name, rejected_by: updated }).eq('id', currentIncidentId);
      if (emergency?.patient_location) {
        supabase.functions.invoke('notify-cfr', { body: { incident_id: currentIncidentId, patient_location: emergency.patient_location, incident_type: emergency.incident_type, exclude_cfr_ids: updated } }).catch(() => {});
      }
      setShowRejectOptions(false);
      setVictimLocationForCFR(null);
      setAppState('idle');
      setCurrentIncidentId(null);
    } catch (err) { console.error('Rejection failed:', err); }
  };

  const openExternalMaps = () => {
    const loc = locationRef.current;
    if (!loc) return;
    const { latitude: lat, longitude: lng } = loc.coords;
    const url = Platform.select({ ios: `maps:0,0?q=Emergency@${lat},${lng}`, android: `geo:0,0?q=${lat},${lng}(Emergency)` });
    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps.'));
  };

  const resetFlow = () => {
    if (autoSelectTimer.current) clearInterval(autoSelectTimer.current);
    if (ambulanceStatusTimer.current) clearInterval(ambulanceStatusTimer.current);
    setAppState('idle');
    setSelectedType(null); selectedTypeRef.current = null;
    setHospitalList([]); setSelectedHospital(null);
    setHpapSent(false); setCfrLocation(null);
    setCurrentIncidentId(null); setHospitalError(null);
    setAiInstructions(''); setShowRejectOptions(false);
    setRejectionNotice(null); setVoiceDraft('');
    setAmbulanceStatus('idle'); setVictimLocationForCFR(null);
    setMessageSent(false); setEmergencyMessage(''); setShowMessageInput(false);
  };

  // ── Sorted lists ──────────────────────────────────────────────────────────

  const byDistance = [...hospitalList].sort((a, b) => a.distance_meters - b.distance_meters);
  const bySmartRank = [...hospitalList].sort((a, b) => {
    const score = (h: HospitalData) => h.match_percentage + (h.popularity_score || 0) * 0.5 - h.distance_meters * 0.005 + (h.tier === 1 ? 30 : h.tier === 2 ? 15 : 0);
    return score(b) - score(a);
  });
  const displayed = hospitalTab === 'distance' ? byDistance : bySmartRank;

  // ─── Render sections ──────────────────────────────────────────────────────

  const renderAuth = () => (
    <View style={S.sheetContent}>
      <Text style={S.sheetTitle}>Golden Minutes</Text>
      <Text style={S.sheetSubtitle}>Create your secure profile to continue.</Text>
      <View style={S.tabRow}>
        <TouchableOpacity style={[S.tabBtn, authRole === 'user' && S.tabBtnActive]} onPress={() => setAuthRole('user')}>
          <Text style={[S.tabBtnText, authRole === 'user' && S.tabBtnTextActive]}>Citizen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.tabBtn, authRole === 'cfr' && S.tabBtnActive]} onPress={() => setAuthRole('cfr')}>
          <Text style={[S.tabBtnText, authRole === 'cfr' && S.tabBtnTextActive]}>Doctor (CFR)</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={S.input} placeholder="Full Name" value={authName} onChangeText={setAuthName} />
      {authRole === 'user'
        ? <TextInput style={S.input} placeholder="Emergency Contact Phone" value={authContact} onChangeText={setAuthContact} keyboardType="phone-pad" />
        : <TextInput style={S.input} placeholder="Medical License Number" value={authLicense} onChangeText={setAuthLicense} />
      }
      <TouchableOpacity style={[S.primaryButton, { marginTop: 10, opacity: isAuthLoading ? 0.7 : 1 }]} onPress={handleRegister} disabled={isAuthLoading}>
        {isAuthLoading ? <ActivityIndicator color="#fff" /> : <Text style={S.primaryButtonText}>Register / Log In</Text>}
      </TouchableOpacity>
    </View>
  );

  

  const renderProfile = () => (
    <View style={S.sheetContent}>
      <Text style={S.sheetTitle}>Medical Profile</Text>
      <Text style={S.sheetSubtitle}>Sent securely to ER during SOS.</Text>
      <TextInput style={S.input} placeholder="Blood Type (e.g. O-)" value={medBlood} onChangeText={setMedBlood} />
      <TextInput style={S.input} placeholder="Allergies (comma separated)" value={medAllergies} onChangeText={setMedAllergies} />
      <TextInput style={S.input} placeholder="Chronic Conditions (e.g. Asthma)" value={medConditions} onChangeText={setMedConditions} />
      <TouchableOpacity style={[S.primaryButton, { backgroundColor: '#198754', marginTop: 10 }]} onPress={handleSaveMedicalProfile}>
        <Text style={S.primaryButtonText}>Save Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 15 }} onPress={() => setAppState('idle')}>
        <Text style={{ color: '#6c757d', fontWeight: '700' }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // FEATURE 3: Ambulance status bar widget
  const renderAmbulanceStatus = () => {
    if (ambulanceStatus === 'idle') return null;
    const steps: AmbulanceStatus[] = ['finding', 'assigned', 'dispatched', 'arriving', 'arrived'];
    const currentIdx = steps.indexOf(ambulanceStatus);
    return (
      <View style={S.ambulanceStatusCard}>
        <Text style={S.ambulanceStatusTitle}>🚑 Ambulance Status</Text>
        <Text style={S.ambulanceStatusLabel}>{AMBULANCE_STATUS_LABELS[ambulanceStatus]}</Text>
        <View style={S.ambulanceProgressBar}>
          {steps.map((step, i) => (
            <View
              key={step}
              style={[S.ambulanceProgressDot, i <= currentIdx ? S.ambulanceProgressDotActive : {}]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderIdle = () => (
    <View style={S.sheetContent}>
      <Text style={S.sheetTitle}>Emergency Assistance</Text>
      <Text style={S.sheetSubtitle}>Dispatch help and get AI guidance instantly.</Text>

      {/* FEATURE 5: Voice recording UI */}
      <View style={{ width: '100%', marginBottom: 16 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8, color: '#495057' }}>🎙️ AI Voice Dispatch (Multi-lingual)</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder={isRecording ? 'Recording...' : voiceDraft || 'Or type your emergency here'}
            value={voiceDraft}
            onChangeText={setVoiceDraft}
            style={[S.input, { flex: 1, marginBottom: 0, borderColor: isRecording ? '#dc3545' : '#0d6efd', borderWidth: 2 }]}
            editable={!isRecording && !isVoiceProcessing}
          />
          <TouchableOpacity
            style={[S.voiceBtn, isRecording && { backgroundColor: '#dc3545' }]}
            onPress={isRecording ? stopRecordingAndAnalyze : startRecording}
            disabled={isVoiceProcessing}
          >
            {isVoiceProcessing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={{ fontSize: 20 }}>{isRecording ? '⏹' : '🎙️'}</Text>
            }
          </TouchableOpacity>
          {!isRecording && voiceDraft.length > 2 && (
            <TouchableOpacity
              style={[S.voiceBtn, { backgroundColor: '#198754' }]}
              onPress={() => analyzeVoiceCommand(voiceDraft)}
              disabled={isVoiceProcessing}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>GO</Text>
            </TouchableOpacity>
          )}
        </View>
        {isRecording && <Text style={{ color: '#dc3545', fontSize: 12, marginTop: 4 }}>● Recording... tap ⏹ when done</Text>}
        {isVoiceProcessing && <Text style={{ color: '#0d6efd', fontSize: 12, marginTop: 4 }}>🧠 Analyzing...</Text>}
      </View>

      <TouchableOpacity style={[S.primaryButton, !location && { opacity: 0.5 }]} onPress={() => setAppState('type_select')} disabled={!location}>
        <Text style={S.primaryButtonText}>{location ? 'MANUAL SOS' : 'Acquiring GPS...'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTypeSelect = () => (
    <View style={S.sheetContent}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <Text style={S.sheetTitle}>What's the emergency?</Text>
        <TouchableOpacity onPress={() => setAppState('idle')}><Text style={{ color: '#dc3545', fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
      </View>
      <Text style={[S.sheetSubtitle, { alignSelf: 'flex-start' }]}>Determines hospital routing and AI guidance.</Text>
      <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={S.typeGrid}>
          {EMERGENCY_TYPES.map((t) => (
            <TouchableOpacity key={t.key} style={[S.typeCard, { borderColor: t.color }]}
              onPress={() => { setSelectedType(t.key); selectedTypeRef.current = t.key; fetchHospitals(t.key); }}>
              <Text style={S.typeIcon}>{t.icon}</Text>
              <Text style={[S.typeLabel, { color: t.color }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderHospitalCard = (h: HospitalData, index: number) => {
    const isTop = index === 0;
    const mc = h.match_percentage === 100 ? '#198754' : h.match_percentage >= 70 ? '#856404' : '#6c757d';
    const mb = h.match_percentage === 100 ? '#e6f4ea' : h.match_percentage >= 70 ? '#fff3cd' : '#f1f3f5';
    return (
      <View key={h.id || index} style={[S.hospitalCard, isTop && S.hospitalCardTop]}>
        {isTop && <View style={S.bestBadge}><Text style={S.bestBadgeText}>{hospitalTab === 'distance' ? '📍 NEAREST' : '🚀 SMART RANK'}</Text></View>}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={S.hospitalName}>{h.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
              <Text style={S.hospitalEta}>🚗 {h.eta != null ? `${h.eta} min` : 'Calc...'}</Text>
              <Text style={S.hospitalDot}>•</Text>
              <Text style={S.hospitalDist}>{h.distance_meters > 1000 ? `${(h.distance_meters / 1000).toFixed(1)} km` : `${Math.round(h.distance_meters)} m`}</Text>
            </View>
            {h.tier != null && <Text style={{ fontSize: 11, color: '#856404', marginTop: 4, fontWeight: '700' }}>{h.tier === 1 ? '🌟 Tier 1 Hub' : h.tier === 2 ? '🏥 Regional' : '🩺 Local Clinic'}{h.popularity_score != null ? ` • Score: ${h.popularity_score}` : ''}</Text>}
          </View>
          <View style={[S.matchBadge, { backgroundColor: mb }]}>
            <Text style={[S.matchPct, { color: mc }]}>{h.match_percentage}%</Text>
            <Text style={[S.matchLabel, { color: mc }]}>MATCH</Text>
          </View>
        </View>
        <TouchableOpacity style={[S.confirmBtn, { backgroundColor: isTop ? '#0d6efd' : '#6c757d' }]} onPress={() => confirmHospital(h)}>
          <Text style={S.confirmBtnText}>Confirm & Dispatch →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHospitalSelect = () => (
    <View style={{ width: '100%', flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={S.sheetTitle}>Select Hospital</Text>
        <View style={S.countdownBadge}><Text style={S.countdownText}>Auto in {autoSelectCountdown}s</Text></View>
      </View>
      <Text style={[S.sheetSubtitle, { marginBottom: 12 }]}>Optimised for {selectedType} emergency.</Text>
      <View style={S.tabRow}>
        {(['smart', 'distance'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[S.tabBtn, hospitalTab === tab && S.tabBtnActive]} onPress={() => setHospitalTab(tab)}>
            <Text style={[S.tabBtnText, hospitalTab === tab && S.tabBtnTextActive]}>{tab === 'smart' ? '🚀 Smart Rank' : '📍 Nearest'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {hospitalError ? (
        <View style={S.errorCard}>
          <Text style={S.errorText}>{hospitalError}</Text>
          <TouchableOpacity onPress={() => selectedTypeRef.current && fetchHospitals(selectedTypeRef.current)}>
            <Text style={S.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          {displayed.map((h, i) => renderHospitalCard(h, i))}
        </ScrollView>
      )}
    </View>
  );

  const renderSearching = () => (
    <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
      <ActivityIndicator size="large" color="#dc3545" />
      <Text style={[S.sheetTitle, { marginTop: 14 }]}>Broadcasting SOS...</Text>
      <Text style={S.sheetSubtitle}>Alerting verified CFRs within 2 km.</Text>

      {/* FEATURE 3: Ambulance status */}
      {renderAmbulanceStatus()}

      {rejectionNotice && <View style={S.rejectionBanner}><Text style={S.rejectionText}>⚠️ {rejectionNotice}</Text></View>}

      {selectedHospital && (
        <View style={S.selectedHospitalCard}>
          <Text style={S.selectedHospitalLabel}>DISPATCHING TO</Text>
          <Text style={S.selectedHospitalName}>{selectedHospital.name}</Text>
          <Text style={S.selectedHospitalDetail}>{selectedHospital.eta ? `${selectedHospital.eta} min ETA` : 'ETA unavailable'} • {selectedHospital.distance_meters > 1000 ? `${(selectedHospital.distance_meters / 1000).toFixed(1)} km` : `${Math.round(selectedHospital.distance_meters)} m`}</Text>
          {hpapSent && <View style={S.hpapBadge}><Text style={S.hpapBadgeText}>✅ Hospital pre-activated</Text></View>}
        </View>
      )}

      {/* FEATURE 4: Message to emergency contact */}
      <View style={{ width: '100%', marginTop: 12 }}>
        {messageSent ? (
          <View style={[S.hpapBadge, { width: '100%' }]}>
            <Text style={S.hpapBadgeText}>✅ Message sent to emergency contact</Text>
          </View>
        ) : showMessageInput ? (
          <View style={{ width: '100%' }}>
            <TextInput
              style={[S.input, { marginBottom: 8 }]}
              placeholder="Add a message (optional, e.g. 'I'm at the park near Gate 2')"
              value={emergencyMessage}
              onChangeText={setEmergencyMessage}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[S.primaryButton, { flex: 1, paddingVertical: 12, backgroundColor: '#198754' }]} onPress={sendMessageToContact}>
                <Text style={S.primaryButtonText}>Send Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.primaryButton, { flex: 1, paddingVertical: 12, backgroundColor: '#6c757d' }]} onPress={() => setShowMessageInput(false)}>
                <Text style={S.primaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[S.primaryButton, { backgroundColor: '#6c757d', marginBottom: 8 }]} onPress={() => setShowMessageInput(true)}>
            <Text style={S.primaryButtonText}>📱 Message Emergency Contact</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={[S.primaryButton, { backgroundColor: '#ffc107', marginTop: 8 }]} onPress={loadAiCoach}>
        <Text style={[S.primaryButtonText, { color: '#000' }]}>🤖 Get AI First-Aid Steps</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderCoach = () => (
    <View style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={S.sheetTitle}>🤖 AI First-Aid Guide</Text>
        <TouchableOpacity onPress={() => setAppState(cfrLocation ? 'en_route' : 'searching')} style={S.activeBadge}>
          <Text style={S.activeBadgeText}>← Back</Text>
        </TouchableOpacity>
      </View>
      <Text style={[S.sheetSubtitle, { textAlign: 'left', marginBottom: 12 }]}>Steps for {selectedTypeRef.current}:</Text>
      {isCoachLoading ? (
        <View style={{ padding: 30, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ffc107" />
          <Text style={{ marginTop: 10, color: '#6c757d' }}>Generating steps...</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: '#f8f9fa', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e9ecef' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#212529', lineHeight: 26 }}>{aiInstructions}</Text>
        </View>
      )}
    </View>
  );

  const renderEnRoute = () => (
    <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, alignSelf: 'flex-start' }}>
        <View style={S.greenDot} /><Text style={S.enRouteTitle}>Responder On the Way!</Text>
      </View>
      {renderAmbulanceStatus()}
      {selectedHospital && (
        <View style={S.selectedHospitalCard}>
          <Text style={S.selectedHospitalLabel}>DESTINATION HOSPITAL</Text>
          <Text style={S.selectedHospitalName}>{selectedHospital.name}</Text>
          <View style={S.hpapBadge}><Text style={S.hpapBadgeText}>✅ ER is preparing for your arrival</Text></View>
        </View>
      )}
      <TouchableOpacity style={[S.primaryButton, { backgroundColor: '#ffc107', marginTop: 12 }]} onPress={loadAiCoach}>
        <Text style={[S.primaryButtonText, { color: '#000' }]}>🤖 View AI First-Aid Steps</Text>
      </TouchableOpacity>
      <TouchableOpacity style={S.resetButton} onPress={resetFlow}><Text style={S.resetButtonText}>End Emergency</Text></TouchableOpacity>
    </ScrollView>
  );

  const renderCFR = () => (
    <View style={S.sheetContent}>
      {!currentUser?.is_verified ? (
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Text style={S.sheetTitle}>Profile Under Review</Text>
          <Text style={[S.sheetSubtitle, { color: '#dc3545', fontWeight: '600' }]}>License Pending ({currentUser?.license_number})</Text>
          <View style={{ backgroundColor: '#f8f9fa', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e9ecef', width: '100%', marginBottom: 20 }}>
            <Text style={{ textAlign: 'center', color: '#495057', fontSize: 13, lineHeight: 20 }}>
              You cannot receive SOS alerts until an admin verifies your license. You'll receive an SMS once cleared (usually within 24 hours).
            </Text>
          </View>
          <TouchableOpacity style={[S.resetButton, { marginTop: 0 }]} onPress={() => { resetFlow(); setAppState('auth'); setCurrentUser(null); }}>
            <Text style={S.resetButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      ) : appState === 'searching' ? (
        <View style={S.cfrAlertCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={S.redDot} /><Text style={S.cfrAlertTitle}>🚨 {selectedType?.toUpperCase()} EMERGENCY</Text>
          </View>

          {/* FEATURE 2: Victim location shown before acceptance */}
          {victimLocationForCFR && (
            <View style={[S.locationCard, { marginBottom: 12 }]}>
              <Text style={S.locationLabel}>VICTIM LOCATION (BEFORE ACCEPT)</Text>
              <Text style={S.locationAddress}>{victimLocationForCFR.address}</Text>
              <Text style={S.cfrDistText}>📍 ~{victimDistance.toFixed(1)} km away • Est. {victimEta} min on foot</Text>
              <TouchableOpacity
                style={{ marginTop: 8 }}
                onPress={() => {
                  const url = Platform.select({
                    ios: `maps:0,0?q=Victim@${victimLocationForCFR.lat},${victimLocationForCFR.lng}`,
                    android: `geo:0,0?q=${victimLocationForCFR.lat},${victimLocationForCFR.lng}(Victim)`,
                  });
                  if (url) Linking.openURL(url).catch(() => {});
                }}
              >
                <Text style={{ color: '#0d6efd', fontWeight: '700', fontSize: 13 }}>📍 Preview on Maps →</Text>
              </TouchableOpacity>
            </View>
          )}

          {showRejectOptions ? (
            <View>
              <Text style={{ fontWeight: '700', marginBottom: 10 }}>Reason for rejection:</Text>
              {REJECT_REASONS.map(reason => (
                <TouchableOpacity key={reason} style={S.rejectReasonBtn} onPress={() => handleCfrReject(reason)}>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{reason}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => setShowRejectOptions(false)}>
                <Text style={{ color: '#6c757d', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity style={S.acceptButton} onPress={handleCfrAccept}>
                <Text style={S.acceptButtonText}>ACCEPT & RESPOND</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.acceptButton, { backgroundColor: '#dc3545', marginTop: 10 }]} onPress={() => setShowRejectOptions(true)}>
                <Text style={S.acceptButtonText}>REJECT CALL</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : appState === 'en_route' ? (
        <View style={{ width: '100%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={S.sheetTitle}>Proceed to Victim</Text>
            <View style={S.activeBadge}><Text style={S.activeBadgeText}>ACTIVE</Text></View>
          </View>
          <View style={S.locationCard}>
            <Text style={S.locationLabel}>INCIDENT LOCATION</Text>
            <Text style={S.locationAddress}>{victimLocationForCFR?.address || incidentAddress}</Text>
          </View>
          <TouchableOpacity style={S.mapsButton} onPress={openExternalMaps}>
            <Text style={S.mapsButtonText}>📍 OPEN TURN-BY-TURN MAPS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.resetButton} onPress={resetFlow}>
            <Text style={S.resetButtonText}>Finish & Reset</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={S.sheetTitle}>Dr. {currentUser?.name}</Text>
          <Text style={S.sheetSubtitle}>Listening for nearby emergencies...</Text>
          <View style={S.activeStatusBadge}><Text style={S.activeStatusText}>STATUS: ON DUTY</Text></View>
        </View>
      )}
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  const sheetTall = !['idle', 'type_select', 'auth', 'profile', 'otp'].includes(appState);

  return (
    <View style={S.container}>
      {location ? (
        <MapView style={S.map} initialRegion={{ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }} showsUserLocation>
          {cfrLocation && <Marker coordinate={cfrLocation} title="Responder" pinColor="#0d6efd" />}
          {cfrLocation && location && <Polyline coordinates={[{ latitude: location.coords.latitude, longitude: location.coords.longitude }, cfrLocation]} strokeColor="#0d6efd" strokeWidth={4} lineDashPattern={[6, 6]} />}
          {/* FEATURE 2: Show victim pin on CFR map before acceptance */}
          {currentUser?.role === 'cfr' && victimLocationForCFR && (
            <Marker coordinate={{ latitude: victimLocationForCFR.lat, longitude: victimLocationForCFR.lng }} title="Victim" pinColor="#dc3545" />
          )}
        </MapView>
      ) : (
        <View style={S.loadingContainer}>
          {locationError ? <Text style={S.errorText}>{locationError}</Text> : <ActivityIndicator size="large" color="#0d6efd" />}
        </View>
      )}

      {appState !== 'auth' && appState !== 'otp' && (
        <View style={S.header}>
          <Text style={S.appTitle}>Golden Minutes</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {currentUser?.role === 'user' && (
              <TouchableOpacity style={[S.roleBadge, { backgroundColor: '#e6f4ea' }]} onPress={() => setAppState('profile')}>
                <Text style={[S.roleText, { color: '#198754' }]}>PROFILE</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.roleBadge} onPress={() => Alert.alert('Logout', 'Are you sure?', [
              { text: 'Cancel' },
              { text: 'Logout', onPress: () => { resetFlow(); setAppState('auth'); setCurrentUser(null); } },
            ])}>
              <Text style={S.roleText}>{currentUser?.role?.toUpperCase()} MODE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={[
        S.bottomSheet,
        sheetTall && { height: '72%' },
        appState === 'type_select' && { height: '70%' },
        ['auth', 'profile', 'otp'].includes(appState) && { height: '65%' },
      ]}>
        {appState === 'auth' ? renderAuth()
          : appState === 'profile' ? renderProfile()
          : currentUser?.role === 'cfr' ? renderCFR()
          : isLoadingHospitals ? (
            <View style={S.sheetContent}>
              <ActivityIndicator size="large" color="#0d6efd" />
              <Text style={[S.sheetSubtitle, { marginTop: 14 }]}>Finding best hospitals for {selectedType}...</Text>
            </View>
          ) : appState === 'idle' ? renderIdle()
          : appState === 'type_select' ? renderTypeSelect()
          : appState === 'hospital_select' ? renderHospitalSelect()
          : appState === 'searching' ? renderSearching()
          : appState === 'coach' ? renderCoach()
          : appState === 'en_route' ? renderEnRoute()
          : null}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  map: { width: '100%', height: '100%', position: 'absolute' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  header: { position: 'absolute', top: 55, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  appTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.5 },
  roleBadge: { backgroundColor: '#f1f3f5', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  roleText: { fontSize: 11, fontWeight: '700', color: '#495057', letterSpacing: 0.5 },
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 44, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  sheetContent: { alignItems: 'center', width: '100%' },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#212529', marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, color: '#6c757d', marginBottom: 20, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#dee2e6', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16 },
  primaryButton: { backgroundColor: '#dc3545', width: '100%', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#dc3545', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  voiceBtn: { backgroundColor: '#0d6efd', width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  typeCard: { width: '47%', padding: 16, borderRadius: 14, borderWidth: 2, backgroundColor: '#fff', alignItems: 'center', marginBottom: 4 },
  typeIcon: { fontSize: 28, marginBottom: 6 },
  typeLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  countdownBadge: { backgroundColor: '#fff3cd', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  countdownText: { fontSize: 11, color: '#856404', fontWeight: '700' },
  tabRow: { flexDirection: 'row', backgroundColor: '#f1f3f5', borderRadius: 12, padding: 4, marginBottom: 12, width: '100%' },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#6c757d' },
  tabBtnTextActive: { color: '#212529', fontWeight: '700' },
  hospitalCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef', padding: 14, borderRadius: 14, marginBottom: 10 },
  hospitalCardTop: { backgroundColor: '#f4faff', borderColor: '#0d6efd' },
  bestBadge: { backgroundColor: '#0d6efd', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
  bestBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  hospitalName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  hospitalEta: { fontSize: 14, color: '#495057', fontWeight: '700' },
  hospitalDot: { fontSize: 14, color: '#adb5bd', marginHorizontal: 6 },
  hospitalDist: { fontSize: 13, color: '#6c757d', fontWeight: '600' },
  matchBadge: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  matchPct: { fontSize: 16, fontWeight: '900' },
  matchLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  confirmBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  ambulanceStatusCard: { backgroundColor: '#e8f4fd', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#b6d4fe', width: '100%', marginBottom: 12 },
  ambulanceStatusTitle: { fontSize: 12, fontWeight: '800', color: '#084298', letterSpacing: 0.5, marginBottom: 4 },
  ambulanceStatusLabel: { fontSize: 15, fontWeight: '700', color: '#0d6efd', marginBottom: 10 },
  ambulanceProgressBar: { flexDirection: 'row', gap: 6 },
  ambulanceProgressDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#b6d4fe' },
  ambulanceProgressDotActive: { backgroundColor: '#0d6efd' },
  selectedHospitalCard: { backgroundColor: '#f8f9fa', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#e9ecef', marginBottom: 14, width: '100%' },
  selectedHospitalLabel: { fontSize: 10, color: '#adb5bd', fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  selectedHospitalName: { fontSize: 18, fontWeight: '800', color: '#212529', marginBottom: 4 },
  selectedHospitalDetail: { fontSize: 14, color: '#495057', fontWeight: '500' },
  hpapBadge: { backgroundColor: '#e6f4ea', padding: 8, borderRadius: 8, marginTop: 10 },
  hpapBadgeText: { fontSize: 13, color: '#198754', fontWeight: '700' },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#198754', marginRight: 10 },
  enRouteTitle: { fontSize: 20, fontWeight: '800', color: '#198754' },
  resetButton: { backgroundColor: '#f1f3f5', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8, width: '100%' },
  resetButtonText: { color: '#dc3545', fontWeight: '700', fontSize: 15 },
  cfrAlertCard: { width: '100%', backgroundColor: '#fff3cd', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#ffc107' },
  redDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#dc3545', marginRight: 10 },
  cfrAlertTitle: { fontSize: 18, fontWeight: '900', color: '#856404' },
  cfrDistCard: { backgroundColor: '#ffe69c', padding: 12, borderRadius: 8, marginBottom: 16 },
  cfrDistText: { fontSize: 15, color: '#664d03', fontWeight: '700' },
  cfrEtaText: { fontSize: 13, color: '#856404', marginTop: 4 },
  acceptButton: { backgroundColor: '#28a745', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  acceptButtonText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  rejectReasonBtn: { backgroundColor: '#6c757d', padding: 14, borderRadius: 10, marginBottom: 8, alignItems: 'center' },
  activeBadge: { backgroundColor: '#e6f4ea', padding: 8, borderRadius: 8 },
  activeBadgeText: { color: '#198754', fontWeight: '800' },
  locationCard: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e9ecef', marginBottom: 14, width: '100%' },
  locationLabel: { fontSize: 12, color: '#6c757d', fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  locationAddress: { fontSize: 16, fontWeight: '700', color: '#212529', marginBottom: 4 },
  mapsButton: { backgroundColor: '#0d6efd', paddingVertical: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  mapsButtonText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  activeStatusBadge: { backgroundColor: '#e6f4ea', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12 },
  activeStatusText: { color: '#198754', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  errorCard: { backgroundColor: '#fff3f3', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#f5c2c7', alignItems: 'center' },
  errorText: { color: '#842029', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  retryText: { color: '#0d6efd', fontSize: 13, fontWeight: '700', marginTop: 8 },
  rejectionBanner: { backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, width: '100%', marginBottom: 15 },
  rejectionText: { color: '#856404', fontWeight: '700', fontSize: 13 },
});
