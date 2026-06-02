import React, { useState, useEffect } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';

import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/firebaseConfig';
import { useAppStore } from '../../store/appStore';

interface ProdutoItem {
    id: string;
    nome: string;
    min: number;
    max: number;
}

interface OptionItem {
    id: string;
    nome: string;
    isNovo: boolean;
}

export default function GerenciarProdutosScreen() {
    const [catalogo, setCatalogo] = useState<ProdutoItem[]>([]);
    const [modalSelectorVisivel, setModalSelectorVisivel] = useState(false);
    
    // Form states
    const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoItem | null>(null);
    const [nomeProduto, setNomeProduto] = useState('');
    const [minimo, setMinimo] = useState('');
    const [maximo, setMaximo] = useState('');
    const [isCriandoNovo, setIsCriandoNovo] = useState(false);
    
    const updateLimiteStore = useAppStore(state => state.updateLimite);

    // Fetch catalogo e limites
    useEffect(() => {
        const unsubCat = onSnapshot(collection(db, 'catalogo'), (snapCat) => {
            const unsubLim = onSnapshot(collection(db, 'limites'), (snapLim) => {
                const prodList: ProdutoItem[] = [];
                
                snapCat.docs.forEach(docCat => {
                    const nomeProd = docCat.data().nome;
                    const limiteData = snapLim.docs.find(l => l.id === docCat.id)?.data() || { min: 0, max: 0 };
                    
                    prodList.push({
                        id: docCat.id,
                        nome: nomeProd,
                        min: limiteData.min,
                        max: limiteData.max,
                    });
                    
                    updateLimiteStore(nomeProd, limiteData.min, limiteData.max);
                });
                
                setCatalogo(prodList.sort((a, b) => a.nome.localeCompare(b.nome)));
            }, (errorLim) => {
                console.log('Firebase onSnapshot (limites) erro:', errorLim);
            });
            
            return unsubLim;
        }, (errorCat) => {
            console.log('Firebase onSnapshot (catalogo) erro:', errorCat);
        });

        return () => unsubCat();
    }, [updateLimiteStore]);

    // Monta opções do modal: NOVO PRODUTO + catalogo existente
    const opcoes: OptionItem[] = [
        { id: 'novo', nome: 'NOVO PRODUTO', isNovo: true },
        ...catalogo.map(p => ({ id: p.id, nome: p.nome, isNovo: false }))
    ];

    const handleSelecionarProduto = (opcao: OptionItem) => {
        setModalSelectorVisivel(false);
        
        if (opcao.isNovo) {
            setProdutoSelecionado(null);
            setNomeProduto('');
            setMinimo('');
            setMaximo('');
            setIsCriandoNovo(true); // <-- Adicionado aqui
        } else {
            const prod = catalogo.find(p => p.id === opcao.id);
            if (prod) {
                setProdutoSelecionado(prod);
                setNomeProduto(prod.nome);
                setMinimo(prod.min.toString());
                setMaximo(prod.max.toString());
                setIsCriandoNovo(false); // <-- Adicionado aqui
            }
        }
    };

    const handleSalvarOuAtualizar = async () => {
        // Validações
        if (!nomeProduto.trim()) {
            return Alert.alert('Erro', 'O nome do produto não pode ser vazio.');
        }
        
        const minVal = parseInt(minimo, 10) || 0;
        const maxVal = parseInt(maximo, 10) || 0;
        
        if (minVal < 0 || maxVal < 0) {
            return Alert.alert('Erro', 'Mínimo e Máximo não podem ser negativos.');
        }
        
        if (minVal > maxVal) {
            return Alert.alert('Erro', 'Mínimo não pode ser maior que Máximo.');
        }

        try {
            if (produtoSelecionado === null) {
                // Novo produto
                const idProd = nomeProduto.trim().toLowerCase().replace(/\s+/g, '_');
                
                await setDoc(doc(db, 'catalogo', idProd), { nome: nomeProduto.trim() });
                await setDoc(doc(db, 'limites', idProd), { min: minVal, max: maxVal });
                
                Alert.alert('Sucesso', 'Novo produto criado com sucesso!');
            } else {
                // Atualizar existente
                await setDoc(doc(db, 'catalogo', produtoSelecionado.id), { nome: nomeProduto.trim() });
                await setDoc(doc(db, 'limites', produtoSelecionado.id), { min: minVal, max: maxVal });
                
                Alert.alert('Sucesso', 'Produto atualizado com sucesso!');
            }
            
            // Reset form
            setProdutoSelecionado(null);
            setNomeProduto('');
            setMinimo('');
            setMaximo('');
            setIsCriandoNovo(false);
            Keyboard.dismiss();
        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar no servidor.');
        }
    };

    const handleDeletar = async () => {
        if (!produtoSelecionado) {
            return Alert.alert('Erro', 'Nenhum produto selecionado para deletar.');
        }

        Alert.alert(
            'Confirmar Deleção',
            `Tem certeza que deseja deletar "${produtoSelecionado.nome}"?`,
            [
                { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
                {
                    text: 'Deletar',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'catalogo', produtoSelecionado.id));
                            await deleteDoc(doc(db, 'limites', produtoSelecionado.id));
                            
                            Alert.alert('Sucesso', 'Produto deletado com sucesso!');
                            
                            // Reset form
                            setProdutoSelecionado(null);
                            setNomeProduto('');
                            setMinimo('');
                            setMaximo('');
                        } catch (error) {
                            Alert.alert('Erro', 'Falha ao deletar no servidor.');
                        }
                    },
                    style: 'destructive'
                }
            ]
        );
    };

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Campo SELECIONAR PRODUTO */}
                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>SELECIONAR PRODUTO</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.valor}
                        onPress={() => setModalSelectorVisivel(true)}
                    >
                        <Text style={styles.valorTexto}>
                            {produtoSelecionado
                                ? produtoSelecionado.nome
                                : isCriandoNovo
                                    ? 'NOVO PRODUTO' 
                                    : 'SELECIONAR'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Campo NOME DO PRODUTO */}
                <View style={styles.campo}>
                    <View style={styles.label}>
                        <Text style={styles.labelTexto}>NOME DO PRODUTO</Text>
                    </View>
                    <View style={[
                        styles.valorInputBox,
                        produtoSelecionado !== null && styles.valorInputBoxDesabilitado
                    ]}>
                        <TextInput
                            style={[
                                styles.inputPeso,
                                produtoSelecionado !== null && styles.inputDesabilitado
                            ]}
                            placeholder="Ex: Farinha de Trigo"
                            placeholderTextColor="#768AA4"
                            value={nomeProduto}
                            onChangeText={setNomeProduto}
                            editable={produtoSelecionado === null}
                        />
                    </View>
                </View>

                {/* Campos MÍNIMO e MÁXIMO lado a lado */}
                <View style={styles.duoCampo}>
                    <View style={[styles.campo, styles.campoMetade]}>
                        <View style={styles.label}>
                            <Text style={styles.labelTexto}>MÍNIMO (KG)</Text>
                        </View>
                        <View style={styles.valorInputBox}>
                            <TextInput
                                style={styles.inputPeso}
                                placeholder="0"
                                placeholderTextColor="#768AA4"
                                keyboardType="numeric"
                                value={minimo}
                                onChangeText={val => setMinimo(val.replace(/[^0-9]/g, ''))}
                            />
                        </View>
                    </View>

                    <View style={[styles.campo, styles.campoMetade]}>
                        <View style={styles.label}>
                            <Text style={styles.labelTexto}>MÁXIMO (KG)</Text>
                        </View>
                        <View style={styles.valorInputBox}>
                            <TextInput
                                style={styles.inputPeso}
                                placeholder="100"
                                placeholderTextColor="#768AA4"
                                keyboardType="numeric"
                                value={maximo}
                                onChangeText={val => setMaximo(val.replace(/[^0-9]/g, ''))}
                            />
                        </View>
                    </View>
                </View>
            </View>

            {/* Botões de Ação */}
            <View style={styles.footer}>
                <BotaoIndustrial
                    titulo={produtoSelecionado ? 'ATUALIZAR PRODUTO' : 'SALVAR NOVO PRODUTO'}
                    cor="branco"
                    onPress={handleSalvarOuAtualizar}
                />
                
                {produtoSelecionado !== null && (
                    <View style={{ marginTop: 12 }}>
                        <BotaoIndustrial
                            titulo="DELETAR PRODUTO"
                            cor="branco"
                            onPress={handleDeletar}
                        />
                    </View>
                )}
            </View>

            {/* Modal Selector de Produtos */}
            <Modal visible={modalSelectorVisivel} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitulo}>Selecione o Produto</Text>
                        <FlatList
                            data={opcoes}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.modalItem,
                                        item.isNovo && styles.modalItemNovo
                                    ]}
                                    onPress={() => handleSelecionarProduto(item)}
                                >
                                    <Text style={[
                                        styles.modalItemTexto,
                                        item.isNovo && styles.modalItemNovoTexto
                                    ]}>
                                        {item.nome}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.modalFechar}
                            onPress={() => setModalSelectorVisivel(false)}
                        >
                            <Text style={styles.modalFecharTexto}>CANCELAR</Text>
                        </TouchableOpacity>
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
    duoCampo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    campoMetade: {
        flex: 1,
        marginBottom: 0,
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
    valorInputBox: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 0,
    },
    valorInputBoxDesabilitado: {
        backgroundColor: '#BDBDBD',
    },
    inputPeso: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
        textAlign: 'center',
        paddingVertical: 14,
    },
    inputDesabilitado: {
        color: '#555555',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 30,
    },
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
        maxHeight: '80%', // <-- Adicionado o limite para fazer o scroll funcionar
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
    // Estilo novo para transformar a opção em um "botão" destacado
    modalItemNovo: {
        backgroundColor: Colors.header, 
        marginHorizontal: 16,
        marginTop: 4,
        marginBottom: 12,
        borderRadius: 6,
        borderBottomWidth: 0, // Tira a linha de baixo
        alignItems: 'center', // Centraliza o texto
        elevation: 2, // Sombra leve no Android
        shadowColor: '#000', // Sombra leve no iOS
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
    },
    modalItemTexto: {
        fontSize: 16,
        color: '#111111',
        fontWeight: 'bold',
    },
    modalItemNovoTexto: {
        color: '#FFFFFF', // Texto branco para contrastar com o fundo
        fontSize: 16,
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
});
