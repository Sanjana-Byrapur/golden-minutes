import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../supabase'; // Adjust path if your file is in root or src/

export default function HomeScreen() {
  // Local state to simulate user role until auth is connected
  const [userRole, setUserRole] = useState('user'); // Options: 'user' or 'cfr'
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);

  const handleEmergencyTrigger = async () => {
    setIsEmergencyActive(true);
    Alert.alert(
      "Emergency Triggered", 
      "Initializing AI Coach and locating closest responders/hospitals parallelly...",
      [{ text: "OK" }]
    );

    // TODO: Connect this to your Supabase insert logic next week
    console.log("Orchestrator firing concurrent streams...");
  };

  return (
    <View style={styles.container}>
      {/* Top Status Bar */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>Golden Minutes</Text>
        <TouchableOpacity 
          style={styles.roleBadge} 
          onPress={() => setUserRole(userRole === 'user' ? 'cfr' : 'user')}
        >
          <Text style={styles.roleText}>Mode: {userRole.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Main Action Content Area */}
      <View style={styles.content}>
        {userRole === 'user' ? (
          <View style={styles.centerAlign}>
            <Text style={styles.subText}>Tap below only in immediate medical distress</Text>
            
            <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyTrigger}>
              <Text style={styles.buttonText}>EMERGENCY</Text>
            </TouchableOpacity>

            {isEmergencyActive && (
              <Text style={styles.activePulse}>System Status: Parallel Dispatching Active...</Text>
            )}
          </View>
        ) : (
          <View style={styles.centerAlign}>
            <Text style={styles.cfrWelcome}>Volunteer Dashboard (CFR)</Text>
            <Text style={styles.cfrSubText}>You are currently listed as active. Keep the app running to receive proximity alerts.</Text>
            
            <TouchableOpacity style={styles.statusToggle}>
              <Text style={styles.statusToggleText}>Status: On Duty</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  roleBadge: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  centerAlign: {
    alignItems: 'center',
    width: '100%',
  },
  subText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  emergencyButton: {
    backgroundColor: '#dc3545',
    width: 220,
    height: 220,
    borderRadius: 110,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activePulse: {
    marginTop: 25,
    color: '#dc3545',
    fontWeight: '600',
    fontSize: 15,
  },
  cfrWelcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0d6efd',
    marginBottom: 10,
  },
  cfrSubText: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  statusToggle: {
    backgroundColor: '#198754',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  statusToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});