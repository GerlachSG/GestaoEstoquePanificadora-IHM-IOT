export function calcularDiasRestantes(dataValidade: string): number | null {
  // Assume "DD/MM/YYYY" format
  const partesRef = dataValidade.split('/');
  if (partesRef.length !== 3) return null;

  const dia = parseInt(partesRef[0], 10);
  const mes = parseInt(partesRef[1], 10) - 1; // JS months are 0-indexed
  const ano = parseInt(partesRef[2], 10);
  
  const dataVal = new Date(ano, mes, dia);
  dataVal.setHours(0, 0, 0, 0);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const msDiferenca = dataVal.getTime() - hoje.getTime();
  return Math.ceil(msDiferenca / (1000 * 60 * 60 * 24));
}

export function classificarValidade(diasRestantes: number | null): 'vencido' | 'urgente' | 'alerta' | 'normal' {
  if (diasRestantes === null) return 'normal';
  
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 7) return 'urgente';
  if (diasRestantes <= 30) return 'alerta';
  return 'normal';
}