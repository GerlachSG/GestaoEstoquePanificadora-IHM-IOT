# Contexto e Plano Mestre de Refatoração de Telas (Mobile) - Panificadora Três Irmãos

> **Status:** APENAS PLANEJAMENTO (Nenhuma linha de código ou tela foi alterada nesta etapa).  
> **Objetivo:** Mapeamento completo de arquivos, regras de negócio e especificações de design solicitadas pelo usuário para padronização visual e operacional do aplicativo móvel.

---

## 0. Referências de Design & Golden Standard do Projeto

* **Golden Standard:** `app/novo-lote.tsx` — Considerada excelente pelo usuário. É a referência obrigatória para:
  * **Seletores:** Padrão do botão `ActionCard` (`titulo` no topo escuro `#303A3A` e `valor` no corpo inferior).
  * **Modais / Popups:** Fundo semi-transparente escuro `rgba(0,0,0,0.6)`, caixa centralizada branca com bordas arredondadas, lista limpa com divisores finos e botão inferior de cancelamento em vermelho (`Colors.status.urgente`).
  * **Caixas Automáticas:** Componentes com fundo cinza médio industrial (`tipoCor="grey"` do `ActionCard`), utilizado para dados gerados automaticamente pelo sistema.
* **Padrão de Cards:** `app/gestao-tarefas.tsx` — Referência obrigatória para listagens de itens com topo contendo título e badge de status, linhas de rótulo/valor com contraste nítido e bloco inferior de botões de ação com `BotaoIndustrial`.
* **Cores Base (`constants/Colors.ts`):**
  * `background`: `#212121` (fundo principal escuro das telas).
  * `header`: `#2E3A3C` (cabeçalho industrial escuro).
  * `surface`: `#DFE4F2` (fundo dos cards e painéis operacionais).
  * `surfaceLight`: `#FFFFFF` (fundo branco para botões e caixas destacadas).
  * `status`: `urgente` (`#FF2A1F`), `alerta` (`#FCFF3C`), `atencao` (`#FE9D5D`), `normal` (`#D9D9D9`).

> [!CAUTION]
> ### ⚠️ REGRA INVIOLÁVEL DE CORES INDUSTRIAIS & SVGS
> **É PROIBIDO utilizar cores de aviso (como `Colors.status.urgente`, `Colors.status.alerta` ou `Colors.status.atencao`) para finalidades decorativas, fundos de cards genéricos, bordas estáticas ou botões comuns.**
>
> 1. **Uso Exclusivamente Dinâmico:** As cores de status e os SVGs industriais associados ([`IconeUrgenteSvg`](file:///home/azureuser/devtest-app-tresirmaos-mobile/components/ui/IconesBase.tsx), [`IconeAlertaSvg`](file:///home/azureuser/devtest-app-tresirmaos-mobile/components/ui/IconesBase.tsx), [`IconeVencidoSvg`](file:///home/azureuser/devtest-app-tresirmaos-mobile/components/ui/IconesBase.tsx)) são reservados estritamente para sinalização operacional industrial em tempo real:
>    * Validade vencida ou iminente (cálculo FEFO dinâmico).
>    * Alertas de telemetria da câmara fria (temperatura fora do range).
>    * Níveis críticos de matéria-prima (abaixo da capacidade mínima cadastrada).
>    * Ação destrutiva ou descarte sanitário explícito.
> 2. **Padrão Neutro para Elementos Estruturais:** Todos os botões, cards, seletores e menus devem se manter na paleta corporativa neutra (`#212121`, `#2E3A3C`, `#DFE4F2`, `#FFFFFF` e `#D9D9D9` no modo automático). Nenhuma cor quente de advertência pode ser fixada hardcoded em elementos visuais normais.

---

## 1. Mapeamento Geral de Arquivos a Serem Modificados

| Item | Tela / Módulo | Arquivos Envolvidos | Status / Ação |
| :--- | :--- | :--- | :--- |
| **1** | **Novo Lote** | `app/novo-lote.tsx` | 🔒 **PROIBIDO MEXER** (100% preservada) |
| **2.1** | **Remover Lote (Matéria-Prima)** | `app/remover-lote/scanner.tsx`, `manual.tsx` | 🔒 **Perfeito** (manter intacto) |
| **2.2** | **Remover Lote (Produto Pronto)** | `app/_layout.tsx`, `app/remover-item/vitrine.tsx` | ✏️ Mudar título, seletor e cards de produtos |
| **3.1** | **Dashboard - Câmara Fria** | `app/dashboard/camara.tsx` | 🔒 **Sem mexer agora** |
| **3.2** | **Dashboard - Inventário** | `app/dashboard/inventario.tsx` | ✏️ Remover borda branca, alargar cards, popup de busca |
| **3.3** | **Dashboard - Alertas de Lote** | `app/dashboard/alertas.tsx` | ✏️ Remover borda branca, substituir busca por popup de urgência |
| **4** | **Gestão de Tarefas** | `app/gestao-tarefas.tsx` | 🔒 **Manter padrão atual** |
| **5** | **Planejamento IA** | `components/ui/ChatInterface.tsx` | ✏️ Adicionar micro-animações leves nativas |
| **6** | **Painel Gerencial** | `app/configuracoes/index.tsx` | ✏️ Botões do menu devem ser brancos |
| **6.1** | **Produtos e Limites** | `app/configuracoes/produtos.tsx` | 🔒 **Excelente** (manter intacto) |
| **6.2** | **Rendimento da Produção** | `app/_layout.tsx`, `app/relatorios/rendimento.tsx` | ✏️ Corrigir título no header, paleta de cores e empilhar cards |
| **6.3** | **Exportar Relatório** | `app/relatorios/exportar.tsx` | ✏️ Estilo Novo Lote (Mês 6 meses, Tipo, Qtd Registros cinza) |
| **7** | **Login** | `app/login.tsx` | ✏️ Repaginar com estética escura corporativa e logotipo |
| **8** | **Produção - Home & Turno** | `app/_layout.tsx`, `app/producao/index.tsx` | ✏️ Header padrão da home, remover badge e dividir turno em 2 cards |
| **8.1**| **Produção - Retirar Ingrediente**| `app/producao/retirar-ingrediente.tsx` | ✏️ Bordas arredondadas, restaurar fundo de card, popup estilo Novo Lote |
| **8.2**| **Produção - Registrar Fornada** | `app/producao/registrar-fornada.tsx` | ✏️ Bordas arredondadas, restaurar fundo de card, modais |
| **8.3**| **Produção - Registrar Perda** | `app/producao/registrar-perda.tsx` | ✏️ Bordas arredondadas, restaurar fundo, centralizar título |
| **8.4**| **Produção - Encerrar Turno** | `app/producao/fechar-turno.tsx` | ✏️ Arredondar card e encurtar texto do botão para "Encerrar Turno" |
| **9** | **Tokens e Cores Globais** | `constants/Colors.ts` | ✏️ Adicionar aliases (`fundoCard`, etc.) para sanar bugs de cores vazias |

---

## 2. Detalhamento Técnico de Cada Mudança

### 2.2 PRODUTO PRONTO (Vitrine de Fornadas)
* **Arquivos:**
  * `app/_layout.tsx` (linha ~192)
  * `app/remover-item/vitrine.tsx`
* **Instruções do Usuário:**
  1. *Título:* Alterar o título no Stack Screen de "Vitrine" para "Produtos".
  2. *Box de Categoria:* Substituir a caixa de seleção customizada pelo componente `ActionCard`:
     ```tsx
     <ActionCard 
       titulo="CATEGORIA" 
       valor={(categoriaSelecionada || 'TODOS').toUpperCase()} 
       onPress={() => setModalVisivel(true)} 
     />
     ```
  3. *Cards de Produtos:* Modificar o layout do `renderCard` para seguir rigorosamente o padrão visual do `app/gestao-tarefas.tsx`:
     * Container com cantos arredondados, fundo `Colors.surface` e borda escura.
     * Topo do card com nome do produto em destaque e badge com status de validade (cor ISO conforme horas restantes).
     * Linhas com rótulo escuro e valor destacado para: Data de Produção, Data de Validade e Quantidade Restante/Original.
     * Bloco inferior com botão de ação branco `BotaoIndustrial`.
  4. *Modal de Categoria:* Padronizar com o modal de seleção do Novo Lote (`modalOverlay`, `modalContainer`, itens com divisores finos e botão de cancelamento inferior).

---

### 3.2 DASHBOARD - INVENTÁRIO
* **Arquivo:** `app/dashboard/inventario.tsx`
* **Instruções do Usuário:**
  1. *Linha Branca:* Remover a borda branca `#CBD5E1` do container `styles.card` que causa o contorno indesejado na tela.
  2. *Largura dos Cards:* Expandir os cards horizontalmente diminuindo o `marginHorizontal` e ajustando os paddings laterais para dar maior respiro aos itens.
  3. *Título:* O título `"Inventário de Matéria-Prima"` não cabe na caixa. Reduzir levemente a fonte de 18 para 16px ou aplicar `flexWrap: 'wrap'` / `numberOfLines={1}` com alinhamento centralizado perfeito e espaçamento adequado para o ícone de status.
  4. *Busca por Insumo:* Remover o campo de texto ambíguo `"BUSCAR ITEM..."` e substituir por um seletor no estilo do Novo Lote:
     * Botão `ActionCard` ou `BotaoIndustrial` escrito **"BUSCAR INSUMO"**.
     * Ao tocar, abre um popup/modal no padrão do Novo Lote exibindo a lista de produtos/matérias-primas do catálogo para seleção rápida com opção "TODOS".

---

### 3.3 DASHBOARD - ALERTA DE LOTES
* **Arquivo:** `app/dashboard/alertas.tsx`
* **Instruções do Usuário:**
  1. *Linha Branca:* Remover o `borderColor: '#CBD5E1'` e contorno do container principal.
  2. *Filtro de Severidade:* Excluir o campo de digitação de busca livre.
  3. *Modal de Nível de Urgência:* Inserir um botão seletor de filtro (ex: `ActionCard titulo="NÍVEL DE URGÊNCIA" valor={filtroUrgencia || 'TODOS'}`) que abre um popup simples listando:
     * Todos
     * Urgente (Vencidos e <24h)
     * Alerta (Próximos do vencimento)
     * Normal / Ativo

---

### 5. PLANEJAMENTO DE IA
* **Arquivos:**
  * `app/planejamento-ia.tsx`
  * `components/ui/ChatInterface.tsx`
* **Instruções do Usuário:** Checar se tem animações que não pesam mas que deixariam o uso mais dinâmico.
* **Plano:**
  1. *Indicador de Resposta Inteligente:* Implementar pulso suave de opacidade nos 3 pontinhos de carregamento via `Animated.loop` nativo (custo zero de CPU, executado na thread de UI).
  2. *Entrada de Mensagens:* Adicionar transição sutil de Fade-in / Slide-in para mensagens que chegam da IA.
  3. *Botões de Ação Dinâmica:* Micro-feedback de escala ao pressionar as ações geradas pelo n8n.

---

### 6. PAINEL GERENCIAL
* **Arquivo:** `app/configuracoes/index.tsx`
* **Instruções do Usuário:**
  1. Todos os botões do menu devem ter fundo **branco**:
     * Alterar de `backgroundColor={Colors.status.normal}` para `backgroundColor={Colors.surfaceLight}` (ou `cor="branco"`).
     * Aplicar aos botões: "Produtos e Limites", "Rendimento da Produção" e "Exportar Relatório Sanitário".

---

### 6.2 RENDIMENTO DA PRODUÇÃO
* **Arquivos:**
  * `app/_layout.tsx`
  * `app/relatorios/rendimento.tsx`
* **Instruções do Usuário:**
  1. *Título do Header:* Declarar explicitamente a tela no Stack de `app/_layout.tsx`:
     ```tsx
     <Stack.Screen name="relatorios/rendimento" options={{ title: 'Rendimento' }} />
     ```
     (Atualmente exibe o caminho bruto `"relatorios/rendimento"` por ausência de declaração).
  2. *Paleta de Cores:* Substituir cores genéricas `#333`, `#888` e gradientes fora do padrão pelos tokens oficiais `Colors.surface`, `Colors.header`, `Colors.primary` e `Colors.text`.
  3. *Disposição dos Cards de Métricas:*
     * Atualmente: 3 cards espremidos lado a lado em `rowMetricas` (`flexDirection: 'row'`).
     * Correção: "Deitar um em cima do outro" — empilhar verticalmente em cards horizontais largos de largura total (100% da largura útil), exibindo de forma limpa e espaçada:
       * **CARD 1: CONSUMO DE INSUMOS** (ex: 200 kg)
       * **CARD 2: TOTAL PRODUZIDO** (ex: 180 kg)
       * **CARD 3: PERDAS REGISTRADAS** (ex: 2 kg)

---

### 6.3 EXPORTAR RELATÓRIO SANITÁRIO
* **Arquivo:** `app/relatorios/exportar.tsx`
* **Instruções do Usuário:**
  1. *Estilo Visual:* Eliminar as caixas escuras com chips `#333333` e adotar a estética limpa do Novo Lote.
  2. *Campo Mês de Referência:*
     * Usar `ActionCard titulo="MÊS DE REFERÊNCIA" valor={mesFormatado} onPress={abrirModalMeses} />`.
     * Ao clicar, abre modal no estilo do Novo Lote contendo a seleção dos últimos 6 meses (regra de guarda sanitária de 6 meses).
  3. *Campo Tipo de Evento:*
     * Usar `ActionCard titulo="TIPO DE EVENTO" valor={tipoEventoFormatado} onPress={abrirModalTipos} />`.
     * Opções no modal: Ambos / Todos, Apenas Vencimentos, Apenas Perdas/Quebras.
  4. *Caixa de Registros Encontrados:*
     * Exibir como a última caixa de visualização automática em cinza escuro industrial:
       ```tsx
       <ActionCard 
         titulo="REGISTROS ENCONTRADOS" 
         valor={`${movimentacoesFiltradas.length}`} 
         tipoCor="grey" 
       />
       ```
  5. *Botão de Ação:* Botão branco com texto escuro `BotaoIndustrial` com título `"GERAR E COMPARTILHAR"`.

---

### 7. LOGIN
* **Arquivo:** `app/login.tsx`
* **Instruções do Usuário:** "Totalmente fora do estilo do aplicativo, esse branco está totalmente fora".
* **Diagnóstico:** A tela possui `formContainer` em `Colors.surface` (`#DFE4F2`) com textos em `#FFFFFF` (branco sobre cinza claro), tornando o texto ilegível e quebrando o padrão dark industrial do app.
* **Plano de Refatoração:**
  1. Fundo da tela em `Colors.background` (`#212121`).
  2. Inclusão da logo oficial da padaria (`IconeLogoGespaoSvg`) centralizada no topo.
  3. Card de autenticação com cabeçalho escuro `#2E3A3C` e corpo estruturado com tipografia de alto contraste.
  4. Botão corporativo de login Microsoft padronizado com `BotaoIndustrial`.

---

### 8. MÓDULO DE PRODUÇÃO

#### A. Página Inicial & Turno (`app/producao/index.tsx` & `app/_layout.tsx`)
* **Antes de iniciar o turno:**
  1. *Remover Caixa "Turno Fechado":* Excluir o elemento `<View style={styles.badge}><Text>TURNO FECHADO</Text></View>`.
  2. *Remover Botão de Voltar:* Remover o botão de voltar no cabeçalho em `_layout.tsx` (`headerLeft: () => null`), impedindo navegação circular que trava ou volta para onde já estava.
* **Página Inicial do Turno:**
  1. *Título do Header:* Mudar o título no `_layout.tsx` de `"Módulo de Produção"` para o cabeçalho padrão da página inicial:
     * Logotipo da Três Irmãos à esquerda (`IconeLogoGespaoSvg`).
     * Título centralizado: `"Três Irmãos"`.
  2. *Caixa de Informações do Turno:* Substituir o container atual (que está vazando para as laterais) por **2 cards separados** com cantos arredondados e estilo industrial:
     * **Card 1: TURNO ATIVO** (Exibe o ID do turno em destaque).
     * **Card 2: DURAÇÃO DO EXPEDIENTE** (Exibe o cronômetro decorrido: ex: `02h 45m`).

#### B. Retirar Ingrediente (`app/producao/retirar-ingrediente.tsx`)
* **Instruções:**
  1. *Cantos Arredondados:* Adicionar `borderRadius: 12` no card principal, nas caixas de seleção e no card de recomendação FEFO.
  2. *Fundo Ilegível:* Corrigir `backgroundColor: Colors.fundoCard` (que estava `undefined` e ficava preto/transparente). Utilizar `Colors.surface` (`#DFE4F2`) garantindo contraste perfeito para textos escuros.
  3. *Popup de Insumos:* Substituir o modal atual pelo padrão do Novo Lote (`modalOverlay`, `modalContainer`, itens com divisores finos e botão vermelho "CANCELAR").

#### C. Registrar Fornada (`app/producao/registrar-fornada.tsx`)
* **Instruções:**
  1. *Cantos Arredondados:* Inserir `borderRadius: 12` em todos os blocos e campos de entrada.
  2. *Fundo Preto:* Corrigir a referência de cor de fundo para `Colors.surface` (`#DFE4F2`).
  3. *Modais de Seleção:* Padronizar seletores de produto e categoria com o estilo visual do Novo Lote.

#### D. Registrar Perda (`app/producao/registrar-perda.tsx`)
* **Instruções:**
  1. *Cantos Arredondados:* Adicionar `borderRadius: 12` no container e nos botões.
  2. *Fundo Preto:* Corrigir o fundo do card para `Colors.surface`.
  3. *Título Quebrado e Desalinhado:* O cabeçalho interno `"REGISTRAR PERDA OU QUEBRA"` deve receber alinhamento centralizado (`textAlign: 'center'`) e espaçamento adequado para evitar quebras esquisitas.
  4. *Modais:* Padronizar modais de seleção (Tipo de Origem, Insumo, Lote, Motivo) com o padrão do Novo Lote.

#### E. Encerrar Turno (`app/producao/fechar-turno.tsx`)
* **Instruções:**
  1. *Cantos Arredondados:* Adicionar `borderRadius: 12` no `styles.infoCard`.
  2. *Texto do Botão:* Encurtar de `"CONFIRMAR E ENCERRAR TURNO"` para simplesmente `"ENCERRAR TURNO"`.

---

### 9. AJUSTE DE CONSTANTES (`constants/Colors.ts`)
* Garantir no arquivo de constantes a existência segura dos aliases utilizados por telas operacionais:
  ```ts
  fundoCard: '#DFE4F2',    // Evita que telas operacionais fiquem com fundo preto/transparente
  fundoEscuro: '#212121',  // Alias para o fundo escuro do app
  botaoBranco: '#FFFFFF',  // Alias para botões brancos
  ```
  Isso resolve estruturalmente o problema onde telas de produção ficavam com fundo transparente/preto e texto preto ilegível.

---

## 3. Ordem de Execução Recomendada (Próximos Passos)

1. **Fase 1 (Fundação & Headers):** Atualização de `constants/Colors.ts` e rotas do `app/_layout.tsx` (títulos de Rendimento, Produtos e Header com logo da Produção).
2. **Fase 2 (Estoque & Dashboard):** Refatoração de `app/remover-item/vitrine.tsx`, `app/dashboard/inventario.tsx` e `app/dashboard/alertas.tsx`.
3. **Fase 3 (Gerencial & Relatórios):** Ajustes de botões em `app/configuracoes/index.tsx`, tela `app/relatorios/rendimento.tsx` e `app/relatorios/exportar.tsx`.
4. **Fase 4 (Módulo de Produção):** Refatoração de `app/producao/index.tsx`, `retirar-ingrediente.tsx`, `registrar-fornada.tsx`, `registrar-perda.tsx` e `fechar-turno.tsx`.
5. **Fase 5 (Login & Polimento):** Redesign de `app/login.tsx` e micro-animações em `components/ui/ChatInterface.tsx`.
