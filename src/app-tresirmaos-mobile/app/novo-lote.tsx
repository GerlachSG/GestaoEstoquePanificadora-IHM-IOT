// app/novo-lote.tsx
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import qrcode from 'qrcode-generator';
import React, { useState, useEffect } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';

import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { Colors } from '../constants/Colors';
import { LotePaylod, registrarEtiquetas } from '../services/firebase/loteService';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';

interface Etiqueta {
    id: string;
    item: string;
    loteFornecedor: string;
    validade: string;
    idLote: string;
    pesoKg: number;
}

function gerarIdLote(): string {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const num = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const l1 = letras[Math.floor(Math.random() * letras.length)];
    const l2 = letras[Math.floor(Math.random() * letras.length)];
    return `L-F${num}-${l1}${l2}`;
}

function formatarDataBR(date: Date): string {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

export default function NovoLoteScreen() {
    const [itemSelecionado, setItemSelecionado] = useState('');
    const [loteFornecedor, setLoteFornecedor] = useState('');
    const [pesoLote, setPesoLote] = useState('');
    const [pesoUnidade, setPesoUnidade] = useState<'KG' | 'g'>('KG');
    const [dataValidade, setDataValidade] = useState<Date | null>(null);
    const [quantidade, setQuantidade] = useState(1);
    const [mostrarDatePicker, setMostrarDatePicker] = useState(false);
    const [modalItemVisivel, setModalItemVisivel] = useState(false);
    const [etiquetasGeradas, setEtiquetasGeradas] = useState<Etiqueta[]>([]);
    const [modalEtiquetaVisivel, setModalEtiquetaVisivel] = useState(false);

    // Novos estados da Impressão em Lote
    const [modalChecklistVisivel, setModalChecklistVisivel] = useState(false);
    const [canceladosTemporarios, setCanceladosTemporarios] = useState<number[]>([]);
    const [itensDisponiveis, setItensDisponiveis] = useState<string[]>([]);
    const [novoItemNome, setNovoItemNome] = useState('');
    const [modalCadastroItemVisivel, setModalCadastroItemVisivel] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'catalogo'), (snapshot) => {
            const list = snapshot.docs.map(doc => doc.data().nome as string);
            setItensDisponiveis(list.sort((a, b) => a.localeCompare(b)));
        }, (error) => {
            console.log('Firebase onSnapshot (catalogo) erro na leitura (provavelmente deslogado):', error);
        });
        return () => unsub();
    }, []);

    const cadastrarNovoItem = async () => {
        if (!novoItemNome.trim()) {
            Alert.alert('Erro', 'O nome do produto não pode ser vazio.');
            return;
        }

        const idProd = novoItemNome.trim().toLowerCase().replace(/\s+/g, '_');

        try {
            await setDoc(doc(db, 'catalogo', idProd), { nome: novoItemNome.trim() });
            
            // Cria um limite zerado para não bugar o FEFO global posteriormente
            await setDoc(doc(db, 'limites', idProd), { min: 0, max: 0 });

            setNovoItemNome('');
            setModalCadastroItemVisivel(false);
            Alert.alert('Sucesso', 'Item adicionado ao catálogo!');
        } catch (e) {
            Alert.alert('Erro', 'Falha ao salvar no catálogo.');
        }
    };

    const onChangeData = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS !== 'ios') {
            setMostrarDatePicker(false);
        }
        if (selectedDate) {
            setDataValidade(selectedDate);
        }
    };

    const handleGerarEtiqueta = () => {
        if (!itemSelecionado) {
            Alert.alert('Atenção', 'Selecione um item.');
            return;
        }
        if (!pesoLote || isNaN(Number(pesoLote.replace(',', '.')))) {
            Alert.alert('Atenção', `Digite um peso válido em ${pesoUnidade}.`);
            return;
        }
        if (!dataValidade) {
            Alert.alert('Atenção', 'Selecione a data de validade.');
            return;
        }

        let pesoConvertido = Number(pesoLote.replace(',', '.'));
        if (pesoUnidade === 'g') {
            pesoConvertido = pesoConvertido / 1000;
        }

        const novaEtiqueta: Etiqueta = {
            id: Date.now().toString(),
            item: itemSelecionado,
            loteFornecedor: loteFornecedor.trim(),
            validade: formatarDataBR(dataValidade),
            idLote: gerarIdLote(),
            pesoKg: pesoConvertido,
        };

        setEtiquetasGeradas((prev) => [...prev, novaEtiqueta]);
        setQuantidade(1);
        setLoteFornecedor(''); // Limpar caso gere lote novo
        setPesoUnidade('KG');
        setModalEtiquetaVisivel(true);
    };

    const handleImprimir = async () => {
        try {
            let htmlContent = `
        <html>
        <head>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', monospace; 
              margin: 0; 
              padding: 0; 
              width: 300px; /* Largura aproximada de bobina 80mm */
            }
            .etiqueta { 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center;
              border-bottom: 2px dashed #000;
              padding-top: 20px;
              padding-bottom: 20px;
              page-break-after: always; /* Cada etiqueta numa "página" contínua do PDF */
            }
            .titulo { font-size: 22px; font-weight: bold; margin-bottom: 5px; text-align: center; }
            .lote { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
            .id { font-size: 14px; margin-bottom: 10px; }
          </style>
        </head>
        <body>
      `;

            for (let i = 0; i < quantidade; i++) {
                const subId = `${ultimaEtiqueta?.idLote}-${String(i + 1).padStart(2, '0')}`;

                const qr = qrcode(0, 'M');
                qr.addData(JSON.stringify({
                    lote: ultimaEtiqueta?.idLote,
                    subId: subId,
                    item: ultimaEtiqueta?.item,
                    validade: ultimaEtiqueta?.validade
                }));
                qr.make();
                const imgTag = qr.createImgTag(6, 0);

                htmlContent += `
          <div class="etiqueta">
            <div class="titulo">${ultimaEtiqueta?.item}</div>
            <div class="lote">LOTE INT: ${ultimaEtiqueta?.idLote}</div>
            ${ultimaEtiqueta?.loteFornecedor ? `<div class="lote">LOTE EXT: ${ultimaEtiqueta?.loteFornecedor}</div>` : ''}
            <div class="lote">VAL: ${ultimaEtiqueta?.validade}</div>
            <div class="lote">PESO POR VOL: ${ultimaEtiqueta?.pesoKg} KG</div>
            <div class="id">ID: ${subId}</div>
            ${imgTag}
          </div>
        `;
            }

            htmlContent += '</body></html>';

            await Print.printAsync({
                html: htmlContent,
                width: 300, // Força a largura do papel para 80mm
            });

        } catch (err) {
            Alert.alert('Erro', 'Não foi possível preview/imprimir a etiqueta.');
        }
    };

    const handleAbrirCancelamento = () => {
        setCanceladosTemporarios([]); // zera
        setModalEtiquetaVisivel(false);
        setModalChecklistVisivel(true);
    };

    const alternarCancelamento = (index: number) => {
        setCanceladosTemporarios((prev) =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const handleConfirmarCancelamento = () => {
        // Logica faria o cancelamento dos IDs selecionados no backend
        Alert.alert('Simulação', `${canceladosTemporarios.length} etiqueta(s) cancelada(s) com sucesso.`);
        setModalChecklistVisivel(false);
        setModalEtiquetaVisivel(true); // volta para a visualização principal do lote
    };

    const handleFinalizar = async () => {
        if (ultimaEtiqueta) {
            try {
                const payload: LotePaylod[] = [];
                for (let i = 0; i < quantidade; i++) {
                    if (!canceladosTemporarios.includes(i)) {
                        const subId = `${ultimaEtiqueta.idLote}-${String(i + 1).padStart(2, '0')}`;
                        payload.push({
                            id: subId,
                            item: ultimaEtiqueta.item,
                            loteFornecedor: ultimaEtiqueta.loteFornecedor,
                            validade: ultimaEtiqueta.validade,
                            pesoKg: ultimaEtiqueta.pesoKg,
                            masterLote: ultimaEtiqueta.idLote,
                            status: 'ativo',
                            dataCriacao: new Date().toISOString()
                        });
                    }
                }

                await registrarEtiquetas(payload);
                Alert.alert('Sucesso', 'Lote finalizado e sincronizado na Nuvem.');
            } catch (error) {
                Alert.alert('Erro', 'Houve uma falha ao comunicar com o servidor da fábrica.');
                return;
            }
        }

        setModalEtiquetaVisivel(false);
        setModalChecklistVisivel(false);
        setItemSelecionado('');
        setDataValidade(null);
        setEtiquetasGeradas([]);
        setQuantidade(1);
    };

    const ultimaEtiqueta =
        etiquetasGeradas.length > 0
            ? etiquetasGeradas[etiquetasGeradas.length - 1]
            : null;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Campo ITEM */}
                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>ITEM</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.valor}
                        onPress={() => setModalItemVisivel(true)}
                    >
                        <Text style={styles.valorTexto}>
                            {itemSelecionado || 'SELECIONAR'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>PESO POR VOLUME (KG)</Text>
                    </View>
                    <View style={styles.valorInputBox}>
                        <TextInput
                            style={styles.inputPeso}
                            placeholder="Ex: 25.5"
                            placeholderTextColor="#768AA4"
                            keyboardType="numeric"
                            value={pesoLote}
                            onChangeText={setPesoLote}
                        />
                    </View>
                </View>

                {/* Campo LOTE FORNECEDOR */}
                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>LOTE FORNECEDOR (Opcional)</Text>
                    </View>
                    <View style={styles.valorInputBox}>
                        <TextInput
                            style={styles.inputPeso}
                            placeholder="Ex: LF-82A"
                            placeholderTextColor="#768AA4"
                            value={loteFornecedor}
                            onChangeText={setLoteFornecedor}
                        />
                    </View>
                </View>

        {/* Campo VALIDADE */}
                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>VALIDADE</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.valor}
                        onPress={() => {
                            if (Platform.OS === 'web') {
                                Alert.alert('Aviso', 'O seletor de data funciona apenas no celular (Expo Go).');
                                return;
                            }
                            setMostrarDatePicker(true);
                        }}
                    >
                        <Text style={styles.valorTexto}>
                            {dataValidade ? formatarDataBR(dataValidade) : '00/00/0000'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Campo ID LOTE */}
                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>ID LOTE</Text>
                    </View>
                    <View style={styles.valorDesabilitado}>
                        <Text style={styles.valorDesabilitadoTexto}>AUTOMÁTICO</Text>
                    </View>
                </View>

                {/* Contador de etiquetas geradas */}
                {etiquetasGeradas.length > 0 && (
                    <Text style={styles.contadorTexto}>
                        {etiquetasGeradas.length} etiqueta(s) gerada(s)
                    </Text>
                )}
            </View>

            {/* Botão GERAR ETIQUETA */}
            <View style={styles.footer}>
                <BotaoIndustrial
                    titulo="GERAR ETIQUETA"
                    cor="branco"
                    onPress={handleGerarEtiqueta}
                />
            </View>

            {/* Modal para iOS com botão de Confirmar, Android usa o nativo popup */}
            {Platform.OS === 'ios' ? (
                <Modal visible={mostrarDatePicker} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContainer, { paddingBottom: 30 }]}>
                            <Text style={styles.modalTitulo}>Selecionar Validade</Text>
                            <DateTimePicker
                                value={dataValidade || new Date()}
                                mode="date"
                                display="spinner"
                                minimumDate={new Date()}
                                onChange={onChangeData}
                                themeVariant="light"
                                textColor="#111111"
                                style={{ width: '100%', height: 200 }}
                            />
                            <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
                                <BotaoIndustrial
                                    titulo="CONFIRMAR"
                                    cor="branco"
                                    onPress={() => setMostrarDatePicker(false)}
                                />
                            </View>
                        </View>
                    </View>
                </Modal>
            ) : (
                mostrarDatePicker && (
                    <DateTimePicker
                        value={dataValidade || new Date()}
                        mode="date"
                        display="default"
                        minimumDate={new Date()}
                        onChange={onChangeData}
                    />
                )
            )}

            {/* Modal de seleção de item */}
            <Modal visible={modalItemVisivel} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitulo}>Selecione o Item</Text>
                        <FlatList
                            data={itensDisponiveis}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setItemSelecionado(item);
                                        setModalItemVisivel(false);
                                    }}
                                >
                                    <Text style={styles.modalItemTexto}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.modalFechar}
                            onPress={() => setModalItemVisivel(false)}
                        >
                            <Text style={styles.modalFecharTexto}>CANCELAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal da Etiqueta Gerada */}
            <Modal visible={modalEtiquetaVisivel} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.etiquetaContainer}>
                        {ultimaEtiqueta && (
                            <>
                                {/* Cabeçalho da etiqueta */}
                                <View style={styles.etiquetaHeader}>
                                    <View style={styles.etiquetaColuna}>
                                        <Text style={styles.etiquetaLabel}>LOTE:</Text>
                                        <Text style={styles.etiquetaValor}>{ultimaEtiqueta.idLote}</Text>
                                    </View>
                                    <View style={styles.etiquetaDivisor} />
                                    <View style={styles.etiquetaColuna}>
                                        <Text style={styles.etiquetaLabel}>VAL:</Text>
                                        <Text style={styles.etiquetaValor}>{ultimaEtiqueta.validade}</Text>
                                    </View>
                                    <View style={styles.etiquetaDivisor} />
                                    <View style={styles.etiquetaColuna}>
                                        <Text style={styles.etiquetaLabel}>PESO/VOL:</Text>
                                        <Text style={styles.etiquetaValor}>{ultimaEtiqueta.pesoKg} KG</Text>
                                    </View>
                                </View>

                                {/* Seletor de Quantidade */}
                                <View style={styles.seletorQuantidade}>
                                    <Text style={styles.seletorTitulo}>QUANTIDADE DE VOLUMES</Text>
                                    <View style={styles.controlesRow}>
                                        <TouchableOpacity
                                            style={styles.botaoQtd}
                                            onPress={() => setQuantidade(Math.max(1, quantidade - 1))}
                                        >
                                            <Text style={styles.botaoQtdTexto}>-</Text>
                                        </TouchableOpacity>

                                        <View style={styles.caixaQtd}>
                                            <Text style={styles.caixaQtdTexto}>{quantidade}</Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.botaoQtd}
                                            onPress={() => setQuantidade(Math.min(999, quantidade + 1))}
                                        >
                                            <Text style={styles.botaoQtdTexto}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                            </>
                        )}

                        {/* Botões de ação Brancos como solicitado */}
                        <View style={styles.etiquetaBotoes}>
                            <BotaoIndustrial
                                titulo="IMPRIMIR"
                                cor="branco"
                                onPress={handleImprimir}
                            />
                            <BotaoIndustrial
                                titulo="CANCELAR"
                                cor="branco"
                                onPress={handleAbrirCancelamento}
                            />
                            <BotaoIndustrial
                                titulo="FINALIZAR LOTE"
                                cor="branco"
                                onPress={handleFinalizar}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal Checklist de Cancelamento */}
            <Modal visible={modalChecklistVisivel} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContainer, { paddingHorizontal: 0, paddingVertical: 20 }]}>
                        <Text style={styles.modalTitulo}>Cancelar Quais?</Text>

                        <FlatList
                            data={Array.from({ length: quantidade }, (_, i) => i)}
                            keyExtractor={(item) => item.toString()}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item: index }) => {
                                const subId = `${ultimaEtiqueta?.idLote}-${String(index + 1).padStart(2, '0')}`;
                                const selecionado = canceladosTemporarios.includes(index);

                                return (
                                    <TouchableOpacity
                                        style={styles.checklistRow}
                                        activeOpacity={0.7}
                                        onPress={() => alternarCancelamento(index)}
                                    >
                                        <View style={[styles.checkbox, selecionado && styles.checkboxAtiva]}>
                                            {selecionado && <Text style={styles.checkmark}>✓</Text>}
                                        </View>
                                        <Text style={[styles.checklistTexto, selecionado && styles.checklistTextoAtivo]}>
                                            {subId}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
                            <BotaoIndustrial
                                titulo="CONFIRMAR CANCELAMENTO"
                                cor="branco"
                                onPress={handleConfirmarCancelamento}
                            />
                            <TouchableOpacity
                                style={styles.modalFechar}
                                onPress={() => {
                                    setModalChecklistVisivel(false);
                                    setModalEtiquetaVisivel(true);
                                }}
                            >
                                <Text style={[styles.modalFecharTexto, { color: '#111111' }]}>FECHAR</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </Modal>
        </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.fundoEscuro,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    campo: {
        marginBottom: 20,
    },
    label: {
        backgroundColor: Colors.header,
        paddingVertical: 10,
        alignItems: 'center',
    },
    labelTexto: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    valor: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 14,
        alignItems: 'center',
    },
    valorTexto: {
        color: '#111111',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    valorDesabilitado: {
        backgroundColor: '#BDBDBD',
        paddingVertical: 14,
        alignItems: 'center',
    },
    valorInputBox: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 0,
    },
    inputPeso: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
        textAlign: 'center',
        paddingVertical: 14,
    },
    valorDesabilitadoTexto: {
        color: '#111111',
        fontSize: 18,
        fontWeight: 'bold',
    },
    contadorTexto: {
        color: '#FFFFFF',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 30,
    },
    // Modal genérico
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        paddingVertical: 16,
        maxHeight: '80%',
    },
    modalTitulo: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
        textAlign: 'center',
        marginBottom: 12,
    },
    modalItem: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    modalItemTexto: {
        fontSize: 16,
        color: '#111111',
        fontWeight: 'bold',
    },
    modalFechar: {
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    modalFecharTexto: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.status.urgente,
    },
    // Etiqueta
    etiquetaContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        padding: 20,
    },
    etiquetaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    etiquetaColuna: {
        flex: 1,
        alignItems: 'center',
    },
    etiquetaDivisor: {
        width: 1,
        height: 40,
        backgroundColor: '#111111',
    },
    etiquetaLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111111',
        marginBottom: 4,
    },
    etiquetaValor: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111111',
    },
    seletorQuantidade: {
        marginTop: 24,
        alignItems: 'center',
        marginBottom: 20,
    },
    seletorTitulo: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111111',
        marginBottom: 10,
    },
    controlesRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    botaoQtd: {
        width: 50,
        height: 50,
        backgroundColor: Colors.header,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
    },
    botaoQtdTexto: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    caixaQtd: {
        width: 70,
        height: 50,
        backgroundColor: '#EEEEEE',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        borderWidth: 1,
        borderColor: '#111111',
    },
    caixaQtdTexto: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111111',
    },
    etiquetaBotoes: {
        marginTop: 8,
    },
    // Estilos da Checklist de Cancelamento
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#111111',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderRadius: 4,
    },
    checkboxAtiva: {
        backgroundColor: '#111111',
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    checklistTexto: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#555555',
    },
    checklistTextoAtivo: {
        color: '#111111',
        textDecorationLine: 'line-through',
    },

    pesoInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    inputPesoWithUnit: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
        textAlign: 'center',
        paddingVertical: 14,
    },
    switchButtonContainer: {
        flexDirection: 'row',
        backgroundColor: '#EEEEEE',
        borderRadius: 4,
        overflow: 'hidden',
    },
    switchBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    switchBtnOn: {
        backgroundColor: Colors.header,
    },
    switchBtnOff: {
        backgroundColor: 'transparent',
    },
    switchBtnTxt: {
        fontWeight: 'bold',
    },
    switchBtnTxtOn: {
        color: '#FFFFFF',
    },
    switchBtnTxtOff: {
        color: '#768AA4',
    },
    botaoQtdPrincipal: {
        width: 50,
        height: 50,
        backgroundColor: Colors.status.normal,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 4,
    },
    botaoQtdPrincipalTexto: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
});
