import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://aupwdgizvokpqcyfsnnu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cHdkZ2l6dm9rcHFjeWZzbm51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTU0MDcsImV4cCI6MjA5NDA5MTQwN30.oV-lDQIaHEXpImaZbAXuZ78oDlqJc60RS7zEHwFiA7A';

export const supabase = createClient(supabaseUrl, supabaseKey);
