

export default {
    id: 'chat',
    name: 'Chat de Suporte',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    category: 'system',
    
    render(container) {
            },

    async handler() {
        if (typeof window !== 'undefined' && typeof window.initializeChatWidget === 'function') {
            return await window.initializeChatWidget();
        }
        if (typeof initializeChatWidget === 'function') {
            return await initializeChatWidget();
        }
        console.warn('Função initializeChatWidget não encontrada');
    },

    init() {
        console.log('✅ Módulo Chat inicializado');
    }
};

