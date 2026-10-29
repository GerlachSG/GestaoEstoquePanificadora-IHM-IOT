import React, { useState, useEffect } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    View,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';

import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import ActionCard from '../../components/ui/ActionCard';
import SeletorModal, { OpcaoSeletor } from '../../components/ui/SeletorModal';
import { Colors } from '../../constants/Colors';
import { listarCatalogo, salvarProduto, deletarProduto } from '../../services/api/catalogoService';
import { useAppStore } from '../../store/appStore';

interface ProdutoItem {
    id: string;
    nome: string;
    min: number;
    max: number;
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

    // Fetch catalogo via REST
    useEffect(() => {
        const carregarCatalogo = async () => {
            try {
                const data = await listarCatalogo();
                const prodList: ProdutoItem[] = data.map(p => ({
                    id: p.id,
                    nome: p.displayName,
                    min: p.min,
                    max: p.max,
                }));
                
                prodList.forEach(p => updateLimiteStore(p.nome, p.min, p.max));
                setCatalogo(prodList.sort((a, b) => a.nome.localeCompare(b.nome)));
            } catch (error) {
                console.log('Erro ao carregar catálogo:', error);
            }
        };
        carregarCatalogo();
    }, [updateLimiteStore]);

    const opcoesSeletor: OpcaoSeletor[] = [
        { valor: '__novo__', rotulo: '+ NOVO PRODUTO', descricao: 'Cadastrar um novo produto no catálogo' },
        ...catalogo.map(p => ({
            valor: p.id,
            rotulo: p.nome,
            descricao: `Mínimo: ${p.min} kg | Máximo: ${p.max} kg`
        }))
    ];

    const handleSelecionarProduto = (valor: string) => {
        setModalSelectorVisivel(false);
        
        if (valor === '__novo__') {
            setProdutoSelecionado(null);
            setNomeProduto('');
            setMinimo('');
            setMaximo('');
            setIsCriandoNovo(true);
        } else {
            const prod = catalogo.find(p => p.id === valor);
            if (prod) {
                setProdutoSelecionado(prod);
                setNomeProduto(prod.nome);
                setMinimo(prod.min.toString());
                setMaximo(prod.max.toString());
                setIsCriandoNovo(false);
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
                const novoId = nomeProduto.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
                await salvarProduto({ id: novoId, displayName: nomeProduto.trim(), min: minVal, max: maxVal });
                Alert.alert('Sucesso', 'Novo produto criado com sucesso!');
            } else {
                // Atualizar existente
                await salvarProduto({ id: produtoSelecionado.id, displayName: nomeProduto.trim(), min: minVal, max: maxVal });
                Alert.alert('Sucesso', 'Produto atualizado com sucesso!');
            }
            
            // Recarrega catálogo
            const data = await listarCatalogo();
            const prodList: ProdutoItem[] = data.map(p => ({ id: p.id, nome: p.displayName, min: p.min, max: p.max }));
            setCatalogo(prodList.sort((a, b) => a.nome.localeCompare(b.nome)));

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
                            await deletarProduto(produtoSelecionado.id);
                            
                            // Recarrega catálogo
                            const data = await listarCatalogo();
                            const prodList: ProdutoItem[] = data.map(p => ({ id: p.id, nome: p.displayName, min: p.min, max: p.max }));
                            setCatalogo(prodList.sort((a, b) => a.nome.localeCompare(b.nome)));
                            
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
                <ActionCard
                    titulo="SELECIONAR PRODUTO"
                    valor={
                        produtoSelecionado
                            ? produtoSelecionado.nome
                            : isCriandoNovo
                                ? 'NOVO PRODUTO'
                                : 'SELECIONAR'
                    }
                    onPress={() => setModalSelectorVisivel(true)}
                />

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
                    backgroundColor={Colors.surfaceLight}
                    textColor={Colors.text.dark}
                    onPress={handleSalvarOuAtualizar}
                />
                
                {produtoSelecionado !== null && (
                    <View style={{ marginTop: 12 }}>
                        <BotaoIndustrial
                            titulo="DELETAR PRODUTO"
                            backgroundColor={Colors.surfaceLight}
                            textColor={Colors.text.dark}
                            onPress={handleDeletar}
                        />
                    </View>
                )}
            </View>

            {/* Modal Selector de Produtos no Padrão Novo Lote */}
            <SeletorModal
                visivel={modalSelectorVisivel}
                titulo="SELECIONE O PRODUTO"
                opcoes={opcoesSeletor}
                valorSelecionado={produtoSelecionado ? produtoSelecionado.id : (isCriandoNovo ? '__novo__' : null)}
                onSelecionar={handleSelecionarProduto}
                onFechar={() => setModalSelectorVisivel(false)}
            />
        </View>
        </TouchableWithoutFeedback>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    labelTexto: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    valorInputBox: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 0,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: '#111111',
    },
    valorInputBoxDesabilitado: {
        backgroundColor: '#E5E7EB',
    },
    inputPeso: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111111',
        textAlign: 'center',
        paddingVertical: 14,
    },
    inputDesabilitado: {
        color: Colors.text.muted,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 30,
    },
});
