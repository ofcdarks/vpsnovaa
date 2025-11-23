

import { getGlobalUtils } from '../shared/utils.js';

export default {
    id: 'character-detector',
    name: 'Detector de Personagens',
    icon: 'M18 18.75c0 .621-.504 1.125-1.125 1.125H5.625c-.621 0-1.125-.504-1.125-1.125V12.75a3.375 3.375 0 003.375-3.375H15.75a3.375 3.375 0 003.375 3.375v6Z',
    category: 'media',

    
    async handler() {
        const utils = getGlobalUtils();
        const {
            showSuccessToast,
            showProgressModal,
            hideProgressModal,
            addToLog,
            apiRequestWithFallback,
            checkApiAvailability
        } = utils;

        if (!checkApiAvailability()) {
            return;
        }

        const scriptText = document.getElementById('scene-text')?.value.trim();
        const model = document.getElementById('scene-prompts-model-select')?.value;
        const charactersTextarea = document.getElementById('scene-characters');

        if (!scriptText || !model || !charactersTextarea) {
            showSuccessToast("Por favor, cole um roteiro e selecione um modelo de IA.");
            return;
        }

        showProgressModal("Detectando personagens...", "A IA esta analisando o roteiro...");

        const prompt = `Voce e um diretor de elenco especializado em analisar roteiros e identificar personagens para geracao de imagens com IA.

**ROTEIRO PARA ANALISAR:**
${scriptText}

---

**INSTRUCOES:**
1. Identifique todos os personagens principais e secundarios mencionados no roteiro.
2. Para cada personagem, crie uma descricao concisa e pratica que inclua:
   - Nome do personagem (ou descricao se nao tiver nome)
   - Idade aparente
   - Aparencia fisica (cor de cabelo, olhos, tipo fisico, tracos distintivos)
   - Vestimentas principais
   - Caracteristicas visuais importantes para manter consistencia

3. **FORMATO DE SAIDA OBRIGATORIO:** Voce DEVE retornar um objeto JSON com a seguinte estrutura exata:
{
  "characters": [
    "Nome, idade, descricao fisica e caracteristicas visuais",
    "Outro personagem, idade, descricao fisica e caracteristicas visuais"
  ]
}

**EXEMPLO DE FORMATO:**
{
  "characters": [
    "Joao, um homem de 40 anos, cabelo grisalho, oculos, rosto marcado, vestindo terno escuro",
    "Maria, uma jovem de 25 anos, cabelo longo e ruivo, olhos verdes, vestindo vestido casual"
  ]
}

**REGRA CRITICA:**
- Retorne APENAS o JSON valido, sem texto adicional antes ou depois
- Cada string no array deve ser uma descricao completa e pratica do personagem
- Foque em caracteristicas visuais que ajudem a manter consistencia nas imagens geradas
- Se um personagem nao tem nome, use uma descricao clara (ex: "Policial veterano, 50 anos, cabelo grisalho curto, uniforme azul")
- Limite a descricao de cada personagem a uma linha, mas seja completo e detalhado
- Retorne no formato JSON exato especificado acima, com a propriedade "characters" contendo um array de strings

**AGORA ANALISE O ROTEIRO FORNECIDO E RETORNE O JSON COM OS PERSONAGENS IDENTIFICADOS:**
`;

        const schema = {
            type: "OBJECT",
            properties: {
                characters: {
                    type: "ARRAY",
                    items: {
                        type: "STRING"
                    }
                }
            },
            required: ["characters"]
        };

        try {
            const result = await apiRequestWithFallback('/api/generate-legacy', 'POST', { 
                prompt, 
                model, 
                schema,
                maxOutputTokens: 4096
            });
            
            console.log('Resposta da API para detecção de personagens:', result);
            
                        let characters = [];
            
            if (result && result.data) {
                                if (Array.isArray(result.data)) {
                    characters = result.data;
                }
                                else if (result.data.characters && Array.isArray(result.data.characters)) {
                    characters = result.data.characters;
                }
                                else if (typeof result.data === 'object') {
                                        for (const key in result.data) {
                        if (Array.isArray(result.data[key])) {
                            characters = result.data[key];
                            break;
                        }
                    }
                }
                                else if (typeof result.data === 'string') {
                    try {
                        const parsed = JSON.parse(result.data);
                        if (parsed.characters && Array.isArray(parsed.characters)) {
                            characters = parsed.characters;
                        } else if (Array.isArray(parsed)) {
                            characters = parsed;
                        }
                    } catch (e) {
                        console.warn('Não foi possível fazer parse da string:', e);
                    }
                }
            }
            
                        if (characters.length === 0 && result) {
                const fullResult = JSON.stringify(result);
                try {
                                        const jsonMatch = fullResult.match(/\{"characters":\s*\[[^\]]*\]\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.characters && Array.isArray(parsed.characters)) {
                            characters = parsed.characters;
                        }
                    }
                } catch (e) {
                    console.warn('Não foi possível extrair personagens do resultado completo:', e);
                }
            }
            
            if (characters.length > 0) {
                                characters = characters
                    .filter(char => char && typeof char === 'string' && char.trim().length > 0)
                    .map(char => char.trim());
                
                if (characters.length > 0) {
                    charactersTextarea.value = characters.join('\n');
                    hideProgressModal();
                    showSuccessToast(`Personagens detectados com sucesso! (${characters.length} personagem${characters.length !== 1 ? 's' : ''} encontrado${characters.length !== 1 ? 's' : ''})`);
                } else {
                    hideProgressModal();
                    addToLog("Os personagens detectados estavam vazios. Verifique o console para mais detalhes.", true);
                    showSuccessToast("Nenhum personagem válido foi detectado.");
                    console.error('Resposta completa da API:', result);
                }
            } else {
                hideProgressModal();
                addToLog("Nenhum personagem foi detectado na resposta da IA. Verifique o console para mais detalhes.", true);
                showSuccessToast("Nenhum personagem foi detectado. Verifique se o roteiro contém personagens identificáveis.");
                console.error('Resposta completa da API:', result);
                console.error('Estrutura de result.data:', result?.data);
            }
        } catch (error) {
            console.error('Erro ao detectar personagens:', error);
            console.error('Stack trace:', error.stack);
            addToLog(error.message || "Erro ao detectar personagens", true);
            hideProgressModal();
            showSuccessToast("Ocorreu um erro ao detectar personagens. Verifique o console para mais detalhes.");
        }
    },

    init() {
        console.log('✅ Módulo Character Detector inicializado');
    }
};
