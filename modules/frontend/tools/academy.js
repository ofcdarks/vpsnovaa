

export default {
    id: 'academy',
    name: 'Academy',
    icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14v6m-6-3.422v-6.157a12.078 12.078 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998z',
    category: 'learning',
    
    
    render(container) {
            },

    
    async handler() {
                if (typeof window !== 'undefined' && typeof window.initializeAcademy === 'function') {
            return await window.initializeAcademy();
        }
        
                if (typeof initializeAcademy === 'function') {
            return await initializeAcademy();
        }
        
        console.warn('Função initializeAcademy não encontrada');
    },

    
    init() {
        console.log('✅ Módulo Academy inicializado');
    }
};

