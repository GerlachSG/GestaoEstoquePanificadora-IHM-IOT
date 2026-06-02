import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Globais Compartilhadas
let lotesGlobais = [];

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
        const response = await fetch(PYTHON_API_URL);
        if (!response.ok) throw new Error("Erro na API da Câmara");
        const data = await response.json();
        
        const tempValor = data.temperatura || 0;
        const umidValor = data.umidade || 0;
        
        const tempBox = document.getElementById('camara-temperatura-box');
        const umidBox = document.getElementById('camara-umidade-box');
        
        document.getElementById('camara-temperatura-valor').innerHTML = `${tempValor}ºC ${data.alerta_temp ? '<span class="material-symbols-outlined">warning</span>' : ''}`;
        document.getElementById('camara-umidade-valor').innerHTML = `${umidValor}% ${data.alerta_umid ? '<span class="material-symbols-outlined">warning</span>' : ''}`;

        tempBox.className = 'status-box ' + (data.alerta_temp ? 'status-alerta' : 'status-normal');
        umidBox.className = 'status-box ' + (data.alerta_umid ? 'status-alerta' : 'status-normal');
        
    } catch (error) {
        console.error("Erro ao conectar no Servidor Python:", error);
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
        const limites = {};
        const estoques = {};

        // 1. Buscar Limites com SDK oficial
        const limitesSnapshot = await getDocs(collection(db, "limites"));
        limitesSnapshot.forEach((doc) => {
            const data = doc.data();
            limites[doc.id] = {
                min: parseInt(data.min) || 0,
                max: parseInt(data.max) || 100,
                nome: doc.id.replace(/_/g, ' ') 
            };
        });

        // 2. Buscar Lotes com SDK oficial E popular array global
        lotesGlobais = [];
        const lotesSnapshot = await getDocs(collection(db, "lotes"));
        lotesSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'ativo') {
                const itemRaw = data.item || data.produto || "";
                
                // Salvar para o escopo global (usado pelos alertas de reposição)
                lotesGlobais.push({
                    id: doc.id,
                    produto: itemRaw,
                    pesoKg: parseInt(data.pesoKg) || 0,
                    dataCriacao: data.dataCriacao || data.criadoEm || ""
                });

                // Lógica original de agregação do inventário
                const itemNormalized = itemRaw.toLowerCase().replace(/ /g, '_');
                const peso = parseInt(data.pesoKg) || 0;
                
                let itemKey = Object.keys(limites).find(k => k === itemNormalized || limites[k].nome.toLowerCase() === itemRaw.toLowerCase()) || itemNormalized;

                if (!estoques[itemKey]) estoques[itemKey] = 0;
                estoques[itemKey] += peso;
            }
        });

        // 3. Montar Array
        inventarioItens = [];
        for (const [key, limite] of Object.entries(limites)) {
            const atual = estoques[key] || 0;
            const maxVal = limite.max > 0 ? limite.max : 1;
            const porcentagem = Math.min((atual / maxVal) * 100, 100);
            const emAlerta = atual < limite.min;
            
            inventarioItens.push({
                nome: limite.nome,
                atual: atual,
                max: limite.max,
                porcentagem: porcentagem,
                emAlerta: emAlerta
            });
        }
        
        if (rotativoInterval) clearInterval(rotativoInterval);
        inventarioIndexAtual = 0;
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
        if (item.emAlerta) {
            barClass = 'alerta-bg'; 
        } else if (item.porcentagem > 0 && item.porcentagem < 100) {
            barClass = ''; 
        }

        const html = `
            <div class="inventario-item">
                <div class="item-header">
                    <div class="item-name-container">
                        <span class="item-name">${nomeCapitalized}</span>
                        ${item.emAlerta ? '<span class="material-symbols-outlined icon-alerta" style="display:inline;">warning</span>' : ''}
                    </div>
                    <div class="item-values">
                        <strong>${item.atual}kg</strong> <span class="item-max">/ ${item.max}kg</span>
                    </div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar ${barClass}" style="width: ${item.porcentagem}%"></div>
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
        const tarefasSnapshot = await getDocs(collection(db, "tarefas"));
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
        tarefasIndexAtual = 0;
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
            acaoClass = "bg-alerta";
            
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
            acaoClass = "bg-urgente";
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

// Atualiza a cada 10 minutos (600000 ms)
setInterval(recarregarDados, 600000);