import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

export interface UserLoginResult {
  uid: string;
  email: string;
  role: 'Gestor' | 'Operador';
}

export const loginUsuario = async (email: string, senha: string): Promise<UserLoginResult> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    const userDocRef = doc(db, 'usuarios', email);
    const userDocSnap = await getDoc(userDocRef);

    // Bloqueia quem não tem documento no banco de dados
    if (!userDocSnap.exists()) {
      // Se não existe na coleção usuarios, nós deslogamos imediatamente da sessão e damos erro
      await auth.signOut();
      throw new Error('Usuário sem permissão de acesso no banco de dados.');
    }

    let role: 'Gestor' | 'Operador' = 'Operador';
    const data = userDocSnap.data();
    
    if (data.cargo === 'Gestor') {
      role = 'Gestor';
    }

    return {
      uid: user.uid,
      email: user.email || '',
      role,
    };
  } catch (error) {
    console.error('Erro no login:', error);
    throw error;
  }
};
