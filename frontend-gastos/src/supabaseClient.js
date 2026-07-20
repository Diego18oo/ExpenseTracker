import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fjjllrdekafnbtvfpvwl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqamxscmRla2FmbmJ0dmZwdndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3Nzk4NzAsImV4cCI6MjA5OTM1NTg3MH0.0_x5KZWWRhfA4Gj2HZz9yms5DtuM2cCFpjaG0hL2lxg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)