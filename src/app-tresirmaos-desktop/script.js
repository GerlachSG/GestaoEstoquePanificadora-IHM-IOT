import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDocsFromServer } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBNmPyufIeXznoUWvUxjp7JC9c82E5_5nk",
  authDomain: "tresirmaos-cloud.firebaseapp.com",
  projectId: "tresirmaos-cloud",
  storageBucket: "tresirmaos-cloud.firebasestorage.app",
  messagingSenderId: "544613186034",
  appId: "1:544613186034:web:5866cb7636280291bed36b",
  measurementId: "G-W0J67D3BZ1"
};

// Substitua "SuaSenhaAqui" pela senha real da conta on-premise
const USER_EMAIL = "on-premise@tresirmaos.com";
const USER_PASSWORD = "123456"; 

const PYTHON_API_URL = "http://127.0.0.1:5000/api/status";
const API_MEDIDAS = 'https://temperaturas-api-igor.loca.lt/api/medidas';
const API_ALERTAS = 'https://temperaturas-api-igor.loca.lt/api/alertas';

const SVG_VENCIDO = `<img src="assets/alerta.svg" width="30" height="30" alt="Vencido" title="Lote Vencido / Expirado">`;
const SVG_ATENCAO = `<img src="assets/atencao.svg" width="30" height="30" alt="Atenção" title="Atenção: Próximo ao limite ou Vencendo">`;
const SVG_URGENTE = `<img src="assets/urgente.svg" width="30" height="30" alt="Urgente" title="Urgente: Abaixo do Mínimo!">`;

function getIconeSvg(status) {
    if (status === 'vencido') return SVG_VENCIDO; // Amarelo
    if (status === 'alerta') return SVG_ATENCAO; // Laranja
    if (status === 'urgente') return SVG_URGENTE; // Vermelho
    return '';
}

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globais Compartilhadas
let lotesGlobais = [];

// --- FUNÇÕES UTILITÁRIAS (Igual n8n) ---
function normalizeText(str) {
    return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function parseDateBR(str) {
    if (!str || typeof str !== 'string') return null;
    const br = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) {
        const [, d, m, y] = br;
        return new Date(`${y}-${m}-${d}T00:00:00Z`);
    }
    const iso = new Date(str);
    if (!isNaN(iso.getTime())) return iso;
    return null;
}

function diffDays(fromDate, toDate) {
    const ms = toDate.getTime() - fromDate.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// --- RELÓGIO ---
function atualizarRelogio() {
    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, '0');
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    const segundo = String(agora.getSeconds()).padStart(2, '0');

    document.getElementById('data-atual').textContent = `${dia}/${mes}/${ano}`;
    document.getElementById('hora-atual').textContent = `${hora}:${minuto}:${segundo}`;
}

setInterval(atualizarRelogio, 1000);
atualizarRelogio();


// --- LOGIN AUTOMÁTICO ---
let isAutenticado = false;
async function realizarLogin() {
    try {
        await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD);
        console.log("Autenticado com sucesso no Firebase!");
        isAutenticado = true;
        recarregarDados(); // Chama os dados logo após logar
    } catch (error) {
        console.error("Erro ao realizar login no Firebase. Verifique e-mail e senha no script.js:", error);
        document.getElementById('inventario-lista').innerHTML = "<div class='loading-text' style='color: red;'>Falha na Autenticação. Verifique a senha no código.</div>";
        document.getElementById('alertas-lista').innerHTML = "<div class='loading-text' style='color: red;'>Acesso Bloqueado.</div>";
    }
}


// --- CARD 1: CÂMARA (API PYTHON) ---
async function carregarCamara() {
    try {
        const headers = {
            'Bypass-Tunnel-Reminder': 'true',
            'Accept': 'application/json'
        };

        const [resMedidas, resAlertas] = await Promise.all([
            fetch(API_MEDIDAS, { headers }),
            fetch(API_ALERTAS, { headers })
        ]);

        const dataMedidas = await resMedidas.json();
        const dataAlertas = await resAlertas.json();
        
        const tempValor = dataMedidas.temperaturaMedia ? parseFloat(dataMedidas.temperaturaMedia).toFixed(2) : '0.00';
        const umidValor = dataMedidas.umidadeMedia ? parseFloat(dataMedidas.umidadeMedia).toFixed(2) : '0.00';
        
        let statusGeral = 'normal';
        
        if (dataAlertas && dataAlertas.itens && dataAlertas.itens.length > 0) {
            const temVencido = dataAlertas.itens.some(a => a.status?.toLowerCase() === 'vencido');
            const temUrgente = dataAlertas.itens.some(a => a.status?.toLowerCase() === 'urgente');
            const temAlerta = dataAlertas.itens.some(a => a.status?.toLowerCase() === 'alerta');

            if (temVencido) statusGeral = 'vencido';
            else if (temUrgente) statusGeral = 'urgente';
            else if (temAlerta) statusGeral = 'alerta';
        }
        
        const tempBox = document.getElementById('camara-temperatura-box');
        const umidBox = document.getElementById('camara-umidade-box');
        const iconHeader = document.getElementById('camara-status-icon');
        
        if(iconHeader) iconHeader.innerHTML = getIconeSvg(statusGeral);
        
        document.getElementById('camara-temperatura-valor').innerHTML = `${tempValor} °C`;
        document.getElementById('camara-umidade-valor').innerHTML = `${umidValor} %`;

        let boxClass = 'status-normal';
        if (statusGeral === 'vencido') boxClass = 'status-vencido';
        else if (statusGeral === 'urgente') boxClass = 'status-urgente';
        else if (statusGeral === 'alerta') boxClass = 'status-alerta';

        tempBox.className = `status-box ${boxClass}`;
        umidBox.className = `status-box ${boxClass}`;
        
    } catch (error) {
        console.error("Erro ao conectar no Orquestrador:", error);
        document.getElementById('camara-temperatura-valor').textContent = "OFFLINE";
        document.getElementById('camara-umidade-valor').textContent = "OFFLINE";
        document.getElementById('camara-temperatura-box').className = 'status-box status-alerta';
        document.getElementById('camara-umidade-box').className = 'status-box status-alerta';
    }
}


// --- CARD 2: INVENTÁRIO (FIREBASE) ---
let inventarioItens = [];
let inventarioIndexAtual = 0;
let rotativoInterval;

async function carregarInventario() {
    if (!isAutenticado) return;
    try {
        // 1. Buscar Catálogo
        const catalogoSnapshot = await getDocsFromServer(collection(db, "catalogo"));
        const catalogo = {};
        catalogoSnapshot.forEach(doc => {
            catalogo[doc.id] = doc.data().nome;
        });

        // 2. Buscar Limites
        const limitesSnapshot = await getDocsFromServer(collection(db, "limites"));
        const limites = {};
        limitesSnapshot.forEach((doc) => {
            const data = doc.data();
            limites[doc.id] = {
                min: parseInt(data.min) || 0,
                max: parseInt(data.max) || 1
            };
        });

        // 3. Buscar Lotes e cruzar validades (Igual n8n)
        const hoje = new Date();
        hoje.setUTCHours(0, 0, 0, 0);
        
        lotesGlobais = [];
        const analiseEstoque = {};
        const lotesSnapshot = await getDocsFromServer(collection(db, "lotes"));
        
        lotesSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'ativo') {
                const itemRaw = data.item || data.produto || "";
                const peso = parseInt(data.pesoKg) || 0;
                
                lotesGlobais.push({
                    id: doc.id,
                    produto: itemRaw,
                    pesoKg: peso,
                    dataCriacao: data.dataCriacao || data.criadoEm || ""
                });

                const nomeNorm = normalizeText(itemRaw);
                if (!analiseEstoque[nomeNorm]) {
                    analiseEstoque[nomeNorm] = { total: 0, vencido: 0, expirando7d: 0 };
                }
                
                analiseEstoque[nomeNorm].total += peso;
                
                const validadeDate = parseDateBR(data.validade || data.dataValidade);
                if (validadeDate) {
                    const dias = diffDays(hoje, validadeDate);
                    if (dias < 0) {
                        analiseEstoque[nomeNorm].vencido += peso;
                    } else if (dias <= 7) {
                        analiseEstoque[nomeNorm].expirando7d += peso;
                    }
                }
            }
        });

        // 4. Montar Array cruzando Catálogo, Limites e Datas
        inventarioItens = [];
        for (const id of Object.keys(catalogo)) {
            const nomeCat = catalogo[id];
            const nomeNorm = normalizeText(nomeCat);
            const lim = limites[id] || { min: 0, max: 1 };
            
            const info = analiseEstoque[nomeNorm] || { total: 0, vencido: 0, expirando7d: 0 };
            const estoqueValido = info.total - info.vencido;
            const estoqueProjetado = estoqueValido - info.expirando7d;
            
            const prog = lim.max > 0 ? (estoqueValido / lim.max) * 100 : 0;
            
            let stat = 'normal';
            
            // Lógica 1: Caiu abaixo do mínimo
            if (estoqueValido < lim.min) {
               stat = 'urgente';
            } 
            // Lógica 2: Vai cair abaixo do mínimo por vencimento ou já está próximo na margem 1.5x
            else if ((estoqueProjetado < lim.min && info.expirando7d > 0) || (estoqueValido <= (lim.min * 1.5))) {
               stat = 'alerta';
            }
            // Lógica 3: Vencidos em estoque
            else if (info.vencido > 0) {
                stat = 'vencido';
            }

            inventarioItens.push({
                id: id,
                nome: nomeCat,
                atual: estoqueValido,
                max: lim.max,
                min: lim.min,
                porcentagem: Math.min(100, Math.max(0, prog)),
                status: stat
            });
        }

        // 4. Ordenar Inventário
        const pesoStatus = { urgente: 1, alerta: 2, vencido: 3, normal: 4 };
        inventarioItens.sort((a, b) => {
            const pesoA = pesoStatus[a.status] || 99;
            const pesoB = pesoStatus[b.status] || 99;
            if (pesoA !== pesoB) return pesoA - pesoB;
            return a.nome.localeCompare(b.nome);
        });
        
        if (rotativoInterval) clearInterval(rotativoInterval);
        if (inventarioIndexAtual >= inventarioItens.length) inventarioIndexAtual = 0;
        renderizarInventarioPage();
        rotativoInterval = setInterval(avancarInventarioPage, 10000); 

    } catch (error) {
        console.error("Erro ao carregar inventário (Firestore SDK):", error);
    }
}

function renderizarInventarioPage() {
    const container = document.getElementById('inventario-lista');
    if(!container) return;
    
    container.classList.remove('fade-out');
    container.innerHTML = '';
    
    if (inventarioItens.length === 0) {
         container.innerHTML = "<div class='loading-text'>Nenhum item configurado.</div>";
         return;
    }

    const pagina = inventarioItens.slice(inventarioIndexAtual, inventarioIndexAtual + 4);
    
    pagina.forEach(item => {
        const nomeCapitalized = item.nome.charAt(0).toUpperCase() + item.nome.slice(1);
        let barClass = 'normal-bg'; 
        if (item.status === 'vencido') barClass = 'vencido-bg';
        else if (item.status === 'urgente') barClass = 'urgente-bg';
        else if (item.status === 'alerta') barClass = 'alerta-bg'; 

        const iconeItem = getIconeSvg(item.status);
        
        const pMinimoBruto = item.max > 0 ? (item.min / item.max) * 100 : 0;
        const porcentagemMinimo = Math.min(100, Math.max(0, pMinimoBruto));

        const html = `
            <div class="inventario-item">
                <div class="item-header">
                    <div class="item-name-container">
                        <span class="item-name">${nomeCapitalized}</span>
                        ${iconeItem ? `<span class="icon-svg" style="margin-left: 8px;">${iconeItem}</span>` : ''}
                    </div>
                    <div class="item-values">
                        <strong>${item.atual}kg</strong> <span class="item-max">/ ${item.max}kg</span>
                    </div>
                </div>
                <div class="progress-bar-wrapper">
                    <div class="progress-bar-container barra-fundo">
                        <div class="progress-bar ${barClass} barra-preenchida" style="width: ${item.porcentagem}%"></div>
                        <div class="marcador-minimo" style="left: ${porcentagemMinimo}%"></div>
                        <div class="area-indicador-text" style="left: 0; width: ${porcentagemMinimo}%">
                            <span class="texto-indicador">MIN</span>
                        </div>
                        <div class="area-indicador-text" style="left: ${porcentagemMinimo}%; right: 0;">
                            <span class="texto-indicador">IDEAL</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function avancarInventarioPage() {
    const container = document.getElementById('inventario-lista');
    if(!container) return;
    container.classList.add('fade-out');
    
    setTimeout(() => {
        inventarioIndexAtual += 4;
        if (inventarioIndexAtual >= inventarioItens.length) {
            inventarioIndexAtual = 0;
        }
        renderizarInventarioPage();
    }, 500); 
}


// --- CARD 3: ALERTAS GERAIS (TAREFAS) ---
let tarefasItens = [];
let tarefasIndexAtual = 0;
let rotativoTarefasInterval;

async function carregarTarefas() {
    if (!isAutenticado) return;
    try {
        const tarefasSnapshot = await getDocsFromServer(collection(db, "tarefas"));
        let tarefasPendentes = [];
        
        tarefasSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'pendente') {
                tarefasPendentes.push({
                    id: doc.id,
                    tipo: data.tipo,
                    status: data.status,
                    produto: data.produto || data.produtoAlvo || 'Desconhecido',
                    loteId: data.loteId || null,
                    instrucao: data.instrucao || '',
                    quantidadeRequerida: data.quantidadeRequerida || 0,
                    criadoEm: data.criadoEm || new Date().toISOString()
                });
            }
        });

        tarefasItens = tarefasPendentes.sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));

        if (rotativoTarefasInterval) clearInterval(rotativoTarefasInterval);
        if (tarefasIndexAtual >= tarefasItens.length) tarefasIndexAtual = 0;
        renderizarTarefasPage();
        
        // Iniciar rotação apenas se tiver mais que 3 tarefas
        if (tarefasItens.length > 3) {
            rotativoTarefasInterval = setInterval(avancarTarefasPage, 12000); // Roda a cada 12s para dar tempo de ler
        }

    } catch (error) {
         console.error("Erro ao carregar tarefas (Firestore SDK):", error);
    }
}

function renderizarTarefasPage() {
    const container = document.getElementById('alertas-lista');
    if(!container) return;
    
    container.classList.remove('fade-out');
    container.innerHTML = '';
    
    if (tarefasItens.length === 0) {
        container.innerHTML = "<div class='loading-text'>Nenhum alerta crítico no momento.</div>";
        return;
    }

    const pagina = tarefasItens.slice(tarefasIndexAtual, tarefasIndexAtual + 3);

    pagina.forEach(tarefa => {
        let acaoTexto = "VERIFICAR";
        let acaoClass = "bg-alerta";
        let barraProgressoHTML = '';
        
        if (tarefa.tipo === 'descarte') {
            acaoTexto = "DESCARTAR";
            acaoClass = "bg-urgente"; 
        } else if (tarefa.tipo === 'reposicao' || tarefa.tipo === 'reposição') {
            acaoTexto = "REPOR";
            acaoClass = tarefa.instrucao.includes("Status Urgente") ? "bg-urgente" : "bg-alerta";
            
            // Lógica de cálculo do progresso da reposição (similar ao app React Native)
            const sumLotes = lotesGlobais
                .filter(l => (l.produto.toLowerCase() === tarefa.produto.toLowerCase()) && (l.dataCriacao >= tarefa.criadoEm))
                .reduce((sum, l) => sum + l.pesoKg, 0);
            
            const req = parseInt(tarefa.quantidadeRequerida) || 1; // Evita divisão por zero
            const percentage = Math.min(100, Math.max(0, (sumLotes / req) * 100));
            
            barraProgressoHTML = `
                <div class="alerta-progresso-container">
                    <div class="alerta-progresso-text">Progresso da Reposição: ${sumLotes.toFixed(1)} / ${tarefa.quantidadeRequerida} KG</div>
                    <div class="alerta-progresso-bar-bg">
                        <div class="alerta-progresso-bar-fill" style="width: ${percentage}%;"></div>
                    </div>
                </div>
            `;
        } else if (tarefa.tipo === 'manutencao' || tarefa.tipo === 'manutenção') {
            acaoTexto = "MANUTENÇÃO";
            acaoClass = tarefa.instrucao.includes("Status Urgente") ? "bg-urgente" : "bg-alerta";
        }

        const html = `
            <div class="alerta-card">
                <div class="alerta-header">
                    <div class="alerta-info">
                        <div class="alerta-label">ITEM / ALVO</div>
                        <div class="alerta-produto">${tarefa.produto} ${tarefa.loteId ? `(Lote ${tarefa.loteId})` : ''}</div>
                    </div>
                    <div class="alerta-acao ${acaoClass}">
                        ${acaoTexto}
                    </div>
                </div>
                ${barraProgressoHTML}
                <div class="alerta-instrucao">
                    ${tarefa.instrucao}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function avancarTarefasPage() {
    const container = document.getElementById('alertas-lista');
    if(!container) return;
    
    container.classList.add('fade-out');
    
    setTimeout(() => {
        tarefasIndexAtual += 3;
        if (tarefasIndexAtual >= tarefasItens.length) {
            tarefasIndexAtual = 0;
        }
        renderizarTarefasPage();
    }, 500); 
}


// --- INICIALIZAÇÃO E CICLO DE REFRESH ---
function recarregarDados() {
    carregarCamara();
    if (isAutenticado) {
        // Carrega inventário primeiro para garantir que lotesGlobais seja populado
        carregarInventario().then(() => {
            carregarTarefas();
        });
    }
}

// Inicia o processo logando primeiro
realizarLogin();

// Atualiza a cada 30 segundos (30000 ms) para garantir sincronia constante
setInterval(recarregarDados, 30000);
