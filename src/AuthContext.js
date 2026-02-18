import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      }
    });
    
    if (error) throw error;
    return true;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const saveOffice = async (officeId) => {
    if (!user) throw new Error('Must be logged in');
    
    // Get or create user record
    let { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    
    if (!userRecord) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ auth_id: user.id, email: user.email })
        .select()
        .single();
      userRecord = newUser;
    }
    
    // Save office
    const { error } = await supabase
      .from('saved_offices')
      .insert({ user_id: userRecord.id, office_id: officeId });
    
    if (error && error.code !== '23505') throw error; // Ignore duplicate errors
  };

  const unsaveOffice = async (officeId) => {
    if (!user) throw new Error('Must be logged in');
    
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    
    if (!userRecord) return;
    
    const { error } = await supabase
      .from('saved_offices')
      .delete()
      .eq('user_id', userRecord.id)
      .eq('office_id', officeId);
    
    if (error) throw error;
  };

  const getSavedOffices = async () => {
    if (!user) return [];
    
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    
    if (!userRecord) return [];
    
    const { data } = await supabase
      .from('saved_offices')
      .select(`
        office_id,
        offices (*)
      `)
      .eq('user_id', userRecord.id);
    
    return data?.map(item => item.offices) || [];
  };

  const saveCampaignPlan = async (officeId, checkboxStates) => {
    if (!user) throw new Error('Must be logged in');
    
    // Get or create user record
    let { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    
    if (!userRecord) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ auth_id: user.id, email: user.email })
        .select()
        .single();
      userRecord = newUser;
    }
    
    // Upsert campaign plan (insert or update)
    const { error } = await supabase
      .from('campaign_plans')
      .upsert({
        user_id: userRecord.id,
        office_id: officeId,
        checkbox_states: checkboxStates
      }, {
        onConflict: 'user_id,office_id'
      });
    
    if (error) throw error;
  };
  
  const loadCampaignPlan = async (officeId) => {
    if (!user) return null;
    
    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();
    
    if (!userRecord) return null;
    
    const { data, error } = await supabase
      .from('campaign_plans')
      .select('checkbox_states')
      .eq('user_id', userRecord.id)
      .eq('office_id', officeId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" - that's ok
      console.error('Error loading campaign plan:', error);
      return null;
    }
    
    return data?.checkbox_states || null;
  };

  const value = {
    user,
    loading,
    signInWithEmail,
    signOut,
    saveOffice,
    unsaveOffice,
    getSavedOffices,
    saveCampaignPlan,      // ADD THIS
    loadCampaignPlan,      // ADD THIS
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};