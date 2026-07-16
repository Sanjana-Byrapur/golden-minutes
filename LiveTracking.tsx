import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient'; // Path to your initialized supabase client

interface TrackingProps {
  currentIncidentId: string;
}

export default function LiveTracking({ currentIncidentId }: TrackingProps) {
  const [status, setStatus] = useState<string>('Searching for nearby responders...');
  const [cfrLocation, setCfrLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ambulanceEta, setAmbulanceEta] = useState<number | null>(null);

  useEffect(() => {
    if (!currentIncidentId) return;

    // 1. Subscribe to real-time changes on the specific emergency row
    const subscription = supabase
      .channel(`incident-tracker:${currentIncidentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergencies',
          filter: `id=eq.${currentIncidentId}`,
        },
        async (payload) => {
          const updatedIncident = payload.new;
          
          // Update UI based on the status change
          if (updatedIncident.status === 'accepted') {
            setStatus('Community Responder en route!');
            setAmbulanceEta(updatedIncident.ambulance_eta_minutes);
            
            // 2. Fetch the volunteer's current location from profiles table
            if (updatedIncident.cfr_id) {
              fetchCfrLocation(updatedIncident.cfr_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentIncidentId]);

  const fetchCfrLocation = async (cfrId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('location')
      .eq('id', cfrId)
      .single();

    if (data && data.location) {
      // PostGIS points return as GeoJSON: { type: "Point", coordinates: [lng, lat] }
      const [lng, lat] = data.location.coordinates;
      setCfrLocation({ lat, lng });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.statusHeader}>Incident Status</Text>
      <Text style={styles.statusText}>{status}</Text>
      
      {status === 'Searching for nearby responders...' && (
        <ActivityIndicator size="large" style={styles.loader} />
      )}

      {ambulanceEta !== null && (
        <Text style={styles.etaText}>Ambulance Live Traffic ETA: {ambulanceEta} mins</Text>
      )}

      {cfrLocation && (
        <Text style={styles.locationText}>
          Responder GPS: {cfrLocation.lat.toFixed(4)}, {cfrLocation.lng.toFixed(4)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', borderRadius: 10, margin: 10 },
  statusHeader: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', opacity: 0.6 },
  statusText: { fontSize: 18, fontWeight: 'bold', marginVertical: 8 },
  loader: { marginVertical: 15 },
  etaText: { fontSize: 14, fontStyle: 'italic', marginTop: 5 },
  locationText: { fontSize: 12, opacity: 0.7, marginTop: 10 }
});