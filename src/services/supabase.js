export const SUPABASE_URL = 'https://owxevzgjqdmdluxcehim.supabase.co';
export const SUPABASE_PUBLIC_KEY = 'sb_publishable_0QYy50Ay1hscTPd4vOB9rA_KSJflXjv';
let pending;
export function getClient() {
  if (!SUPABASE_PUBLIC_KEY) return Promise.reject(new Error('Falta configurar a chave pública do novo projeto Supabase.'));
  pending ??= import('https://esm.sh/@supabase/supabase-js@2.57.4').then(({createClient}) =>
    createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
  ).catch(error => {pending = undefined; throw error;});
  return pending;
}
export function authMessage(error) {
  const text = error?.message || '';
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(text)) return 'Confirme seu e-mail antes de entrar.';
  if (/rate limit|too many|security purposes/i.test(text)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (/provider.*not enabled|unsupported provider/i.test(text)) return 'O login Google ainda precisa ser habilitado no Supabase.';
  if (/fetch|network|import/i.test(text)) return 'Não foi possível conectar. Confira sua conexão e tente novamente.';
  return text || 'Não foi possível concluir a operação.';
}
