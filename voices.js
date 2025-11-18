// Lista de vozes (30) atualizada para Gemini TTS (Studio/Prebuilt)
const ttsVoicePresets = {
  defaultModel: "gemini-2.5-flash-preview-tts",
  sampleText: "DarkScript, a melhor ferramenta para o seu canal Dark.",
  voices: [
    { name: "Zephyr",        label: "Brisa - Voz Brilhante",          lang: "pt-BR", multilingual: true },
    { name: "Puck",          label: "Vibe - Voz Animada",               lang: "pt-BR" },
    { name: "Charon",        label: "Dorio - Voz Informativa",        lang: "pt-BR" },
    { name: "Kore",          label: "Livia - Voz Firme",                lang: "pt-BR", multilingual: true },
    { name: "Fenrir",        label: "Rafael - Voz Excitada",          lang: "pt-BR" },
    { name: "Leda",          label: "Clara - Voz Juvenil",              lang: "pt-BR" },
    { name: "Orus",          label: "Icaro - Voz Firme",                lang: "pt-BR" },
    { name: "Aoede",         label: "Marina - Voz Arejada",            lang: "pt-BR" },
    { name: "Callirrhoe",    label: "Nina - Voz Descontraida",    lang: "pt-BR" },
    { name: "Autonoe",       label: "Bia - Voz Brilhante",           lang: "pt-BR" },
    { name: "Enceladus",     label: "Dandara - Voz Sussurrada",    lang: "pt-BR" },
    { name: "Iapetus",       label: "Vitor - Voz Clara",             lang: "pt-BR", multilingual: true },
    { name: "Umbriel",       label: "Otavio - Voz Descontraida",     lang: "pt-BR" },
    { name: "Algieba",       label: "Joao - Voz Suave",              lang: "pt-BR" },
    { name: "Despina",       label: "Luna - Voz Suave",              lang: "pt-BR" },
    { name: "Erinome",       label: "Paula - Voz Clara",             lang: "pt-BR" },
    { name: "Algenib",       label: "Gustavo - Voz Grave",           lang: "pt-BR" },
    { name: "Rasalgethi",    label: "Henrique - Voz Informativa", lang: "pt-BR" },
    { name: "Laomedeia",     label: "Taina - Voz Animada",         lang: "pt-BR" },
    { name: "Achernar",      label: "Noa - Voz Suave",              lang: "pt-BR" },
    { name: "Alnilam",       label: "Edu - Voz Firme",               lang: "pt-BR" },
    { name: "Schedar",       label: "Rafa - Voz Constante",   lang: "pt-BR" },
    { name: "Gacrux",        label: "Sergio - Voz Madura",            lang: "pt-BR" },
    { name: "Pulcherrima",   label: "Helena - Voz Projetada",    lang: "pt-BR" },
    { name: "Achird",        label: "Mia - Voz Amigavel",             lang: "pt-BR" },
    { name: "Zubenelgenubi", label: "Teo - Voz Casual",        lang: "pt-BR" },
    { name: "Vindemiatrix",  label: "Erica - Voz Gentil",       lang: "pt-BR" },
    { name: "Sadachbia",     label: "Duda - Voz Vivaz",            lang: "pt-BR" },
    { name: "Sadaltager",    label: "Marcelo - Voz Conhecedora",   lang: "pt-BR" },
    { name: "Sulafat",       label: "Isis - Voz Acolhedora",   lang: "pt-BR" },
    
  ].sort((a, b) => {
    const langOrder = ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "ja-JP", "ko-KR"];
    const indexA = langOrder.indexOf(a.lang);
    const indexB = langOrder.indexOf(b.lang);
    if (indexA !== indexB) return indexA - indexB;
    return a.label.localeCompare(b.label);
  })
};