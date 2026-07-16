import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gtvecswwmcjexcpwbhze.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dmVjc3d3bWNqZXhjcHdiaHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODY3OTIsImV4cCI6MjA5NzE2Mjc5Mn0.BkreJLfApJ2Fwbj5zS0omlu4jHuwRx0hZPqZZ3Q3JmQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});