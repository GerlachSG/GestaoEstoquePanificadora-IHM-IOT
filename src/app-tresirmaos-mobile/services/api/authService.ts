// services/api/authService.ts
import { storeToken, clearToken } from './apiClient';
import { getSecureItem, setSecureItem, removeSecureItem } from './secureStorage';

const SESSION_KEY = 'tresirmaos_session';

export interface AuthSession {
  token: string;
  email: string;
  role: 'Gestor' | 'Operador' | 'Producao';
}

function base64DecodeSafe(input: string): string {
  if (typeof atob === 'function') {
    return atob(input);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = String(input).replace(/=+$/, '');
  let output = '';
  for (let bc = 0, bs = 0, buffer = 0, idx = 0; idx < str.length; idx++) {
    const bufferChar = str.charAt(idx);
    const charIndex = chars.indexOf(bufferChar);
    if (~charIndex) {
      bs = bc % 4 ? bs * 64 + charIndex : charIndex;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

function decodeJwtPayload(token: string): Record<string, any> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Token JWT inválido');

    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';

    const decoded = base64DecodeSafe(payload);
    return JSON.parse(decoded);
  } catch {
    throw new Error('Falha ao decodificar token JWT.');
  }
}

function extractRole(claims: Record<string, any>): 'Gestor' | 'Operador' | 'Producao' {
  // 1. Tenta ler do array ou string de "roles" / "groups"
  const rawRoles: any[] = [];
  if (Array.isArray(claims.roles)) rawRoles.push(...claims.roles);
  else if (claims.roles) rawRoles.push(claims.roles);
  if (Array.isArray(claims.role)) rawRoles.push(...claims.role);
  else if (claims.role) rawRoles.push(claims.role);
  if (Array.isArray(claims.groups)) rawRoles.push(...claims.groups);

  const rolesNormalizadas = rawRoles.map((r) => String(r).toLowerCase());

  if (rolesNormalizadas.some((r) => r.includes('gestor') || r.includes('admin') || r.includes('gerente') || r.includes('gestao'))) {
    return 'Gestor';
  }
  if (rolesNormalizadas.some((r) => r.includes('operador') || r.includes('balcao') || r.includes('vendas'))) {
    return 'Operador';
  }
  if (rolesNormalizadas.some((r) => r.includes('producao') || r.includes('padeiro') || r.includes('forneiro'))) {
    return 'Producao';
  }

  // 2. Tenta ler dos claims customizados de cargo / departamento
  const cargo =
    claims['extension_Cargo'] ||
    claims['Cargo'] ||
    claims['cargo'] ||
    claims['jobTitle'] ||
    claims['extension_cargo'] ||
    claims['department'] ||
    claims['departamento'];

  const cargoNormalizado = String(cargo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (cargoNormalizado.includes('gestor') || cargoNormalizado.includes('admin') || cargoNormalizado.includes('gerente') || cargoNormalizado.includes('gestao')) {
    return 'Gestor';
  }
  if (cargoNormalizado.includes('operador') || cargoNormalizado.includes('balcao') || cargoNormalizado.includes('vendas')) {
    return 'Operador';
  }
  if (cargoNormalizado.includes('producao') || cargoNormalizado.includes('padeiro') || cargoNormalizado.includes('forneiro')) {
    return 'Producao';
  }

  // 3. Tenta identificar pelo e-mail ou nome de usuário
  const emailIdentificador = String(extractEmail(claims)).toLowerCase();
  if (emailIdentificador.includes('gestor') || emailIdentificador.includes('gerente') || emailIdentificador.includes('admin')) {
    return 'Gestor';
  }
  if (emailIdentificador.includes('operador')) {
    return 'Operador';
  }
  if (emailIdentificador.includes('padeiro') || emailIdentificador.includes('producao')) {
    return 'Producao';
  }

  // Se não foi explicitamente atribuído como padeiro/operador, o padrão no painel é Gestor para liberar o acesso gerencial
  return 'Gestor';
}

function extractEmail(claims: Record<string, any>): string {
  return (
    claims['preferred_username'] ||
    claims['email'] ||
    claims['upn'] ||
    claims['unique_name'] ||
    claims['emails']?.[0] ||
    ''
  );
}

/**
 * Recebe o token do navegador (Fluxo Interativo com 2FA via PKCE)
 */
export async function processarLoginMicrosoft(accessToken: string): Promise<AuthSession> {
  try {
    const claims = decodeJwtPayload(accessToken);
    const role = extractRole(claims);
    const userEmail = extractEmail(claims) || 'usuario@tresirmaos.com';

    const session: AuthSession = {
      token: accessToken,
      email: userEmail,
      role,
    };

    // Persiste token na API Client (para os cabeçalhos) e sessão de forma segura criptografada
    await storeToken(accessToken);
    await setSecureItem(SESSION_KEY, JSON.stringify(session));

    return session;
  } catch (error: any) {
    console.error('Erro ao processar token Entra ID:', error);
    throw new Error('Falha ao processar as credenciais corporativas.');
  }
}

export async function getStoredSession(): Promise<AuthSession | null> {
  try {
    const sessionStr = await getSecureItem(SESSION_KEY);
    if (!sessionStr) return null;
    return JSON.parse(sessionStr) as AuthSession;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await clearToken();
  await removeSecureItem(SESSION_KEY);
}