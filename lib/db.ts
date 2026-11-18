import { createClient } from '@supabase/supabase-js';
export function db(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Supabase environment variables are missing');return createClient(url,key,{auth:{persistSession:false}})}
export function validToken(t:unknown):t is string{return typeof t==='string'&&/^[a-f0-9]{64}$/.test(t)}
export function tokenHash(t:string){const {createHash}=require('crypto');return createHash('sha256').update(t).digest('hex') as string}
