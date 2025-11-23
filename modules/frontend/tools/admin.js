

export default {
    id: 'admin',
    name: 'Painel Admin',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.781-4.121M12 11a4 4 0 11-8 0 4 4 0 018 0z',
    category: 'system',
    
    render(container) {
            },

    async handler() {
        if (typeof window !== 'undefined' && typeof window.initializeAdminPanel === 'function') {
            return await window.initializeAdminPanel();
        }
        if (typeof initializeAdminPanel === 'function') {
            return await initializeAdminPanel();
        }
        console.warn('Função initializeAdminPanel não encontrada');
    },

    init() {
        console.log('✅ Módulo Admin inicializado');
    }
};

