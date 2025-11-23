/**
 * Test Runner para Módulos
 * Verifica se os módulos estão carregando e funcionando corretamente
 */

window.ModuleTester = {
    results: [],
    
    /**
     * Executa todos os testes
     */
    async runAll() {
        console.log('🧪 Iniciando testes dos módulos...');
        this.results = [];
        
        await this.testModuleLoading();
        await this.testModuleStructure();
        await this.testMockAPIs();
        
        this.printResults();
        return this.results;
    },
    
    /**
     * Testa se os módulos estão carregando
     */
    async testModuleLoading() {
        console.log('📦 Testando carregamento de módulos...');
        
        const modules = [
            'brainstorm',
            'viral-titles',
            'script-writer',
            'translator'
        ];
        
        for (const moduleName of modules) {
            try {
                // Tentar importar dinamicamente
                const module = await import(`../frontend/tools/${moduleName}.js`);
                const moduleDefault = module.default || module;
                
                this.addResult('PASS', `Módulo ${moduleName} carregado`, {
                    hasId: !!moduleDefault.id,
                    hasName: !!moduleDefault.name,
                    hasHandler: typeof moduleDefault.handler === 'function'
                });
            } catch (error) {
                this.addResult('FAIL', `Erro ao carregar módulo ${moduleName}`, error.message);
            }
        }
    },
    
    /**
     * Testa a estrutura dos módulos
     */
    async testModuleStructure() {
        console.log('🔍 Testando estrutura dos módulos...');
        
        const requiredProperties = ['id', 'name', 'handler'];
        
        try {
            const modules = await Promise.all([
                import('../frontend/tools/brainstorm.js'),
                import('../frontend/tools/viral-titles.js'),
                import('../frontend/tools/script-writer.js'),
                import('../frontend/tools/translator.js')
            ]);
            
            modules.forEach((moduleImport, index) => {
                const module = moduleImport.default || moduleImport;
                const moduleNames = ['brainstorm', 'viral-titles', 'script-writer', 'translator'];
                const moduleName = moduleNames[index];
                
                const missingProps = requiredProperties.filter(prop => !(prop in module));
                
                if (missingProps.length === 0) {
                    this.addResult('PASS', `Módulo ${moduleName} tem estrutura correta`, {
                        properties: requiredProperties
                    });
                } else {
                    this.addResult('FAIL', `Módulo ${moduleName} faltando propriedades`, {
                        missing: missingProps
                    });
                }
            });
        } catch (error) {
            this.addResult('FAIL', 'Erro ao testar estrutura', error.message);
        }
    },
    
    /**
     * Testa se as APIs mockadas estão funcionando
     */
    async testMockAPIs() {
        console.log('🔌 Testando APIs mockadas...');
        
        if (!window.TEST_MODE) {
            this.addResult('SKIP', 'Modo de teste não ativado', 
                'Use TEST_MODE_CONTROLS.enable() para ativar');
            return;
        }
        
        // Testar apiRequestWithFallback
        if (typeof window.apiRequestWithFallback === 'function') {
            try {
                const result = await window.apiRequestWithFallback('/api/generate-legacy', 'POST', {
                    prompt: 'Test prompt',
                    model: 'gpt-4o',
                    schema: {}
                });
                
                this.addResult('PASS', 'apiRequestWithFallback funcionando', {
                    hasData: !!result.data,
                    hasApiSource: !!result.apiSource
                });
            } catch (error) {
                this.addResult('FAIL', 'Erro ao testar apiRequestWithFallback', error.message);
            }
        } else {
            this.addResult('FAIL', 'apiRequestWithFallback não está definida');
        }
        
        // Testar streamApiRequest
        if (typeof window.streamApiRequest === 'function') {
            try {
                let chunkCount = 0;
                let finalText = '';
                
                await window.streamApiRequest(
                    '/api/generate-stream',
                    { prompt: 'Test', model: 'gpt-4o', stream: true },
                    (chunk) => {
                        chunkCount++;
                        if (chunk?.choices?.[0]?.delta?.content) {
                            finalText += chunk.choices[0].delta.content;
                        }
                    },
                    () => {
                        this.addResult('PASS', 'streamApiRequest funcionando', {
                            chunksReceived: chunkCount,
                            finalTextLength: finalText.length
                        });
                    },
                    (error) => {
                        this.addResult('FAIL', 'Erro no stream', error.message);
                    }
                );
            } catch (error) {
                this.addResult('FAIL', 'Erro ao testar streamApiRequest', error.message);
            }
        } else {
            this.addResult('FAIL', 'streamApiRequest não está definida');
        }
    },
    
    /**
     * Adiciona resultado ao array
     */
    addResult(status, message, details = null) {
        this.results.push({
            status,
            message,
            details,
            timestamp: new Date().toISOString()
        });
    },
    
    /**
     * Imprime resultados no console
     */
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 RESULTADOS DOS TESTES');
        console.log('='.repeat(60));
        
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const skipped = this.results.filter(r => r.status === 'SKIP').length;
        
        console.log(`✅ Passou: ${passed}`);
        console.log(`❌ Falhou: ${failed}`);
        console.log(`⏭️  Pulado: ${skipped}`);
        console.log(`📊 Total: ${this.results.length}\n`);
        
        this.results.forEach((result, index) => {
            const icon = result.status === 'PASS' ? '✅' : 
                        result.status === 'FAIL' ? '❌' : '⏭️';
            console.log(`${icon} [${index + 1}] ${result.message}`);
            if (result.details) {
                console.log('   ', result.details);
            }
        });
        
        console.log('='.repeat(60) + '\n');
    },
    
    /**
     * Testa um módulo específico
     */
    async testModule(moduleName) {
        console.log(`🧪 Testando módulo: ${moduleName}`);
        
        try {
            const module = await import(`../frontend/tools/${moduleName}.js`);
            const moduleDefault = module.default || module;
            
            return {
                success: true,
                module: moduleDefault,
                hasId: !!moduleDefault.id,
                hasHandler: typeof moduleDefault.handler === 'function'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// Expor globalmente
if (typeof window !== 'undefined') {
    window.ModuleTester = window.ModuleTester || ModuleTester;
}

