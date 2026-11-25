import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Auth } from '@angular/fire/auth';

const supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
const supabaseAnonKey =
  'YOUR_SUPABASE_ANON_KEY';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private auth = inject(Auth);
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: async () => {
        const usuario = this.auth.currentUser;
        if (!usuario) return null;
        return await usuario.getIdToken();
      },
    });
  }

  get db(): SupabaseClient {
    return this.client;
  }
}
