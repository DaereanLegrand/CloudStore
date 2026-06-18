import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cloudstore-api.qallariy.lat'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzU4MTE4LCJleHAiOjIwOTcxMTgxMTh9._h-ey3emNeKEpHDVUvEKAdnuO385vQV6SBHNAOyEuD0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
