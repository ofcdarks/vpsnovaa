

export default {
    id: 'faq',
    name: 'FAQ',
    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4c-1.742 0-3.223-.835-3.772-2H6.5v2H4.5v-2H2.728a1 1 0 010-2h1.772V7H6.5v2h1.728zM12 18a6 6 0 100-12 6 6 0 000 12z',
    category: 'system',
    
    render(container) {
            },

    async handler() {
                console.log('FAQ carregado');
        return Promise.resolve();
    },

    init() {
        console.log('✅ Módulo FAQ inicializado');
    }
};

