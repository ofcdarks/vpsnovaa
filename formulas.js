const scriptFormulas = {
    "manual_structure": {
        label: "ESTRUTURA MANUAL (Personalizada)",
        category: "✨ PERSONALIZADO",
        prompt: "" // O prompt sera fornecido pelo usuario
    },
    // --- Categoria Padrao ---
    "universal_safe": {
        label: "UNIVERSAL SAFE (Padrao Seguro)",
        category: "🛡️ FORMULA PADRAO",
        prompt: `**FORMULA "UNIVERSAL SAFE":**
        **Missao:** Criar um roteiro solido que entrega valor real ao espectador.
        **Principios Eticos:** Honestidade, Transparencia, Valor Genuino, Respeito ao Espectador.
        **Estrutura de Valor:**
        1. **Introducao Clara (0-15s):** Apresente o topico de forma direta, explicando o que o espectador aprendera. Evite promessas exageradas.
        2. **Contexto Necessario (15-45s):** Forneca o background essencial para compreender o tema. Use fatos verificaveis.
        3. **Conteudo Principal (45s-70% do video):** Entregue informacoes uteis, praticas e verificaveis. Use exemplos reais e dados comprovados.
        4. **Aplicacao Pratica:** Mostre como o espectador pode aplicar o conhecimento de forma realistica.
        5. **Resumo e Proximos Passos:** Recapitule os pontos principais e sugira acoes concretas.
        6. **Engajamento Autentico:** Convide para comentarios genuinos e interacao baseada no conteudo apresentado.
        **REGRA ETICA:** Todo conteudo deve ser fatualmente preciso e util para o espectador.
        
        **REGRA CRITICA DE CONSISTENCIA (OBRIGATORIA):**
        Mantenha TODAS as informacoes consistentes durante todo o roteiro:
        - **NOMES:** Use EXATAMENTE O MESMO NOME para cada personagem em todas as partes
        - **PROFISSOES:** Mantenha EXATAMENTE A MESMA PROFISSAO para cada personagem
        - **PARENTESCO:** Mantenha EXATAMENTE O MESMO PARENTESCO/RELACAO entre personagens
        - **DETALHES:** Todas as caracteristicas, localizacoes e informacoes devem permanecer as mesmas
        NUNCA mude nomes, profissoes, parentesco ou outros detalhes ja estabelecidos.`
    },
    "debunking_master": {
        label: "DEBUNKING MASTER (Desmentindo Mitos)",
        category: "🧠 PSICOLOGIA & DESENVOLVIMENTO",
        prompt: `**FORMULA "DEBUNKING MASTER":**
        **Missao:** Desmascarar mitos e crencas populares com autoridade, ceticismo e evidencias solidas, usando um tom de investigador de elite.
        **Tom Narrativo:** AUTORITARIO, CETICO E MISTERIOSO. O narrador nao esta dando conselhos, mas sim revelando uma verdade oculta.
        **Estrutura de Revelacao:**
        1. **A GRANDE MENTIRA (Introducao):** Comece com uma afirmacao chocante e contraintuitiva que desafia uma crenca popular universal. Apresente o "mito" que sera destruido. (Ex: "Voce acredita que a forca de vontade e a chave para o sucesso. Hoje, vou DESTRUIR esse mito.")
        2. **A ORIGEM DO ENGANO (Contexto):** Investigue a origem do mito. Mostre como e por que essa crenca se popularizou, usando contexto historico, cientifico ou social. Trate o mito como um "caso" a ser investigado.
        3. **A DECODIFICACAO (Conteudo Principal):** Apresente as evidencias (estudos, fatos, dados) que desmentem o mito. Use um ritmo dinamico, com pausas nitidas antes de cada revelacao. Use palavras de impacto como "DECODE", "A VERDADE E", "O SISTEMA NAO QUER QUE VOCE SAIBA".
        4. **A VERDADE REVELADA (Aplicacao Pratica):** Apos destruir o mito, apresente a "verdade" ou o modelo correto. Ofereca uma nova perspectiva ou um metodo alternativo que funciona, baseado nas evidencias apresentadas.
        5. **O NOVO PARADIGMA (Conclusao):** Recapitule a mentira e a verdade. Desafie o espectador a questionar outras crencas. Conclua com uma frase de efeito poderosa que reforca a autoridade do narrador.
        **REGRA ETICA:** Todas as afirmacoes e evidencias devem ser baseadas em fontes verificaveis e ciencia estabelecida. O tom e autoritario, mas o conteudo e factual.`
    },

    // --- Categoria Canais Cristaos ---
    "prayer_channels": {
        label: "CANAIS DE ORACAO - comunhao",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "CANAL DE ORACAO":**
        **Missao:** Criar um ambiente de comunhao, fe e acolhimento genuino.
        **Principios Espirituais:** Humildade, Autenticidade, Amor, Servico.
        **Estrutura de Comunhao:**
        1. **Acolhimento Genuino (0-30s):** Receba os espectadores com sinceridade, sem artificialismo.
        2. **Fundamentacao Biblica (30s-1:15):** Use passagens biblicas autenticas e relevantes, explicando o contexto.
        3. **Reflexao Empatica (1:15-2:30):** Conecte a Palavra com lutas reais, sem trivializar o sofrimento.
        4. **Oracao Intercessora:** Conduza oracao sincera, evitando linguagem performatica ou promessas magicas.
        5. **Declaracao de Fe Baseada:** Use promessas biblicas com contextualizacao apropriada.
        6. **Bencao e Encorajamento:** Termine com palavras genuinamente edificantes.
        **REGRA ETICA:** Mantenha integridade teologica e evite manipulacao emocional.`
    },
    "faith_journey": {
        label: "FAITH JOURNEY - crescimento espiritual",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "FAITH JOURNEY":**
        **Missao:** Guiar crescimento espiritual genuino baseado em principios biblicos solidos.
        **Estrutura de Crescimento:**
        1. **Identificacao Pastoral:** Aborde lutas espirituais reais sem dramatizacao excessiva.
        2. **Fundamento Biblico Solido:** Use personagens e principios biblicos com exegese correta.
        3. **Aplicacao Contemporanea:** Conecte ensinamentos antigos com vida moderna de forma honesta.
        4. **Passos Praticos Realistas:** Ofereca orientacoes aplicaveis, nao formulas magicas.
        5. **Testemunho Equilibrado:** Compartilhe experiencias reais, incluindo lutas e falhas.
        6. **Encorajamento Biblico:** Termine com esperanca baseada em promessas escriturais validas.
        **REGRA ETICA:** Evite teologia da prosperidade ou promessas nao-biblicas.`
    },
    "testimony_power": {
        label: "TESTIMONY POWER - testemunhos genuinos",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "TESTIMONY POWER":**
        **Missao:** Compartilhar testemunhos verdadeiros que glorificam a Deus honestamente.
        **Estrutura de Testemunho:**
        1. **Situacao Real:** Apresente circunstancias veridicas sem exageros dramaticos.
        2. **Contexto Honesto:** Mostre a vida antes da transformacao com veracidade.
        3. **Luta Genuina:** Descreva desafios reais sem minimizar ou dramatizar.
        4. **Intervencao Divina:** Narre a acao de Deus de forma biblica e verificavel.
        5. **Transformacao Gradual:** Mostre mudanca realista, nao instantanea e perfeita.
        6. **Gloria a Deus:** Conclua direcionando louvor a Deus, nao a pessoa.
        **REGRA ETICA:** Verifique a veracidade de todos os testemunhos compartilhados.`
    },
    "bible_wisdom": {
        label: "BIBLE WISDOM - estudos biblicos responsaveis",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "BIBLE WISDOM":**
        **Missao:** Ensinar a Biblia com precisao exegetica e relevancia pratica.
        **Estrutura Exegetica:**
        1. **Pergunta Valida:** Faca questionamentos legitimos baseados no texto biblico.
        2. **Contexto Historico Preciso:** Use pesquisa academica confiavel sobre background.
        3. **Analise Textual Responsavel:** Explique o texto usando principios hermeneuticos corretos.
        4. **Conexoes Biblicas Legitimas:** Mostre relacoes genuinas com outras passagens.
        5. **Aplicacao Contextualizada:** Traga relevancia moderna sem forcar interpretacoes.
        6. **Convite ao Estudo:** Encoraje estudo biblico pessoal com recursos confiaveis.
        **REGRA ETICA:** Mantenha fidelidade ao texto biblico e admita limitacoes interpretativas.`
    },
    "gospel_share": {
        label: "GOSPEL SHARE - evangelizacao respeitosa",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "GOSPEL SHARE":**
        **Missao:** Apresentar o evangelho com clareza, amor e respeito.
        **Estrutura Evangelistica:**
        1. **Necessidade Universal:** Aborde necessidades humanas reais sem manipulacao.
        2. **Plano de Deus:** Explique o proposito divino de forma biblica e clara.
        3. **Realidade do Pecado:** Apresente a condicao humana com sensibilidade e verdade.
        4. **Solucao em Cristo:** Explique a salvacao baseada inteiramente nas Escrituras.
        5. **Convite Respeitoso:** Faca apelo claro mas sem pressao emocional excessiva.
        6. **Proximos Passos Praticos:** Oriente sobre crescimento na fe com recursos legitimos.
        **REGRA ETICA:** Respeite a liberdade de escolha e evite taticas de pressao.`
    },
    "praise_story": {
        label: "PRAISE STORY - historias que honram a Deus",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "PRAISE STORY":**
        **Missao:** Contar historias que revelam o carater de Deus genuinamente.
        **Estrutura de Louvor:**
        1. **Atributo Divino Real:** Apresente caracteristica biblica de Deus com base escritural.
        2. **Historia Verificavel:** Use narrativas biblicas ou contemporaneas comprovadas.
        3. **Desafio Genuino:** Mostre dificuldades reais sem minimizar o sofrimento.
        4. **Manifestacao de Deus:** Descreva acao divina de forma biblica, nao sensacionalista.
        5. **Reflexao Aplicavel:** Conecte a historia com vida do espectador honestamente.
        6. **Convite a Adoracao:** Encoraje louvor genuino baseado na verdade revelada.
        **REGRA ETICA:** Todas as historias devem ser verificaveis e teologicamente solidas.`
    },
    "parable_lessons": {
        label: "PARABLE LESSONS - licoes de parabolas",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "PARABLE LESSONS":**
        **Missao:** Extrair licoes praticas e atemporais das parabolas de Jesus.
        **Estrutura de Ensino:**
        1. **Contexto da Parabola:** Explique para quem e por que Jesus contou a historia.
        2. **Leitura Clara:** Narre a parabola de forma envolvente e fiel ao texto.
        3. **Analise dos Simbolos:** Desvende os significados dos elementos centrais da historia.
        4. **Principio Central:** Identifique a verdade espiritual principal que a parabola ensina.
        5. **Aplicacao Moderna:** Conecte o ensinamento com dilemas e situacoes atuais.
        6. **Desafio Pratico:** Encoraje uma acao especifica baseada na licao aprendida.
        **REGRA ETICA:** Mantenha a interpretacao alinhada ao contexto biblico e evite alegorias forcadas.`
    },
    "character_study": {
        label: "CHARACTER STUDY - estudo de personagens biblicos",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "CHARACTER STUDY":**
        **Missao:** Analisar a vida de personagens biblicos para extrair licoes de fe e carater.
        **Estrutura Biografica:**
        1. **Pessoa Alem do Mito:** Apresente aspectos humanos baseados em documentacao biografica.
        2. **Formacao e Contexto:** Use registros historicos sobre educacao, familia e sociedade da epoca.
        3. **Desafios Reais:** Mostre obstaculos enfrentados baseados em evidencias historicas.
        4. **Decisoes Cruciais:** Analise momentos decisivos usando fontes primarias quando possivel.
        5. **Legado Complexo:** Apresente impacto historico de forma equilibrada, incluindo aspectos controversos.
        6. **Licoes Humanas:** Extraia insights sobre lideranca, carater e condicao humana.
        **REGRA ETICA:** Evite hagiografia ou demonizacao; mantenha complexidade historica real.`
    },
    "theology_basics": {
        label: "THEOLOGY BASICS - teologia simplificada",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "THEOLOGY BASICS":**
        **Missao:** Explicar conceitos teologicos fundamentais de forma clara e acessivel.
        **Estrutura Didatica:**
        1. **Pergunta Comum:** Faca questionamentos legitimos baseados no texto biblico.
        2. **Definicao Clara:** Ofereca uma definicao simples e direta do conceito.
        3. **Base Biblica:** Mostre passagens das Escrituras que fundamentam a doutrina.
        4. **Analogia Util (com ressalvas):** Use uma analogia para ajudar a entender, explicando suas limitacoes.
        5. **Implicacao Pratica:** Explique por que esse conceito importa para a vida crista diaria.
        6. **Resumo e Encorajamento:** Recapitule a ideia central e incentive a confianca em Deus.
        **REGRA ETICA:** Trate temas complexos com humildade e fidelidade as Escrituras, evitando dogmatismo excessivo.`
    },
    "christian_life_qa": {
        label: "CHRISTIAN LIFE Q&A - perguntas e respostas",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "CHRISTIAN LIFE Q&A":**
        **Missao:** Responder a perguntas dificeis sobre a vida crista com sabedoria biblica e empatia.
        **Estrutura de Aconselhamento:**
        1. **Apresente a Pergunta:** Valide a questao como sendo importante e comum.
        2. **Abordagem Empatica:** Reconheca a dificuldade ou a dor por tras da pergunta.
        3. **Principios Biblicos:** Explore o que a Biblia diz sobre o assunto de forma geral.
        4. **Sabedoria Pratica:** Ofereca conselhos praticos e equilibrados baseados nesses principios.
        5. **Evite Respostas Faceis:** Admita a complexidade e nuances do tema, evitando cliches.
        6. **Direcione a Cristo:** Conclua apontando para a esperanca e suficiencia de Cristo.
        **REGRA ETICA:** Nunca ofereca garantias ou formulas magicas; sempre incentive a busca por conselho pastoral local.`
    },
    "worship_deep_dive": {
        label: "WORSHIP DEEP DIVE - analise de louvores",
        category: "✝️ CANAIS CRISTAOS",
        prompt: `**FORMULA "WORSHIP DEEP DIVE":**
        **Missao:** Explorar a profundidade teologica e a historia por tras de hinos e cancoes de adoracao.
        **Estrutura de Analise:**
        1. **Apresentacao da Cancao:** Introduza o hino/cancao e seu impacto conhecido.
        2. **Historia do Autor:** Conte a historia por tras da composicao (o que inspirou a letra).
        3. **Analise Teologica da Letra:** Examine as verdades biblicas contidas em cada estrofe.
        4. **Conexao Biblica:** Mostre as passagens das Escrituras que ecoam na cancao.
        5. **Impacto na Igreja:** Discuta como a cancao moldou a adoracao ou a fe ao longo do tempo.
        6. **Convite a Adoracao:** Incentive o espectador a cantar ou ouvir a musica com um novo entendimento.
        **REGRA ETICA:** Foque em cancoes teologicamente solidas e use fontes historicas verificaveis.`
    },

    // --- Categoria Historia Emocionante ---
    "epic_history": {
        label: "EPIC HISTORY - grandes momentos historicos",
        category: "📜 HISTORIA EMOCIONANTE",
        prompt: `**FORMULA "EPIC HISTORY":**
        **Missao:** Narrar eventos historicos com precisao factual e impacto emocional apropriado.
        **Estrutura Historica:**
        1. **Contexto Historico Verificado:** Use fontes primarias e pesquisa academica confiavel sobre o periodo.
        2. **Personagens Reais:** Retrate figuras historicas com complexidade humana, baseado em documentacao.
        3. **Tensao Dramatica Natural:** Use a tensao inerente aos eventos reais, sem exageros ficcionais.
        4. **Momento Decisivo:** Destaque o ponto de virada baseado em evidencias historicas.
        5. **Consequencias Documentadas:** Mostre o impacto real dos eventos na historia subsequente.
        6. **Licoes Historicas:** Extraia insights genuinos sobre natureza humana e sociedade.
        **REGRA ETICA:** Mantenha precisao historica e respeite a dignidade das pessoas retratadas.`
    },
    "untold_stories": {
        label: "UNTOLD STORIES - historias pouco conhecidas",
        category: "📜 HISTORIA EMOCIONANTE",
        prompt: `**FORMULA "UNTOLD STORIES":**
        **Missao:** Revelar historias historicas genuinamente pouco conhecidas com rigor academico.
        **Estrutura Investigativa:**
        1. **Descoberta Documentada:** Apresente eventos baseados em pesquisa historica verificavel.
        2. **Contexto Social:** Explique por que a historia foi esquecida ou negligenciada.
        3. **Evidencias Historicas:** Use documentos, cartas, registros oficiais como base narrativa.
        4. **Personagens Autenticos:** Retrate pessoas reais com base em fontes primarias.
        5. **Impacto Verdadeiro:** Mostre consequencias reais, mesmo que limitadas temporalmente.
        6. **Relevancia Contemporanea:** Conecte a historia com questoes atuais de forma fundamentada.
        **REGRA ETICA:** Verifique todas as informacoes historicas em multiplas fontes academicas.`
    },
    "historical_figures": {
        label: "HISTORICAL FIGURES - biografias envolventes",
        category: "📜 HISTORIA EMOCIONANTE",
        prompt: `**FORMULA "HISTORICAL FIGURES":**
        **Missao:** Criar biografias historicas que humanizam figuras sem mitifica-las.
        **Estrutura Biografica:**
        1. **Pessoa Alem do Mito:** Apresente aspectos humanos baseados em documentacao biografica.
        2. **Formacao e Contexto:** Use registros historicos sobre educacao, familia e sociedade da epoca.
        3. **Desafios Reais:** Mostre obstaculos enfrentados baseados em evidencias historicas.
        4. **Decisoes Cruciais:** Analise momentos decisivos usando fontes primarias quando possivel.
        5. **Legado Complexo:** Apresente impacto historico de forma equilibrada, incluindo aspectos controversos.
        6. **Licoes Humanas:** Extraia insights sobre lideranca, carater e condicao humana.
        **REGRA ETICA:** Evite hagiografia ou demonizacao; mantenha complexidade historica real.`
    },
    "battle_stories": {
        label: "BATTLE STORIES - conflitos historicos",
        category: "📜 HISTORIA EMOCIONANTE",
        prompt: `**FORMULA "BATTLE STORIES":**
        **Missao:** Narrar conflitos historicos focando em aspectos humanos, nao glorificando violencia.
        **Estrutura de Conflito:**
        1. **Causas Profundas:** Explique origens do conflito baseadas em analise historica seria.
        2. **Pessoas Reais:** Foque em experiencias humanas documentadas, nao apenas estrategia militar.
        3. **Momentos Decisivos:** Use registros historicos para narrar pontos de virada.
        4. **Custo Humano:** Seja honesto sobre sofrimento sem sensacionalismo ou glorificacao.
        5. **Consequencias Duradouras:** Mostre impacto real do conflito na sociedade e historia.
        6. **Reflexao sobre Guerra:** Conclua com insights sobre natureza e consequencias dos conflitos.
        **REGRA ETICA:** Nunca glorifique violencia; foque em licoes humanas e historicas.`
    },
    "revolution_tales": {
        label: "REVOLUTION TALES - movimentos transformadores",
        category: "📜 HISTORIA EMOCIONANTE",
        prompt: `**FORMULA "REVOLUTION TALES":**
        **Missao:** Explorar movimentos revolucionarios com analise equilibrada de causas e consequencias.
        **Estrutura Revolucionaria:**
        1. **Condicoes Pre-Revolucionarias:** Use dados historicos sobre problemas sociais e economicos.
        2. **Catalisadores Documentados:** Apresente eventos que desencadearam mudancas baseados em registros.
        3. **Lideres e Movimentos:** Retrate figuras revolucionarias com complexidade, incluindo falhas.
        4. **Processo de Mudanca:** Narre desenvolvimento da revolucao baseado em cronologia verificavel.
        5. **Resultados Reais:** Analise conquistas e fracassos de forma historicamente honesta.
        6. **Legado Complexo:** Avalie impacto a longo prazo com nuances apropriadas.
        **REGRA ETICA:** Mantenha analise equilibrada, evitando romantizacao ou demonizacao.`
    },
    "cultural_moments": {
        label: "CULTURAL MOMENTS - marcos culturais historicos",
        category: "📜 HISTORIA EMOCIONANTE",
        prompt: `**FORMULA "CULTURAL MOMENTS":**
        **Missao:** Explorar momentos que transformaram cultura e sociedade com rigor historico.
        **Estrutura Cultural:**
        1. **Contexto Cultural:** Descreva estado da arte, literatura ou musica antes do momento transformador.
        2. **Inovacao Documentada:** Use registros sobre criacoes ou movimentos que mudaram paradigmas.
        3. **Recepcao Contemporanea:** Mostre como sociedade reagiu baseado em fontes da epoca.
        4. **Resistencia e Aceitacao:** Analise conflitos culturais usando documentacao historica.
        5. **Transformacao Social:** Demonstre mudancas reais na sociedade com evidencias.
        6. **Influencia Duradoura:** Trace conexoes verificaveis com desenvolvimentos culturais posteriores.
        **REGRA ETICA:** Base analise cultural em pesquisa academica, nao impressoes pessoais.`
    },

    // --- Categoria Historias Romanticas ---
    "love_through_time": {
        label: "LOVE THROUGH TIME - romances historicos reais",
        category: "💕 HISTORIAS ROMANTICAS",
        prompt: `**FORMULA "LOVE THROUGH TIME":**
        **Missao:** Contar historias de amor reais da historia com sensibilidade e precisao.
        **Estrutura Romantica:**
        1. **Contexto Historico Real:** Use documentacao sobre periodo, sociedade e normas da epoca.
        2. **Pessoas Verdadeiras:** Base narrativa em cartas, diarios ou registros biograficos verificaveis.
        3. **Obstaculos Autenticos:** Mostre desafios reais enfrentados pelo casal, baseados em fontes.
        4. **Desenvolvimento Natural:** Narre evolucao do relacionamento usando evidencias disponiveis.
        5. **Resolucao Historica:** Conte desfecho real, seja feliz ou tragico, com honestidade.
        6. **Legado do Amor:** Explore como historia influenciou arte, literatura ou sociedade.
        **REGRA ETICA:** Respeite privacidade e dignidade das pessoas, mesmo figuras historicas.`
    },
    "modern_romance": {
        label: "MODERN ROMANCE - historias contemporaneas de amor",
        category: "💕 HISTORIAS ROMANTICAS",
        prompt: `**FORMULA "MODERN ROMANCE":**
        **Missao:** Compartilhar historias romanticas contemporaneas que inspirem de forma saudavel.
        **Estrutura Contemporanea:**
        1. **Encontro Real:** Use historia verificavel ou baseada em relatos genuinos.
        2. **Conexao Autentica:** Foque em elementos de compatibilidade e crescimento mutuo.
        3. **Desafios Realistas:** Apresente obstaculos comuns em relacionamentos modernos.
        4. **Comunicacao Saudavel:** Destaque importancia de dialogo e resolucao de conflitos.
        5. **Crescimento Individual:** Mostre como parceiros se desenvolvem individualmente.
        6. **Relacionamento Sustentavel:** Termine com insights sobre amor maduro e duradouro.
        **REGRA ETICA:** Promova relacionamentos saudaveis, nunca dependencia ou toxicidade.`
    },
    "unlikely_couples": {
        label: "UNLIKELY COUPLES - amores improveis",
        category: "💕 HISTORIAS ROMANTICAS",
        prompt: `**FORMULA "UNLIKELY COUPLES":**
        **Missao:** Explorar relacionamentos que superaram diferencas significativas de forma respeitosa.
        **Estrutura de Superacao:**
        1. **Diferencas Genuinas:** Apresente barreiras reais (culturais, sociais, etc.) sem estereotipos.
        2. **Encontro Significativo:** Base historia em eventos ou circunstancias verificaveis.
        3. **Descoberta Mutua:** Mostre como parceiros aprenderam a apreciar diferencas.
        4. **Obstaculos Externos:** Aborde preconceitos sociais com sensibilidade historica.
        5. **Amor Transcendente:** Foque em valores humanos universais que uniram o casal.
        6. **Impacto Positivo:** Destaque como relacionamento influenciou outros positivamente.
        **REGRA ETICA:** Evite fetichizacao de diferencas; foque na humanidade compartilhada.`
    },
    "second_chances": {
        label: "SECOND CHANCES - amor que retorna",
        category: "💕 HISTORIAS ROMANTICAS",
        prompt: `**FORMULA "SECOND CHANCES":**
        **Missao:** Contar historias de amor que encontrou nova oportunidade de forma realistica.
        **Estrutura de Reencontro:**
        1. **Relacionamento Original:** Use base factual sobre primeiro encontro ou relacionamento.
        2. **Separacao Natural:** Explique razoes realistas para afastamento inicial.
        3. **Crescimento Individual:** Mostre desenvolvimento pessoal durante periodo separado.
        4. **Reencontro Significativo:** Base reuniao em circunstancias plausiveis e documentadas.
        5. **Nova Maturidade:** Destaque como experiencia e crescimento melhoraram a conexao.
        6. **Amor Maduro:** Conclua com insights sobre relacionamentos que evoluem com tempo.
        **REGRA ETICA:** Promova crescimento pessoal, nao dependencia romantica ou obsessao.`
    },
    "sacrificial_love": {
        label: "SACRIFICIAL LOVE - amor que transforma",
        category: "💕 HISTORIAS ROMANTICAS",
        prompt: `**FORMULA "SACRIFICIAL LOVE":**
        **Missao:** Explorar historias onde amor inspirou transformacao personal ou sacrificio genuino.
        **Estrutura Transformadora:**
        1. **Situacao Inicial Real:** Base historia em eventos documentados ou relatos verificaveis.
        2. **Amor Verdadeiro:** Mostre conexao baseada em valores compartilhados e crescimento mutuo.
        3. **Momento de Escolha:** Apresente dilema real que exigiu sacrificio ou transformacao.
        4. **Decisao Consciente:** Foque em escolha livre e informada, nao coercao emocional.
        5. **Consequencias Reais:** Mostre resultados genuinos da decisao tomada.
        6. **Legado do Amor:** Explore como sacrificio ou transformacao beneficiou outros.
        **REGRA ETICA:** Nunca romantize sacrificios prejudiciais ou relacionamentos toxicos.`
    },
    "love_lessons": {
        label: "LOVE LESSONS - licoes do coracao",
        category: "💕 HISTORIAS ROMANTICAS",
        prompt: `**FORMULA "LOVE LESSONS":**
        **Missao:** Ensinar sobre relacionamentos saudaveis atraves de historias inspiradoras.
        **Estrutura Educativa:**
        1. **Situacao Relacionada:** Use exemplos reais ou baseados em padroes comportamentais conhecidos.
        2. **Desafio Comum:** Identifique problema frequente em relacionamentos modernos.
        3. **Abordagem Saudavel:** Demonstre comunicacao e resolucao construtivas.
        4. **Crescimento Mutuo:** Mostre como parceiros se apoiaram no desenvolvimento personal.
        5. **Resultado Positivo:** Apresente consequencias beneficas de abordagem madura.
        6. **Aplicacao Pratica:** Forneca insights aplicaveis a relacionamentos em geral.
        **REGRA ETICA:** Baseie conselhos em psicologia de relacionamentos estabelecida.`
    },

    // --- Categoria Canais Cristaos Devocionais ---
    "morning_devotion": {
        label: "MORNING DEVOTION - devocionais matinais",
        category: "✝️ CANAIS CRISTAOS DEVOCIONAIS",
        prompt: `**FORMULA "MORNING DEVOTION":**
        **Missao:** Oferecer orientacao espiritual genuina para iniciar o dia.
        **Estrutura Devocional:**
        1. **Saudacao Autentica (0-30s):** Cumprimente com sinceridade, evitando artificialismo.
        2. **Leitura Contextualizada (30s-1:30):** Use passagens biblicas com interpretacao responsavel.
        3. **Reflexao Pratica (1:30-3:00):** Conecte a Palavra com vida real de forma honesta.
        4. **Declaracao Biblica (3:00-4:00):** Use promessas escriturais no contexto correto.
        5. **Oracao Sincera (4:00-5:30):** Conduza oracao autentica, nao performatica.
        6. **Encorajamento Realista (5:30-6:00):** Termine com esperanca biblica genuina.
        **REGRA ETICA:** Mantenha autenticidade espiritual e evite superficialidade.`
    },
    "evening_reflection": {
        label: "EVENING REFLECTION - reflexoes noturnas",
        category: "✝️ CANAIS CRISTAOS DEVOCIONAIS",
        prompt: `**FORMULA "EVENING REFLECTION":**
        **Missao:** Proporcionar reflexao espiritual saudavel para o fim do dia.
        **Estrutura Reflexiva:**
        1. **Pausa Contemplativa (0-45s):** Convide a reflexao sem forcar espiritualidade.
        2. **Exame Gentil (45s-2:00):** Guide autoavaliacao honesta mas amorosa.
        3. **Palavra Consoladora (2:00-3:30):** Use passagens biblicas apropriadas ao contexto.
        4. **Oracao de Entrega (3:30-5:00):** Conduza oracao realista sobre preocupacoes reais.
        5. **Gratidao Genuina (5:00-6:00):** Encoraje gratidao sincera, nao forcada.
        6. **Paz Biblica (6:00-7:00):** Termine com promessas biblicas de descanso.
        **REGRA ETICA:** Evite culpa excessiva ou garantias nao-biblicas de paz.`
    },

    // --- Categoria Historias Emocionantes ---
    "heart_break": {
        label: "HEART BREAK - narrativas emocionais responsaveis",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "HEART BREAK":**
        **Missao:** Contar historias emocionais que respeitam o sofrimento humano.
        **Estrutura Respeitosa:**
        1. **Contexto Humanizador:** Apresente pessoas reais com dignidade e complexidade.
        2. **Situacao Veridica:** Narre eventos baseados em fatos, nao dramatizacoes exageradas.
        3. **Sofrimento Genuino:** Retrate dor humana com sensibilidade e respeito.
        4. **Processo Realista:** Mostre a jornada atraves da dor de forma honesta.
        5. **Esperanca Autentica:** Apresente caminhos reais de cura ou crescimento.
        6. **Legado Significativo:** Conclua com reflexoes genuinas sobre a experiencia humana.
        **REGRA ETICA:** Nunca explore trauma para entretenimento ou sensacionalismo.`
    },
    "emotional_wave": {
        label: "EMOTIONAL WAVE - drama com integridade",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "EMOTIONAL WAVE":**
        **Missao:** Construir narrativas emocionais sem manipulacao excessiva.
        **Estrutura Integra:**
        1. **Situacao Real:** Apresente circunstancias verdadeiras ou baseadas em fatos.
        2. **Desenvolvimento Gradual:** Construa tensao de forma organica, nao artificial.
        3. **Complexidade Humana:** Mostre personagens com nuances reais.
        4. **Conflito Genuino:** Apresente tensoes baseadas em dilemas reais.
        5. **Resolucao Honesta:** Ofereca desfechos realisticos, nao Hollywood.
        6. **Reflexao Valiosa:** Conclua com insights genuinos sobre a condicao humana.
        **REGRA ETICA:** Mantenha veracidade emocional e evite manipulacao barata.`
    },
    "life_change": {
        label: "LIFE CHANGE - transformacoes autenticas",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "LIFE CHANGE":**
        **Missao:** Narrar transformacoes reais sem exageros ou falsas promessas.
        **Estrutura Autentica:**
        1. **Transformacao Real:** Mostre mudancas genuinas e verificaveis.
        2. **Situacao Inicial Honesta:** Descreva circunstancias sem dramatizacao excessiva.
        3. **Catalisador Verdadeiro:** Apresente eventos ou decisoes reais que geraram mudanca.
        4. **Processo Realista:** Mostre o trabalho arduo e tempo necessario para mudanca.
        5. **Resultado Sustentavel:** Apresente transformacoes duradouras, nao temporarias.
        6. **Licao Aplicavel:** Extraia insights genuinos aplicaveis a outros contextos.
        **REGRA ETICA:** Baseie todas as transformacoes em casos reais e verificaveis.`
    },
     "overcoming_adversity": {
        label: "OVERCOMING ADVERSITY - superacao de desafios",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "OVERCOMING ADVERSITY":**
        **Missao:** Inspirar atraves de historias reais de superacao de adversidades extremas.
        **Estrutura de Resiliencia:**
        1. **O Desafio Monumental:** Apresente a adversidade (doenca, acidente, etc.) de forma factual e respeitosa.
        2. **O Ponto Mais Baixo:** Descreva o momento de maior dificuldade sem sensacionalismo.
        3. **A Centelha da Esperanca:** Mostre o que motivou a pessoa a lutar e nao desistir.
        4. **A Jornada da Recuperacao:** Detalhe os passos praticos, o trabalho arduo e o apoio recebido.
        5. **A Transformacao:** Revele como a experiencia mudou a pessoa e sua perspectiva de vida.
        6. **A Licao de Esperanca:** Conclua com uma mensagem universal sobre a forca humana e a resiliencia.
        **REGRA ETICA:** Obtenha consentimento para contar a historia e foque na inspiracao, nao na exploracao do sofrimento.`
    },
    "acts_of_kindness": {
        label: "ACTS OF KINDNESS - atos de bondade",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "ACTS OF KINDNESS":**
        **Missao:** Contar historias veridicas de bondade que restauram a fe na humanidade.
        **Estrutura de Conexao:**
        1. **Uma Situacao Comum:** Apresente uma pessoa em uma situacao cotidiana de necessidade ou dificuldade.
        2. **O Gesto Inesperado:** Narre o ato de bondade de um estranho ou conhecido.
        3. **A Reacao Emocional:** Descreva o impacto imediato do gesto em quem o recebeu.
        4. **O Efeito Cascata:** Mostre como aquele pequeno ato inspirou outras acoes positivas.
        5. **A Humanidade Compartilhada:** Reflita sobre por que esses momentos nos conectam.
        6. **O Convite a Acao:** Incentive o espectador a praticar pequenos atos de bondade.
        **REGRA ETICA:** Verifique a veracidade das historias e foque no positivismo, sem criar narrativas ficcionais.`
    },
    "reunion_stories": {
        label: "REUNION STORIES - reencontros emocionantes",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "REUNION STORIES":**
        **Missao:** Narrar historias emocionantes e veridicas de reencontros apos longa separacao.
        **Estrutura de Reencontro:**
        1. **A Historia da Separacao:** Explique as circunstancias que levaram a separacao (adocao, guerra, etc.).
        2. **Os Anos de Busca:** Detalhe os esforcos e as esperancas mantidas durante o tempo separados.
        3. **A Descoberta:** Conte o momento em que uma pista ou pessoa tornou o reencontro possivel.
        4. **O Momento do Reencontro:** Descreva a cena do reencontro de forma autentica e respeitosa.
        5. **A Vida Depois:** Mostre como o reencontro impactou a vida dos envolvidos.
        6. **Uma Mensagem de Esperanca:** Conclua sobre a forca dos lacos humanos e do amor.
        **REGRA ETICA:** Trate as historias com maxima sensibilidade e privacidade, sempre com permissao dos envolvidos.`
    },
    "animal_heroes": {
        label: "ANIMAL HEROES - animais herois",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "ANIMAL HEROES":**
        **Missao:** Contar historias reais e verificadas de animais que salvaram vidas ou realizaram feitos incriveis.
        **Estrutura de Lealdade:**
        1. **O Vinculo Especial:** Apresente o animal e sua relacao com seu tutor ou familia.
        2. **A Situacao de Perigo:** Descreva o evento perigoso (incendio, acidente, problema de saude).
        3. **O Ato Heroico:** Narre exatamente o que o animal fez para alertar ou salvar a pessoa.
        4. **O Resgate:** Conte como a acao do animal levou ao resgate e a um final seguro.
        5. **O Reconhecimento:** Fale sobre a gratidao e como o animal foi reconhecido como heroi.
        6. **A Licao sobre Lealdade:** Reflita sobre a inteligencia e a lealdade dos animais.
        **REGRA ETICA:** Use apenas historias documentadas (noticias, registros oficiais) e evite antropomorfizar excessivamente os animais.`
    },
    "farewell_legacy": {
        label: "FAREWELL LEGACY - o legado de uma despedida",
        category: "💔 HISTORIAS EMOCIONANTES",
        prompt: `**FORMULA "FAREWELL LEGACY":**
        **Missao:** Contar historias inspiradoras sobre o legado positivo deixado por pessoas que partiram.
        **Estrutura de Legado:**
        1. **Quem Foi a Pessoa:** Apresente a pessoa atraves das memorias de quem a amava, focando em suas qualidades.
        2. **A Despedida:** Aborde a perda de forma sensivel, focando mais na vida do que na morte.
        3. **O Legado Inesperado:** Revele um projeto, carta ou acao que a pessoa deixou para tras.
        4. **O Impacto Continuo:** Mostre como esse legado continuou a impactar e ajudar outros.
        5. **Mantendo a Memoria Viva:** Destaque como a comunidade ou familia honra sua memoria.
        6. **Uma Licao sobre a Vida:** Conclua com uma reflexao sobre como viver uma vida com proposito e impacto.
        **REGRA ETICA:** Conte a historia de forma a honrar a memoria da pessoa, com total respeito e consentimento da familia.`
    },

    // --- Categoria Terror & Suspense ---
    "fear_factor": {
        label: "FEAR FACTOR - terror responsavel",
        category: "👻 TERROR & SUSPENSE",
        prompt: `**FORMULA "FEAR FACTOR":**
        **Missao:** Criar suspense sem explorar traumas ou medos patologicos.
        **Estrutura Responsavel:**
        1. **Tensao Controlada:** Construa atmosfera sem exageros que possam causar trauma.
        2. **Misterio Genuino:** Base o suspense em elementos reais ou plausiveis.
        3. **Desenvolvimento Gradual:** Evite sustos excessivos ou choques desnecessarios.
        4. **Resolucao Clara:** Sempre forneca explicacoes ou closure apropriados.
        5. **Contexto Educativo:** Quando possivel, inclua elementos informativos.
        6. **Advertencias Apropriadas:** Inclua avisos sobre conteudo sensivel.
        **REGRA ETICA:** Considere o impacto psicologico no publico e evite trauma desnecessario.`
    },
    "nightmare_mode": {
        label: "NIGHTMARE MODE - horror etico",
        category: "👻 TERROR & SUSPENSE",
        prompt: `**FORMULA "NIGHTMARE MODE":**
        **Missao:** Contar historias de terror baseadas em elementos reais ou folcloricos.
        **Estrutura Etica:**
        1. **Base Cultural Real:** Use lendas ou fenomenos com background historico verdadeiro.
        2. **Personagens Respeitados:** Trate pessoas como seres humanos complexos, nao vitimas descartaveis.
        3. **Tensao Psicologica:** Foque em suspense mental ao inves de violencia grafica.
        4. **Consequencias Realisticas:** Mostre impactos reais de situacoes perigosas.
        5. **Elementos Educativos:** Inclua informacoes sobre cultura, historia ou psicologia.
        6. **Fechamento Apropriado:** Ofereca resolucao que nao deixe trauma desnecessario.
        **REGRA ETICA:** Evite glorificar violencia ou explorar traumas reais.`
    },
    "creepy_truth": {
        label: "CREEPY TRUTH - misterios baseados em fatos",
        category: "👻 TERROR & SUSPENSE",
        prompt: `**FORMULA "CREEPY TRUTH":**
        **Missao:** Explorar misterios reais com rigor investigativo e respeito.
        **Estrutura Investigativa:**
        1. **Pergunta Legitima:** Apresente misterios baseados em eventos documentados.
        2. **Fatos Verificados:** Use apenas informacoes comprovadas por fontes confiaveis.
        3. **Analise Critica:** Examine evidencias com ceticismo cientifico saudavel.
        4. **Multiplas Teorias:** Apresente diferentes explicacoes possiveis.
        5. **Limitacoes do Conhecimento:** Seja honesto sobre o que nao se sabe.
        6. **Conclusao Equilibrada:** Ofereca sintese responsavel sem sensacionalismo.
        **REGRA ETICA:** Mantenha integridade jornalistica e respeite pessoas envolvidas.`
    },
    "haunted_real": {
        label: "HAUNTED REAL - paranormal responsavel",
        category: "👻 TERROR & SUSPENSE",
        prompt: `**FORMULA "HAUNTED REAL":**
        **Missao:** Abordar fenomenos paranormais com ceticismo cientifico e respeito cultural.
        **Estrutura Equilibrada:**
        1. **Contexto Historico Real:** Use locais e eventos com documentacao verificavel.
        2. **Relatos Documentados:** Apresente testemunhos respeitando as pessoas envolvidas.
        3. **Analise Critica:** Ofereca explicacoes cientificas alternativas quando possivel.
        4. **Respeito Cultural:** Trate crencas e tradicoes com dignidade.
        5. **Evidencias Disponiveis:** Examine provas de forma objetiva e honesta.
        6. **Conclusao Aberta:** Permita que o espectador forme suas proprias opinioes.
        **REGRA ETICA:** Evite ridicularizar crencas ou explorar medos de forma irresponsavel.`
    },

    // --- Categoria Civilizacoes Antigas ---
    "ancient_wisdom": {
        label: "ANCIENT WISDOM - historia baseada em evidencias",
        category: "🏛️ CIVILIZACOES ANTIGAS",
        prompt: `**FORMULA "ANCIENT WISDOM":**
        **Missao:** Explorar civilizacoes antigas com precisao historica e arqueologica.
        **Estrutura Academica:**
        1. **Evidencia Arqueologica:** Base discussoes em descobertas cientificas verificadas.
        2. **Contexto Historico:** Use pesquisa academica confiavel sobre periodos e culturas.
        3. **Analise Factual:** Explique tecnologias e conhecimentos com precisao.
        4. **Teorias Fundamentadas:** Apresente interpretacoes baseadas em evidencias.
        5. **Limitacoes do Conhecimento:** Seja honesto sobre lacunas na compreensao historica.
        6. **Relevancia Contemporanea:** Conecte licoes historicas com insights modernos validos.
        **REGRA ETICA:** Use apenas fontes academicas respeitaveis e evite especulacoes sensacionalistas.`
    },
    "mystery_past": {
        label: "MYSTERY PAST - investigacao historica responsavel",
        category: "🏛️ CIVILIZACOES ANTIGAS",
        prompt: `**FORMULA "MYSTERY PAST":**
        **Missao:** Investigar enigmas historicos com metodologia cientifica.
        **Estrutura Investigativa:**
        1. **Problema Historico Real:** Apresente questoes baseadas em lacunas documentadas.
        2. **Consenso Academico:** Explique o que historiadores concordam atualmente.
        3. **Evidencias Disponiveis:** Examine provas arqueologicas e documentais.
        4. **Teorias Alternativas Validas:** Apresente interpretacoes academicas divergentes.
        5. **Analise Critica:** Avalie pros e contras de cada teoria.
        6. **Estado Atual do Conhecimento:** Conclua com sintese honesta sobre o que sabemos.
        **REGRA ETICA:** Distinga claramente entre fatos estabelecidos e especulacoes.`
    },

    // --- Categoria Curiosidades ---
    "mind_blown_facts": {
        label: "MIND BLOWN - fatos surpreendentes",
        category: "🧠 CURIOSIDADES",
        prompt: `**FORMULA "MIND BLOWN FACTS":**
        **Missao:** Apresentar fatos surpreendentes e pouco conhecidos com verificacao rigorosa.
        **Estrutura de Revelacao:**
        1. **A Crenca Comum:** Comece com um conhecimento popular ou uma suposicao comum.
        2. **A Pergunta Intrigante:** Levante uma questao que desafia essa crenca.
        3. **A Revelacao Chocante:** Apresente o fato surpreendente de forma direta.
        4. **A Evidencia Cientifica/Historica:** Forneca a prova, citando fontes confiaveis (estudos, registros).
        5. **A Explicacao Detalhada:** Explique por que o fato e verdadeiro e o mecanismo por tras dele.
        6. **A Implicacao Surpreendente:** Conclua mostrando como esse fato muda nossa percepcao de algo.
        **REGRA ETICA:** Verifique cada fato em multiplas fontes confiaveis e primarias antes de apresentar.`
    },
    "how_it_works": {
        label: "HOW IT WORKS - como as coisas funcionam",
        category: "🧠 CURIOSIDADES",
        prompt: `**FORMULA "HOW IT WORKS":**
        **Missao:** Explicar o funcionamento de objetos ou processos complexos de forma simples e visual.
        **Estrutura de Desmistificacao:**
        1. **O Objeto do Dia a Dia:** Apresente um item comum (ex: micro-ondas) e sua funcao basica.
        2. **A "Magica" Aparente:** Descreva o que parece magico ou inexplicavel em seu funcionamento.
        3. **O Principio Cientifico Chave:** Introduza o conceito cientifico fundamental por tras da tecnologia.
        4. **O Processo Passo a Passo:** Detalhe as etapas do funcionamento de forma logica e sequencial.
        5. **Os Componentes Essenciais:** Mostre as partes principais e suas funcoes especificas.
        6. **Aplicacoes Inusitadas:** Termine mostrando outros usos ou curiosidades sobre aquela tecnologia.
        **REGRA ETICA:** Mantenha a precisao cientifica e simplifique sem distorcer os fatos.`
    },
    "daily_mysteries": {
        label: "DAILY MYSTERIES - misterios do cotidiano",
        category: "🧠 CURIOSIDADES",
        prompt: `**FORMULA "DAILY MYSTERIES":**
        **Missao:** Responder a perguntas curiosas sobre fenomenos cotidianos que ninguem para pra pensar.
        **Estrutura de Investigacao:**
        1. **A Pergunta Universal:** Comece com uma pergunta que todos ja se fizeram (ex: Por que bocejamos?).
        2. **As Teorias Populares:** Apresente as explicacoes mais comuns ou mitos sobre o fenomeno.
        3. **Descartando os Mitos:** Mostre por que as teorias populares estao incorretas, usando evidencias.
        4. **A Explicacao Cientifica Atual:** Apresente a teoria mais aceita pela ciencia hoje.
        5. **O Mecanismo Biologico/Fisico:** Explique o processo por tras da resposta de forma clara.
        6. **O Conhecimento Aplicado:** Conclua mostrando como entender isso nos ajuda em algo pratico.
        **REGRA ETICA:** Seja claro sobre o que e teoria e o que e fato comprovado, admitindo incertezas cientificas.`
    },
    "science_explained": {
        label: "SCIENCE EXPLAINED - ciencia simplificada",
        category: "🧠 CURIOSIDADES",
        prompt: `**FORMULA "SCIENCE EXPLAINED":**
        **Missao:** Tornar conceitos cientificos complexos acessiveis e interessantes para o grande publico.
        **Estrutura Didatica:**
        1. **O Conceito Assustador:** Apresente um termo cientifico que parece intimidador (ex: fisica quantica).
        2. **A Analogia Perfeita:** Use uma analogia poderosa e facil de entender para explicar a ideia central.
        3. **O Principio Fundamental:** Descreva a regra ou lei mais importante do conceito.
        4. **Um Exemplo Pratico:** Mostre onde esse conceito se aplica no mundo real ou na tecnologia que usamos.
        5. **O Experimento Mental:** Guie o espectador por um experimento mental que ilustra o conceito.
        6. **Por que Isso Importa:** Conclua explicando como esse conhecimento expande nossa visao do universo.
        **REGRA ETICA:** Use analogias que sejam fieis ao conceito cientifico, sem simplificar a ponto de se tornar incorreto.`
    },
    "historical_oddities": {
        label: "HISTORICAL ODDITIES - bizarrices historicas",
        category: "🧠 CURIOSIDADES",
        prompt: `**FORMULA "HISTORICAL ODDITIES":**
        **Missao:** Revelar praticas, eventos ou leis bizarras de diferentes epocas da historia.
        **Estrutura de Arquivo:**
        1. **A Epoca e o Lugar:** Situe o espectador claramente em um periodo e civilizacao especificos.
        2. **A Pratica Bizarra:** Descreva o costume, lei ou evento estranho de forma direta.
        3. **O Contexto Cultural:** Explique POR QUE essa pratica fazia sentido para as pessoas daquela epoca.
        4. **A Evidencia Historica:** Apresente a prova de que isso realmente acontecia (textos antigos, arqueologia).
        5. **As Consequencias:** Mostre qual era o impacto dessa pratica na sociedade da epoca.
        6. **O Paralelo Moderno:** Conclua refletindo se temos praticas que parecerao bizarras no futuro.
        **REGRA ETICA:** Apresente os fatos sem julgamento e com base em pesquisa historica seria, evitando o sensacionalismo.`
    },

    // --- Categoria Automobilismo ---
    "car_passion": {
        label: "CAR PASSION - automobilismo autentico",
        category: "🚗 AUTOMOBILISMO & CARROS",
        prompt: `**FORMULA "CAR PASSION":**
        **Missao:** Celebrar cultura automotiva com conhecimento tecnico e paixao genuina.
        **Estrutura Tecnica:**
        1. **Historia Factual:** Use dados verificados sobre desenvolvimento e lancamento.
        2. **Especificacoes Precisas:** Forneca informacoes tecnicas corretas e relevantes.
        3. **Impacto Cultural Real:** Documente influencia genuina na sociedade e cultura.
        4. **Analise Tecnica:** Explique engenharia e design com conhecimento especializado.
        5. **Legado Verificavel:** Mostre influencia real na industria automotiva.
        6. **Paixao Autentica:** Compartilhe entusiasmo baseado em conhecimento e experiencia.
        **REGRA ETICA:** Mantenha precisao tecnica e evite hype comercial excessivo.`
    },
    "drive_test": {
        label: "DRIVE TEST - reviews honestos",
        category: "🚗 AUTOMOBILISMO & CARROS",
        prompt: `**FORMULA "DRIVE TEST":**
        **Missao:** Fornecer avaliacoes automotivas honestas e uteis para compradores.
        **Estrutura Honesta:**
        1. **Primeiras Impressoes Genuinas:** Compartilhe reacoes autenticas baseadas em experiencia real.
        2. **Analise Tecnica Objetiva:** Use conhecimento especializado para avaliar componentes.
        3. **Testes Praticos Reais:** Demonstre performance em condicoes reais de uso.
        4. **Pontos Fortes e Fracos:** Seja equilibrado, destacando qualidades e limitacoes.
        5. **Comparacao Justa:** Compare com concorrentes equivalentes de forma objetiva.
        6. **Recomendacao Honesta:** Base conclusoes em testes realizados e necessidades reais.
        **REGRA ETICA:** Declare qualquer patrocinio e mantenha independencia editorial.`
    },

    // --- Categoria Planetas & Espaco ---
    "planet_deep": {
        label: "PLANET DEEP - astronomia cientifica",
        category: "🪐 PLANETAS & ESPACO",
        prompt: `**FORMULA "PLANET DEEP":**
        **Missao:** Apresentar conhecimento astronomico baseado em ciencia atual.
        **Estrutura Cientifica:**
        1. **Dados Cientificos Atuais:** Use informacoes de agencias espaciais e pesquisas peer-reviewed.
        2. **Especificacoes Verificadas:** Forneca medidas e caracteristicas baseadas em observacoes reais.
        3. **Descobertas Documentadas:** Compartilhe achados de missoes espaciais verificaveis.
        4. **Teorias Fundamentadas:** Explique hipoteses cientificas com base em evidencias.
        5. **Limitacoes do Conhecimento:** Seja transparente sobre incertezas cientificas.
        6. **Futuro da Exploracao:** Discuta missoes planejadas com base em informacoes oficiais.
        **REGRA ETICA:** Use apenas fontes cientificas confiaveis e atualizadas.`
    },
    "cosmic_journey": {
        label: "COSMIC JOURNEY - historias espaciais reais",
        category: "🪐 PLANETAS & ESPACO",
        prompt: `**FORMULA "COSMIC JOURNEY":**
        **Missao:** Narrar missoes espaciais com precisao historica e respeito aos envolvidos.
        **Estrutura Historica:**
        1. **Contexto Historico Real:** Use documentacao oficial sobre missoes e objetivos.
        2. **Desafios Tecnicos Reais:** Explique dificuldades baseadas em registros de engenharia.
        3. **Pessoas Reais:** Retrate astronautas e cientistas com dignidade e complexidade.
        4. **Momentos Criticos Documentados:** Narre eventos baseados em registros oficiais.
        5. **Conquistas Verificaveis:** Celebre realizacoes baseadas em resultados documentados.
        6. **Legado Cientifico:** Explique impacto real das missoes no conhecimento humano.
        **REGRA ETICA:** Respeite a memoria dos envolvidos e mantenha precisao historica.`
    },

    // --- Categoria Educacao e Aprendizado ---
    "concept_clarity": {
        label: "CONCEPT CLARITY (Explicacoes Didaticas)",
        category: "🎓 EDUCACAO & APRENDIZADO",
        prompt: `**FORMULA "CONCEPT CLARITY":**
        **Missao:** Ensinar conceitos de forma clara, precisa e pedagogicamente eficaz.
        **Estrutura Didatica:**
        1. **Definicao Precisa:** Use terminologia correta e definicoes academicamente aceitas.
        2. **Contexto Relevante:** Explique por que o conceito e importante e onde se aplica.
        3. **Analogias Apropriadas:** Use comparacoes que realmente esclarecem, nao confundem.
        4. **Exemplos Verificaveis:** Demonstre o conceito com casos reais e especificos.
        5. **Equivocos Comuns:** Esclareca mal-entendidos frequentes de forma construtiva.
        6. **Aplicacao Pratica:** Mostre como usar o conhecimento em situacoes reais.
        **REGRA ETICA:** Mantenha rigor academico e admita limitacoes do proprio conhecimento.`
    },

    // --- Categoria Negocios & Empreendedorismo ---
    "scale_smart": {
        label: "SCALE SMART (Crescimento Sustentavel)",
        category: "💰 NEGOCIOS & EMPREENDEDORISMO",
        prompt: `**FORMULA "SCALE SMART":**
        **Missao:** Ensinar crescimento empresarial baseado em praticas comprovadas.
        **Estrutura Empresarial:**
        1. **Desafio Real:** Identifique problemas genuinos enfrentados por empreendedores.
        2. **Analise Factual:** Use dados e estudos de caso reais para explicar causas.
        3. **Solucoes Testadas:** Apresente estrategias com historico de sucesso documentado.
        4. **Implementacao Realistica:** Forneca passos praticos e cronogramas realisticos.
        5. **Metricas Mensuraveis:** Defina indicadores claros de progresso e sucesso.
        6. **Recursos Legitimados:** Indique ferramentas e fontes genuinamente uteis.
        **REGRA ETICA:** Evite promessas de enriquecimento rapido ou formulas magicas.`
    },
    "mindset_money": {
        label: "MINDSET MONEY (Mentalidade Financeira Saudavel)",
        category: "💰 NEGOCIOS & EMPREENDEDORISMO",
        prompt: `**FORMULA "MINDSET MONEY":**
        **Missao:** Promover mentalidade financeira baseada em principios eticos e sustentaveis.
        **Estrutura Responsavel:**
        1. **Crencas Limitantes Reais:** Identifique padroes de pensamento baseados em pesquisa psicologica.
        2. **Origem das Crencas:** Explique formacao de mentalidades com base em sociologia e psicologia.
        3. **Alternativas Saudaveis:** Apresente mudancas baseadas em estudos de comportamento.
        4. **Evidencia Cientifica:** Use pesquisas sobre psicologia do dinheiro e sucesso.
        5. **Mudancas Graduais:** Proponha transformacoes realistas e sustentaveis.
        6. **Impacto a Longo Prazo:** Foque em resultados sustentaveis, nao ganhos rapidos.
        **REGRA ETICA:** Promova saude financeira real, nao obsessao por riqueza.`
    },
    
    // --- Categoria Produtividade & Foco ---
    "productivity_hacks": {
        label: "PRODUCTIVITY HACKS - dicas baseadas em ciencia",
        category: "🚀 PRODUTIVIDADE & FOCO",
        prompt: `**FORMULA "PRODUCTIVITY HACKS":**
        **Missao:** Compartilhar tecnicas de produtividade eficazes, baseadas em evidencias cientificas.
        **Estrutura de Otimizacao:**
        1. **O Problema Comum:** Apresente um desafio de produtividade universal (ex: falta de tempo).
        2. **A Solucao Contra-intuitiva:** Introduza uma tecnica que desafia o senso comum.
        3. **A Ciencia por Tras:** Explique o principio psicologico ou neurologico que faz a tecnica funcionar.
        4. **O Metodo Passo a Passo:** De instrucoes claras e simples para aplicar a tecnica.
        5. **Prova Social/Estudo de Caso:** Mostre exemplos de como isso funcionou para outros ou em estudos.
        6. **O Beneficio a Longo Prazo:** Conclua explicando como isso melhora o bem-estar, nao apenas o trabalho.
        **REGRA ETICA:** Basear todas as dicas em ciencia comportamental e estudos, evitando promessas de 'solucoes magicas'.`
    },
    "deep_work_flow": {
        label: "DEEP WORK FLOW - tecnicas de foco profundo",
        category: "🚀 PRODUTIVIDADE & FOCO",
        prompt: `**FORMULA "DEEP WORK FLOW":**
        **Missao:** Ensinar como entrar e manter um estado de 'flow' ou trabalho focado e sem distrações.
        **Estrutura de Imersao:**
        1. **O Inimigo: Distracao:** Mostre o impacto negativo das interrupcoes constantes na qualidade do trabalho.
        2. **O Conceito de 'Deep Work':** Defina o que e o trabalho focado e por que ele e tao valioso.
        3. **Preparando o Ambiente:** De dicas praticas para criar um espaco fisico e digital livre de distrações.
        4. **O Ritual de Inicio:** Ensine a criar um 'gatilho' para sinalizar ao cerebro que e hora de focar.
        5. **Tecnicas de Manutencao do Foco:** Apresente metodos (como Pomodoro) para sustentar a concentracao.
        6. **A Recompensa do Foco:** Termine descrevendo a sensacao de realizacao e a qualidade superior do trabalho produzido.
        **REGRA ETICA:** Apresente o foco como uma habilidade a ser treinada, nao um 'estado' magico e facil de alcancar.`
    },
    "digital_detox": {
        label: "DIGITAL DETOX - como se desconectar",
        category: "🚀 PRODUTIVIDADE & FOCO",
        prompt: `**FORMULA "DIGITAL DETOX":**
        **Missao:** Oferecer um guia pratico para reduzir a sobrecarga digital e melhorar a saude mental.
        **Estrutura de Desconexao:**
        1. **Os Sintomas da Sobrecarga:** Descreva os sinais de exaustao digital (ansiedade, falta de foco).
        2. **O Objetivo Nao e Abandonar:** Esclareca que a meta e o uso intencional, nao a eliminacao da tecnologia.
        3. **O Desafio de 24 Horas:** Proponha um pequeno desafio de desconexao para o espectador.
        4. **Estrategias de Reducao:** De dicas praticas (desativar notificacoes, apps de controle de tempo).
        5. **Alternativas Analogicas:** Sugira atividades offline para preencher o tempo (leitura, hobbies).
        6. **O Beneficio da Clareza Mental:** Conclua mostrando como a desconexao aumenta a criatividade e o bem-estar.
        **REGRA ETICA:** Evite demonizar a tecnologia; promova uma relacao saudavel e equilibrada com ela.`
    },
    "goal_setting_clarity": {
        label: "GOAL SETTING CLARITY - definindo metas",
        category: "🚀 PRODUTIVIDADE & FOCO",
        prompt: `**FORMULA "GOAL SETTING CLARITY":**
        **Missao:** Ensinar metodos comprovados para definir metas que sejam realmente alcancadas.
        **Estrutura de Planejamento:**
        1. **Por que Metas Falham:** Explique os erros comuns (metas vagas, grandes demais).
        2. **O Metodo SMART (ou similar):** Apresente um framework estabelecido (Especifico, Mensuravel, Atingivel, Relevante, Temporal).
        3. **Definindo a Meta na Pratica:** Guie o espectador na transformacao de um sonho vago em uma meta SMART.
        4. **Engenharia Reversa:** Ensine a quebrar a meta grande em pequenos passos semanais e diarios.
        5. **Sistema de Revisao:** Destaque a importancia de revisar o progresso e ajustar o plano.
        6. **Celebrando as Pequenas Vitorias:** Conclua enfatizando a motivacao que vem de celebrar marcos.
        **REGRA ETICA:** Foque no processo e na consistencia, nao em resultados rapidos e irreais.`
    },
    "procrastination_solution": {
        label: "PROCRASTINATION SOLUTION - vencendo a procrastinacao",
        category: "🚀 PRODUTIVIDADE & FOCO",
        prompt: `**FORMULA "PROCRASTINATION SOLUTION":**
        **Missao:** Abordar as causas da procrastinacao e oferecer estrategias praticas para supera-la.
        **Estrutura de Acao:**
        1. **Nao e Preguica:** Explique a psicologia por tras da procrastinacao (medo, perfeccionismo).
        2. **Identifique a Causa Raiz:** Ajude o espectador a diagnosticar por que ele esta procrastinando uma tarefa.
        3. **A Regra dos 2 Minutos:** Apresente uma tecnica simples para comecar imediatamente.
        4. **Tornando a Tarefa Menos Intimidadora:** Ensine a quebrar a tarefa em partes minusculas.
        5. **Crie um Prazo e Recompensa:** Mostre como usar sistemas externos de responsabilidade e recompensa.
        6. **O Poder do 'Bom o Suficiente':** Conclua com uma mensagem sobre abandonar o perfeccionismo e focar no progresso.
        **REGRA ETICA:** Aborde a procrastinacao com empatia e baseie as solucoes em psicologia comportamental, nao em 'forca de vontade'.`
    },

    // --- Categoria Marketing & Vendas ---
    "authority_build": {
        label: "AUTHORITY BUILD (Autoridade Genuina)",
        category: "🎯 MARKETING & VENDAS",
        prompt: `**FORMULA "AUTHORITY BUILD":**
        **Missao:** Ensinar construcao de autoridade baseada em competencia e valor real.
        **Estrutura de Autoridade:**
        1. **Competencia Real:** Enfatize desenvolvimento de habilidades genuinas.
        2. **Valor Consistente:** Mostre como entregar valor real antes de pedir algo em troca.
        3. **Transparencia:** Seja honesto sobre experiencia, falhas e limitacoes.
        4. **Prova Social Genuina:** Use testemunhos e resultados verificaveis, nao fabricados.
        5. **Educacao Continua:** Demonstre compromisso com aprendizado e melhoria.
        6. **Etica Profissional:** Mantenha padroes eticos altos em todas as interacoes.
        **REGRA ETICA:** Construa autoridade atraves de competencia real, nao taticas manipulativas.`
    },

    // --- Categoria Otimizacao ---
    "seo_optimizer": {
        label: "OTIMIZADOR DE SEO E CTR",
        category: "🚀 OTIMIZACAO",
        prompt: `**FORMULA "OTIMIZADOR DE SEO E CTR":**
        **Missao:** Analisar um titulo de video e gerar metadados otimizados para SEO e CTR (Click-Through Rate).
        **Estrutura de Otimizacao:**
        1.  **Analise do Titulo:** A IA deve entender a intencao de busca e o apelo emocional do titulo fornecido.
        2.  **Descricao Otimizada (SEO):** Gerar uma descricao de paragrafo unico (entre 400-500 caracteres) que:
            -   Comece com uma frase que reforce o titulo.
            -   Incorpore naturalmente palavras-chave relacionadas ao tema.
            -   Inclua uma chamada para acao (CTA) sutil.
            -   Seja informativa e desperte curiosidade.
        3.  **Tags Principais:** Gerar uma lista de 10 a 15 tags relevantes, misturando termos de cauda curta e cauda longa.
        4.  **Frases para Thumbnail:** Gerar 3 frases curtas e de alto impacto (maximo 5 palavras cada) para serem usadas no texto da thumbnail. Devem ser magneticas e gerar curiosidade.
        5.  **Analise de Pontuacao:** Gerar 3 pontuacoes (0-100) para o pacote de otimizacao:
            -   **seo_potential:** Quao bem a descricao e as tags estao otimizadas para os motores de busca.
            -   **ctr_potential:** O potencial das frases de thumbnail e da descricao para atrair cliques.
            -   **clarity_score:** Quao clara e direta e a mensagem do pacote de metadados.
        **REGRA ETICA:** Todas as otimizacoes devem ser honestas e refletir o conteudo do video, evitando clickbait enganoso.`
    },

    // --- Categoria Fitness & Saude ---
    "fit_fast": {
        label: "FIT FAST (Exercicios Seguros e Eficazes)",
        category: "💪 FITNESS & SAUDE",
        prompt: `**FORMULA "FIT FAST":**
        **Missao:** Apresentar exercicios seguros baseados em ciencia do exercicio.
        **Estrutura Segura:**
        1. **Aviso de Seguranca:** Sempre inclua disclaimers sobre consultar profissionais de saude.
        2. **Base Cientifica:** Explique principios de exercicio baseados em pesquisa.
        3. **Demonstracao Correta:** Mostre forma adequada para prevenir lesoes.
        4. **Progressao Gradual:** Enfatize aumento gradual de intensidade.
        5. **Sinais de Alerta:** Ensine quando parar ou modificar exercicios.
        6. **Recuperacao Adequada:** Inclua informacoes sobre descanso e recuperacao.
        **REGRA ETICA:** Priorize seguranca sobre resultados rapidos e inclua avisos medicos.`
    },
    "health_hack": {
        label: "HEALTH HACK (Saude Baseada em Evidencias)",
        category: "💪 FITNESS & SAUDE",
        prompt: `**FORMULA "HEALTH HACK":**
        **Missao:** Compartilhar dicas de saude baseadas em pesquisa cientifica confiavel.
        **Estrutura Cientifica:**
        1. **Problema de Saude Real:** Identifique questoes baseadas em literatura medica.
        2. **Pesquisa Atual:** Use estudos peer-reviewed e fontes medicas respeitaveis.
        3. **Mecanismo Cientifico:** Explique como e por que a dica funciona.
        4. **Evidencia Disponivel:** Seja honesto sobre forca e limitacoes da evidencia.
        5. **Implementacao Segura:** Forneca orientacoes praticas e seguras.
        6. **Disclaimer Medico:** Sempre recomende consulta com profissionais de saude.
        **REGRA ETICA:** Nunca substitua orientacao medica profissional ou prometa curas.`
    },

    // --- Categoria Entretenimento & Gaming ---
    "story_master_game": {
        label: "STORY MASTER (Narrativas de Jogos)",
        category: "🎮 ENTRETENIMENTO & GAMING",
        prompt: `**FORMULA "STORY MASTER":**
        **Missao:** Explorar narrativas de jogos com analise critica e cultural.
        **Estrutura Analitica:**
        1. **Contexto do Jogo:** Forneca informacoes verificaveis sobre desenvolvimento e lancamento.
        2. **Elementos Narrativos:** Analise estrutura de historia, personagens e temas.
        3. **Significado Cultural:** Explore impacto e recepcao na cultura gaming.
        4. **Tecnicas Narrativas:** Examine como o jogo conta sua historia.
        5. **Comparacao Contextual:** Compare com outras obras relevantes.
        6. **Legado e Influencia:** Discuta impacto duradouro na industria.
        **REGRA ETICA:** Mantenha analise objetiva e respeite propriedade intelectual.`
    },
    "react_value": {
        label: "REACT VALUE (Reacoes com Valor Agregado)",
        category: "🎮 ENTRETENIMENTO & GAMING",
        prompt: `**FORMULA "REACT VALUE":**
        **Missao:** Criar conteudo de reacao que adiciona perspectiva e conhecimento.
        **Estrutura Educativa:**
        1. **Contextualizacao:** Forneca background necessario sobre o conteudo.
        2. **Reacao Autentica:** Compartilhe impressoes genuinas, nao performaticas.
        3. **Analise Informada:** Use conhecimento especializado para adicionar valor.
        4. **Perspectiva Unica:** Ofereca insights baseados em experiencia real.
        5. **Educacao:** Ensine algo novo relacionado ao conteudo.
        6. **Engajamento Construtivo:** Promova discussao inteligente nos comentarios.
        **REGRA ETICA:** Respeite direitos autorais e adicione valor genuino ao conteudo original.`
    },

    // --- Categoria Culinaria & Lifestyle ---
    "taste_journey": {
        label: "TASTE JOURNEY (Reviews Gastronomicos Honestos)",
        category: "🍳 CULINARIA & LIFESTYLE",
        prompt: `**FORMULA "TASTE JOURNEY":**
        **Missao:** Fornecer reviews gastronomicos honestos e uteis para compradores.
        **Estrutura Honesta:**
        1. **Expectativas Claras:** Defina criterios de avaliacao transparentes.
        2. **Experiencia Completa:** Avalie nao apenas comida, mas servico e ambiente.
        3. **Descricao Objetiva:** Use vocabulario preciso sem exageros.
        4. **Contexto de Preco:** Avalie custo-beneficio de forma justa.
        5. **Pontos Fortes e Fracos:** Seja equilibrado, destacando qualidades e limitacoes.
        6. **Recomendacao Clara:** Indique para quem e em que situacoes recomenda.
        **REGRA ETICA:** Declare qualquer patrocinio e mantenha independencia editorial.`
    },
    "home_transform": {
        label: "HOME TRANSFORM (Transformacoes Realisticas)",
        category: "🍳 CULINARIA & LIFESTYLE",
        prompt: `**FORMULA "HOME TRANSFORM":**
        **Missao:** Mostrar transformacoes domesticas realisticas e aplicaveis.
        **Estrutura Pratica:**
        1. **Situacao Inicial Real:** Mostre problemas genuinos, nao cenarios encenados.
        2. **Orcamento Transparente:** Seja honesto sobre custos reais envolvidos.
        3. **Processo Realistico:** Mostre tempo e esforco realmente necessarios.
        4. **Dicas Aplicaveis:** Compartilhe tecnicas que outros podem realmente usar.
        5. **Resultado Duradouro:** Mostre solucoes que funcionam a longo prazo.
        6. **Manutencao Honesta:** Explique o que e necessario para manter os resultados.
        **REGRA ETICA:** Seja realista sobre tempo, custo e dificuldade das transformacoes.`
    },

    // --- Categoria Arte & Criatividade ---
    "create_magic": {
        label: "CREATE MAGIC (Processo Criativo Autentico)",
        category: "🎨 ARTE & CRIATIVIDADE",
        prompt: `**FORMULA "CREATE MAGIC":**
        **Missao:** Demonstrar processos criativos reais, incluindo desafios e falhas.
        **Estrutura Autentica:**
        1. **Inspiracao Genuina:** Compartilhe fonte real de inspiracao para o projeto.
        2. **Processo Honesto:** Mostre etapas reais, incluindo erros e recomecos.
        3. **Tecnicas Explicadas:** Ensine metodos de forma clara e reproduzivel.
        4. **Desafios Reais:** Nao esconda dificuldades ou momentos de frustracao.
        5. **Desenvolvimento Gradual:** Mostre evolucao real da obra ao longo do tempo.
        6. **Reflexao Final:** Compartilhe aprendizados do processo criativo.
        **REGRA ETICA:** Seja honesto sobre seu nivel de habilidade e tempo investido.`
    },
    "inspire_deep": {
        label: "INSPIRE DEEP (Analise Artistica Fundamentada)",
        category: "🎨 ARTE & CRIATIVIDADE",
        prompt: `**FORMULA "INSPIRE DEEP":**
        **Missao:** Analisar arte com conhecimento historico e critico fundamentado.
        **Estrutura Academica:**
        1. **Contexto Historico:** Use pesquisa academica sobre periodo e movimento artistico.
        2. **Analise Formal:** Examine elementos tecnicos com terminologia apropriada.
        3. **Interpretacao Fundamentada:** Base analise em teoria da arte estabelecida.
        4. **Multiplas Perspectivas:** Apresente diferentes interpretacoes criticas validas.
        5. **Influencia Cultural:** Discuta impacto e recepcao baseados em fontes confiaveis.
        6. **Relevancia Contemporanea:** Conecte com questoes atuais de forma fundamentada.
        **REGRA ETICA:** Use fontes academicas confiaveis e admita limitacoes interpretativas.`
    },

    // --- Categoria Ciencia & Tecnologia ---
    "tech_review": {
        label: "TECH REVIEW (Reviews Tecnologicos Imparciais)",
        category: "🔬 CIENCIA & TECNOLOGIA",
        prompt: `**FORMULA "TECH REVIEW":**
        **Missao:** Fornecer analises tecnologicas imparciais baseadas em testes reais.
        **Estrutura Imparcial:**
        1. **Especificacoes Verificadas:** Use dados oficiais e testes independentes.
        2. **Metodologia Clara:** Explique como os testes foram realizados.
        3. **Casos de Uso Reais:** Teste em situacoes praticas, nao apenas cenarios ideais.
        4. **Limitacoes Honestas:** Seja claro sobre deficiencias e trade-offs.
        5. **Recomendacao Fundamentada:** Base conclusoes em evidencias dos testes.
        6. **REGRA ETICA:** Declare conflitos de interesse e mantenha independencia editorial.`
    },
    "future_vision": {
        label: "FUTURE VISION (Tecnologia Baseada em Pesquisa)",
        category: "🔬 CIENCIA & TECNOLOGIA",
        prompt: `**FORMULA "FUTURE VISION":**
        **Missao:** Explorar tecnologias emergentes baseado em pesquisa cientifica atual.
        **Estrutura Cientifica:**
        1. **Base Cientifica Atual:** Use pesquisas peer-reviewed e desenvolvimentos documentados.
        2. **Explicacao Tecnica Precisa:** Descreva funcionamento com precisao cientifica.
        3. **Aplicacoes Realisticas:** Discuta usos praticos baseados em desenvolvimento atual.
        4. **Desafios Tecnicos Reais:** Seja honesto sobre obstaculos e limitacoes.
        5. **Timeline Realistica:** Use projecoes baseadas em progresso cientifico documentado.
        6. **Implicacoes Equilibradas:** Discuta beneficios e riscos de forma ponderada.
        **REGRA ETICA:** Baseie previsoes em ciencia solida e evite especulacao sensacionalista.`
    },

    // --- Categoria Drama & Misterio ---
    "mystery_solver": {
        label: "MYSTERY SOLVER (True Crime Responsavel)",
        category: "🎭 DRAMA & MISTERIO",
        prompt: `**FORMULA "MYSTERY SOLVER":**
        **Missao:** Explorar casos reais com rigor jornalistico e respeito as vitimas.
        **Estrutura Jornalistica:**
        1. **Fatos Verificados:** Use apenas informacoes de fontes oficiais e confiaveis.
        2. **Respeito as Vitimas:** Trate pessoas envolvidas com dignidade e humanidade.
        3. **Contexto Apropriado:** Forneca background sem sensacionalismo.
        4. **Analise Objetiva:** Examine evidencias de forma imparcial.
        5. **Multiplas Perspectivas:** Apresente diferentes teorias baseadas em evidencias.
        6. **Conclusao Responsavel:** Seja cuidadoso ao fazer acusacoes ou especulacoes.
        **REGRA ETICA:** Priorize dignidade humana sobre entretenimento e verifique todas as informacoes.`
    },
    "reveal_process": {
        label: "REVEAL PROCESS (Investigacao Metodologica)",
        category: "🎭 DRAMA & MISTERIO",
        prompt: `**FORMULA "REVEAL PROCESS":**
        **Missao:** Demonstrar processos investigativos baseados em metodologia real.
        **Estrutura Metodologica:**
        1. **Questao Clara:** Defina o que esta sendo investigado de forma especifica.
        2. **Metodologia Transparente:** Explique como a investigacao sera conduzida.
        3. **Evidencias Documentadas:** Use apenas informacoes verificaveis.
        4. **Analise Sistematica:** Examine dados de forma logica e organizada.
        5. **Conclusoes Fundamentadas:** Base resultados apenas em evidencias coletadas.
        6. **Limitacoes Reconhecidas:** Seja honesto sobre o que nao pode ser provado.
        **REGRA ETICA:** Mantenha rigor investigativo e transparencia metodologica.`
    },

    // --- Categoria Psicologia & Desenvolvimento ---
    "breakthrough_now": {
        label: "BREAKTHROUGH NOW (Desenvolvimento Baseado em Psicologia)",
        category: "🧠 PSICOLOGIA & DESENVOLVIMENTO",
        prompt: `**FORMULA "BREAKTHROUGH NOW":**
        **Missao:** Oferecer insights de desenvolvimento pessoal baseados em psicologia cientifica.
        **Estrutura Cientifica:**
        1. **Base Psicologica:** Use teorias e pesquisas estabelecidas em psicologia.
        2. **Padroes Comportamentais Reais:** Identifique comportamentos baseados em evidencia.
        2. **Analise Cientifica:** Explique mecanismos usando conhecimento psicologico.
        4. **Estrategias Testadas:** Apresente tecnicas com suporte empirico.
        5. **Processo Realistico:** Seja honesto sobre tempo e esforco necessarios para mudanca.
        6. **Limitacoes e Quando Buscar Ajuda:** Reconheca quando e necessario apoio profissional.
        **REGRA ETICA:** Nao substitua terapia profissional e seja realista sobre resultados.`
    },
    "habit_master": {
        label: "HABIT MASTER (Formacao de Habitos Cientificamente Fundamentada)",
        category: "🧠 PSICOLOGIA & DESENVOLVIMENTO",
        prompt: `**FORMULA "HABIT MASTER":**
        **Missao:** Ensinar formacao de habitos baseada em ciencia comportamental.
        **Estrutura Comportamental:**
        1. **Ciencia dos Habitos:** Use pesquisa estabelecida sobre formacao de habitos.
        2. **Analise de Padroes:** Explique como habitos se formam neurologicamente.
        3. **Estrategias Validadas:** Apresente tecnicas com suporte cientifico.
        4. **Implementacao Gradual:** Forneca plano baseado em progressao realistica.
        5. **Monitoramento Objetivo:** Ensine como medir progresso de forma mensuravel.
        6. **Sustentabilidade a Longo Prazo:** Foque em mudancas duradouras, nao temporarias.
        **REGRA ETICA:** Base recomendações em ciencia estabelecida e seja realista sobre dificuldades.`
    },

    // --- Categoria Viagem & Cultura ---
    "culture_immersion": {
        label: "CULTURE IMMERSION (Exploracao Cultural Respeitosa)",
        category: "🌍 VIAGEM & CULTURA",
        prompt: `**FORMULA "CULTURE IMMERSION":**
        **Missao:** Explorar culturas com respeito, precisao e sensibilidade cultural.
        **Estrutura Respeitosa:**
        1. **Pesquisa Previa Seria:** Use fontes academicas e culturais respeitaveis.
        2. **Apresentacao Respeitosa:** Evite exotizacao ou estereotipos culturais.
        3. **Contexto Historico:** Forneca background historico e social adequado.
        4. **Vozes Locais:** Inclua perspectivas de pessoas da propria cultura.
        5. **Nuances Culturais:** Reconheca complexidade e diversidade dentro das culturas.
        6. **Reflexao Respeitosa:** Conecte aprendizados sem fazer generalizacoes.
        **REGRA ETICA:** Trate todas as culturas com dignidade e evite apropriacao cultural.`
    },

    // --- Categoria Financas & Investimentos ---
    "invest_smart": {
        label: "INVEST SMART (Educacao Financeira Responsavel)",
        category: "📈 FINANCAS & INVESTIMENTOS",
        prompt: `**FORMULA "INVEST SMART":**
        **Missao:** Fornecer educacao financeira baseada em principios economicos solidos.
        **Estrutura Responsavel:**
        1. **Base Economica:** Use principios financeiros estabelecidos e dados verificaveis.
        2. **Analise Objetiva:** Examine investimentos baseado em fundamentos reais.
        3. **Riscos Transparentes:** Seja completamente honesto sobre riscos e volatilidade.
        4. **Diversificacao:** Enfatize importancia de portfolios equilibrados.
        5. **Perspectiva de Longo Prazo:** Foque em estrategias sustentaveis, nao especulacao.
        6. **Disclaimers Apropriados:** Sempre inclua avisos sobre riscos e regulamentacoes.
        **REGRA ETICA:** Nunca garanta retornos e sempre inclua avisos de risco apropriados.`
    },
    "money_mastery": {
        label: "MONEY MASTERY (Gestao Financeira Saudavel)",
        category: "📈 FINANCAS & INVESTIMENTOS",
        prompt: `**FORMULA "MONEY MASTERY":**
        **Missao:** Ensinar gestao financeira pessoal baseada em principios comprovados.
        **Estrutura Educativa:**
        1. **Fundamentos Financeiros:** Use principios basicos de financas pessoais estabelecidos.
        2. **Situacoes Reais:** Aborde desafios financeiros comuns com solucoes praticas.
        3. **Planejamento Realistico:** Forneca estrategias adaptáveis a diferentes rendas.
        4. **Ferramentas Praticas:** Indique recursos legitimos e gratuitos quando possivel.
        5. **Metas Alcancaveis:** Estabeleca objetivos realisticos baseados em situacoes reais.
        6. **Educacao Continua:** Encoraje aprendizado financeiro continuo com fontes confiaveis.
        **REGRA ETICA:** Promova saude financeira sustentavel, nao esquemas de enriquecimento rapido.`
    },

    // --- Categoria Formulas Hibridas Avancadas ---
    "story_teach": {
        label: "STORY TEACH (Narrativa Educativa)",
        category: "🎪 FORMULAS HIBRIDAS AVANCADAS",
        prompt: `**FORMULA "STORY TEACH":**
        **Missao:** Combinar storytelling com educacao de forma genuina e envolvente.
        **Estrutura Educativa:**
        1. **Historia Verdadeira:** Use narrativas baseadas em eventos reais ou casos documentados.
        2. **Contexto Educativo:** Conecte a historia a licoes ou conhecimentos validos.
        3. **Desenvolvimento Organico:** Permita que a licao emerja naturalmente da narrativa.
        4. **Aplicacao Clara:** Mostre como os insights se aplicam a situacoes reais.
        5. **Verificabilidade:** Assegure que historia e licoes sejam factualmente corretas.
        6. **Impacto Duradouro:** Foque em conhecimento que permanece apos o entretenimento.
        **REGRA ETICA:** A educacao deve ser o objetivo principal, com entretenimento como meio.`
    },
    "comparison_master": {
        label: "COMPARISON MASTER (Comparacoes Imparciais)",
        category: "🎪 FORMULAS HIBRIDAS AVANCADAS",
        prompt: `**FORMULA "COMPARISON MASTER":**
        **Missao:** Criar comparacoes objetivas que genuinamente ajudem na tomada de decisao.
        **Estrutura Analitica:**
        1. **Criterios Transparentes:** Defina claramente os parametros de comparacao.
        2. **Analise Equilibrada:** Examine pros e contras de cada opcao honestamente.
        3. **Contexto de Uso:** Considere diferentes necessidades e situacoes de uso.
        4. **Dados Verificaveis:** Use informacoes factuais, nao opinioes subjetivas.
        5. **Limitacoes Reconhecidas:** Admita limitacoes da comparacao ou testes.
        6. **Conclusao Util:** Forneca orientacao clara baseada na analise realizada.
        **REGRA ETICA:** Mantenha imparcialidade e declare qualquer conflito de interesse.`
    },

    // --- FORMULA PRINCIPAL: ROTEIRO COMPLETO ETICO ---
    "complete_ethical_retention": {
        label: "ROTEIRO COMPLETO: RETENCAO ETICA",
        category: "🎯 ALTA RETENCAO ETICA",
        prompt: `
        **INSTRUCOES PARA ROTEIRO ETICO DE ALTA QUALIDADE:**

        **PRINCIPIOS FUNDAMENTAIS OBRIGATORIOS:**
        - Toda informacao deve ser fatualmente correta e verificavel
        - Nunca prometa mais do que pode entregar
        - Respeite a inteligencia do espectador
        - Foque em valor genuino, nao em tecnicas manipulativas
        - Seja transparente sobre limitacoes e incertezas
        - Cite fontes quando usar dados especificos
        - Inclua disclaimers apropriados quando necessario

        **ESTRUTURA OBRIGATORIA POR PARTE:**
        Cada parte deve ter exatamente 5 paragrafos com aproximadamente 60 palavras cada (~300 palavras total por parte).

        **OPCAO DE PERSPECTIVA NARRATIVA:**
        Escolha UMA das seguintes perspectivas e mantenha consistencia em todo o roteiro:
        - **PRIMEIRA PESSOA:** "Eu descobri...", "Vou te mostrar...", "Minha experiencia..."
        - **SEGUNDA PESSOA:** "Voce vai descobrir...", "Imagine que voce...", "Quando voce..."
        - **TERCEIRA PESSOA:** "Este metodo permite...", "A pesquisa mostra...", "Os especialistas concordam..."

        **REGRA DE CONEXAO OBRIGATORIA:** Cada parte DEVE se conectar naturalmente com a seguinte. O ultimo paragrafo de cada parte deve criar uma ponte ou gancho que leva suavemente para o tema da proxima parte. Nunca termine uma parte sem preparar o terreno para o seguinte.
        
        **REGRA CRITICA DE CONSISTENCIA (OBRIGATORIA):**
        - **NOMES DE PERSONAGENS:** Se voce introduzir um personagem com um nome (ex: "Maria", "Joao", "Ana"), use EXATAMENTE O MESMO NOME em todo o roteiro. NUNCA mude o nome de um personagem.
        - **PROFISSOES:** Se voce definir a profissao de um personagem (ex: "medico", "engenheiro", "professor"), mantenha EXATAMENTE A MESMA PROFISSAO durante todo o roteiro. NUNCA mude a profissao.
        - **PARENTESCO E RELACOES:** Se voce estabelecer um parentesco ou relacao (ex: "irmao", "mae", "filho", "marido", "esposa"), mantenha EXATAMENTE O MESMO PARENTESCO durante todo o roteiro. NUNCA mude relacionamentos.
        - **CARACTERISTICAS:** Se voce definir caracteristicas fisicas, idade, localizacao ou outros atributos de personagens ou situacoes, mantenha-os CONSISTENTES durante todo o roteiro.
        - **DETALHES DA HISTORIA:** Todos os detalhes mencionados em uma parte devem ser mantidos nas partes seguintes. NUNCA contradiga informacoes ja estabelecidas.
        - **VERIFICACAO OBRIGATORIA:** Antes de finalizar cada parte, verifique se todos os nomes, profissoes, parentescos e detalhes sao os mesmos das partes anteriores.
        
        EXEMPLOS DE ERROS PROIBIDOS:
        ❌ Parte 1: "Maria, que e medica..." | Parte 2: "Ana, que e enfermeira..." (MUDOU NOME E PROFISSAO)
        ❌ Parte 1: "Joao e irmao de Pedro..." | Parte 3: "Joao e filho de Pedro..." (MUDOU PARENTESCO)
        ❌ Parte 2: "A historia acontece em Sao Paulo..." | Parte 4: "Em Rio de Janeiro, a situacao..." (MUDOU LOCALIZACAO)
        
        EXEMPLOS CORRETOS:
        ✅ Parte 1: "Maria, que e medica..." | Parte 5: "Maria, a medica que..." (MANTEVE CONSISTENCIA)
        ✅ Parte 1: "Joao e irmao de Pedro..." | Parte 3: "Como irmaos, Joao e Pedro..." (MANTEVE PARENTESCO)
        
        Esta regra de consistencia e OBRIGATORIA e nao pode ser violada sob nenhuma circunstancia.

        **PARTE 1 - INTRODUCAO HONESTA (0-30s)**
        - Paragrafo 1: Apresente o topico de forma direta e precisa, sem sensacionalismo
        - Paragrafo 2: Explique por que o tema e relevante para o espectador de forma factual
        - Paragrafo 3: Defina claramente o que sera coberto no video, sem promessas irreais
        - Paragrafo 4: Estabeleca suas credenciais de forma humilde mas clara
        - Paragrafo 5: **CONEXAO OBRIGATORIA** - Crie transicao natural preparando o contexto necessario para compreender o tema

        **PARTE 2 - CONTEXTO E FUNDAMENTOS**
        - Paragrafo 1: Forneca background necessario com fatos verificaveis
        - Paragrafo 2: Explique conceitos fundamentais de forma clara e precisa
        - Paragrafo 3: Apresente diferentes perspectivas sobre o tema quando relevante
        - Paragrafo 4: Use analogias ou exemplos familiares e apropriados
        - Paragrafo 5: **CONEXAO OBRIGATORIA** - Conecte o contexto teorico ao conteudo pratico que sera apresentado

        **PARTE 3 - CONTEUDO PRINCIPAL**
        - Paragrafo 1: Apresente a informacao ou metodo principal com base factual
        - Paragrafo 2: Demonstre com exemplos concretos e testaveis
        - Paragrafo 3: Explique possiveis variacoes ou adaptacoes realisticas
        - Paragrafo 4: Aborde limitacoes e quando o metodo nao se aplica
        - Paragrafo 5: **CONEXAO OBRIGATORIA** - Prepare para mostrar como aplicar o conhecimento na pratica

        **PARTE FINAL - APLICACAO E CONCLUSAO**
        - Paragrafo 1: Forneca passos praticos para implementacao realistica
        - Paragrafo 2: Ofereca recursos adicionais legitimos (se aplicavel)
        - Paragrafo 3: Seja realista sobre resultados e tempos esperados
        - Paragrafo 4: Convide para engajamento autentico baseado no conteudo
        - Paragrafo 5: Conclua com uma mensagem genuinamente util que reforce o valor entregue

        **INSTRUCOES PARA PARTES ADICIONAIS:**
        Se solicitadas mais de 4 partes, as partes intermediarias devem:
        - Aprofundar aspectos especificos do conteudo principal
        - Manter a estrutura de 5 paragrafos (~300 palavras)
        - SEMPRE terminar com paragrafo de conexao para a proxima parte
        - Seguir progressao logica: Contexto → Teoria → Aplicacao → Exemplos → Conclusao

        **TATICAS PROIBIDAS:**
        ❌ "Segredos que ninguem conhece"
        ❌ "Metodo infalivel" ou "garantido"
        ❌ "Mudara sua vida para sempre"
        ❌ "Descubra o que eles nao querem que voce saiba"
        ❌ Urgencia artificial ou escassez falsa
        ❌ Promessas de resultados irreais
        ❌ Informacoes nao verificadas
        ❌ Manipulacao emocional excessiva

        **ELEMENTOS OBRIGATORIOS:**
        ✅ Informacoes fatualmente corretas
        ✅ Transparencia sobre limitacoes
        ✅ Valor genuino para o espectador
        ✅ Respeito a inteligencia da audiencia
        ✅ Citacao de fontes quando necessario
        ✅ Disclaimers apropriados
        ✅ Linguagem respeitosa e profissional
        ✅ Expectativas realisticas

        **TESTE DE QUALIDADE ETICA:**
        Antes de finalizar, pergunte-se:
        - Este conteudo genuinamente ajuda o espectador?
        - Todas as informacoes sao precisas e verificaveis?
        - Estou sendo honesto sobre limitacoes?
        - O video mantem um tom respeitoso?
        - Evitei linguagem manipulativa ou sensacionalista?
        - Inclui disclaimers apropriados?
        - As expectativas criadas sao realisticas?

        **SISTEMA DE VALIDACAO:**
        Qualquer roteiro que contenha elementos das "TATICAS PROIBIDAS" deve ser rejeitado.
        Qualquer roteiro que nao contenha os "ELEMENTOS OBRIGATORIOS" deve ser reformulado.
        `
    }
};

// SISTEMA DE VALIDACAO ETICA
const ethicalGuidelines = {
    forbidden_phrases: [
        "segredo que ninguem conhece",
        "metodo infalivel",
        "resultado garantido",
        "mudara sua vida para sempre",
        "eles nao querem que voce saiba",
        "tecnica secreta",
        "formula magica",
        "nunca revelado antes",
        "metodo proibido"
    ],
    
    required_elements: [
        "Informacoes fatualmente corretas",
        "Transparencia sobre limitacoes",
        "Valor genuino para o espectador",
        "Respeito a inteligencia da audiencia",
        "Citacao de fontes quando necessario",
        "Disclaimers apropriados",
        "Expectativas realisticas"
    ],
    
    mandatory_disclaimers: {
        health: "Consulte sempre um profissional de saude qualificado",
        finance: "Investimentos envolvem riscos. Rentabilidade passada nao garante resultados futuros",
        legal: "Esta informacao nao constitui aconselhamento juridico",
        education: "Este conteudo e para fins educacionais. Busque orientacao profissional quando apropriado"
    }
};

// SISTEMA DE VERIFICACAO AUTOMATICA
function validateScript(content) {
    const warnings = [];
    const errors = [];
    
    // Verificar frases proibidas
    ethicalGuidelines.forbidden_phrases.forEach(phrase => {
        if (content.toLowerCase().includes(phrase.toLowerCase())) {
            errors.push(`ERRO: Frase manipulativa detectada: "${phrase}"`);
        }
    });
    
    // Verificar disclaimers necessarios
    const hasHealthClaims = /\b(cura|tratamento|diagnostico|medicamento|exercicio)\b/i.test(content);
    const hasFinanceClaims = /\b(investimento|dinheiro|lucro|ganhar|renda)\b/i.test(content);
    
    if (hasHealthClaims && !content.includes("profissional de saude")) {
        warnings.push("AVISO: Conteudo de saude sem disclaimer medico apropriado");
    }
    
    if (hasFinanceClaims && !content.includes("risco")) {
        warnings.push("AVISO: Conteudo financeiro sem disclaimer de risco");
    }
    
    // Verificar promessas exageradas
    const exaggeratedPromises = [
        /100%.*garantido/i,
        /sem falhar/i,
        /resultado.*instantaneo/i,
        /mudanca.*radical.*rapida/i,
        /metodo.*revolucionario/i
    ];
    
    exaggeratedPromises.forEach(pattern => {
        if (pattern.test(content)) {
            warnings.push(`AVISO: Promessa possivelmente exagerada detectada`);
        }
    });
    
    // Verificar linguagem respeitosa
    const disrespectfulLanguage = [
        /idiota/i,
        /burro/i,
        /voce nao entende/i,
        /obvio.*qualquer um/i
    ];
    
    disrespectLanguage.forEach(pattern => {
        if (pattern.test(content)) {
            warnings.push(`AVISO: Linguagem potencialmente desrespeitosa detectada`);
        }
    });
    
    return { warnings, errors };
}

// CRITERIOS DE QUALIDADE ETICA
const qualityCriteria = {
    structure: {
        introduction: "Apresentacao clara e honesta do topico",
        context: "Background factual e verificavel",
        content: "Informacoes uteis e praticas",
        application: "Orientacoes realisticas de implementacao",
        conclusion: "Resumo honesto e proximos passos claros"
    },
    
    ethics: {
        honesty: "Todas as informacoes devem ser fatualmente corretas",
        transparency: "Limitacoes e incertezas devem ser claramente comunicadas",
        respect: "Tratamento respeitoso da audiencia e de terceiros",
        value: "Foco genuino em beneficiar o espectador",
        responsibility: "Consideracao do impacto do conteudo na audiencia"
    },
    
    prohibited_tactics: [
        "Criar falsas urgencias ou escassez",
        "Fazer promessas irreais de resultados",
        "Usar informacoes nao verificadas como fatos",
        "Explorar medos ou insegurancas desnecessariamente",
        "Aplicar pressao emocional excessiva",
        "Ridicularizar audiencias ou concorrentes",
        "Usar linguagem manipulativa ou coerciva"
    ]
};

// TEMPLATE PARA DISCLAIMERS OBRIGATORIOS
const disclaimerTemplates = {
    health: {
        text: "IMPORTANTE: As informacoes apresentadas sao para fins educacionais. Consulte sempre um profissional de saude qualificado para orientacoes especificas sobre sua condicao.",
        when_to_use: "Qualquer conteudo relacionado a saude, exercicios, dieta ou bem-estar"
    },
    
    finance: {
        text: "AVISO LEGAL: Este conteudo e educacional e nao constitui aconselhamento financeiro. Investimentos envolvem riscos e a rentabilidade passada nao garante resultados futuros. Consulte um consultor financeiro qualificado.",
        when_to_use: "Conteudo sobre investimentos, financas pessoais ou estrategias monetarias"
    },
    
    professional: {
        text: "NOTA: Este conteudo e para fins informativos. Para decisoes importantes em sua area profissional, consulte especialistas qualificados.",
        when_to_use: "Conteudo sobre negocios, carreira ou desenvolvimento profissional"
    },
    
    educational: {
        text: "Este conteudo e educacional e deve ser complementado com estudo adicional e orientacao apropriada quando necessario.",
        when_to_use: "Conteudo educativo complexo ou tecnico"
    }
};

// FUNCAO DE APROVACAO DE ROTEIRO
function approveScript(script) {
    const validation = validateScript(script);
    
    // Criterios de aprovacao
    const approved = validation.errors.length === 0;
    const needsRevision = validation.warnings.length > 0;
    
    return {
        approved: approved,
        needsRevision: needsRevision,
        feedback: {
            errors: validation.errors,
            warnings: validation.warnings,
            suggestions: needsRevision ? generateSuggestions(validation.warnings) : []
        }
    };
}

function generateSuggestions(warnings) {
    const suggestions = [];
    
    warnings.forEach(warning => {
        if (warning.includes("disclaimer")) {
            suggestions.push("Adicione disclaimers apropriados usando os templates fornecidos");
        }
        if (warning.includes("promessa")) {
            suggestions.push("Revise promessas para torna-las mais realisticas e especificas");
        }
        if (warning.includes("linguagem")) {
            suggestions.push("Use linguagem mais respeitosa e inclusiva");
        }
    });
    
    return suggestions;
}