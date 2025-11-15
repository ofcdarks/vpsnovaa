// Lista de vozes (30) atualizada para Gemini TTS (Studio/Prebuilt)
const ttsVoicePresets = {
  defaultModel: "gemini-2.5-flash-preview-tts",
  sampleText: "DarkScript, a melhor ferramenta para o seu canal Dark.",
  voices: [
    { name: "Zephyr",        label: "Zephyr — “Brisa” (Brilhante)",          lang: "pt-BR", multilingual: true },
    { name: "Puck",          label: "Puck — “Vibe” (Animado)",               lang: "pt-BR" },
    { name: "Charon",        label: "Charon — “Dorio” (Informativo)",        lang: "pt-BR" },
    { name: "Kore",          label: "Kore — “Livia” (Firme)",                lang: "pt-BR", multilingual: true },
    { name: "Fenrir",        label: "Fenrir — “Rafael” (Excitado)",          lang: "pt-BR" },
    { name: "Leda",          label: "Leda — “Clara” (Juvenil)",              lang: "pt-BR" },
    { name: "Orus",          label: "Orus — “Icaro” (Firme)",                lang: "pt-BR" },
    { name: "Aoede",         label: "Aoede — “Marina” (Arejado)",            lang: "pt-BR" },
    { name: "Callirrhoe",    label: "Callirrhoe — “Nina” (Descontraido)",    lang: "pt-BR" },
    { name: "Autonoe",       label: "Autonoe — “Bia” (Brilhante)",           lang: "pt-BR" },
    { name: "Enceladus",     label: "Enceladus — “Dandara” (Sussurrado)",    lang: "pt-BR" },
    { name: "Iapetus",       label: "Iapetus — “Vitor” (Claro)",             lang: "pt-BR", multilingual: true },
    { name: "Umbriel",       label: "Umbriel — “Otavio” (Descontraido)",     lang: "pt-BR" },
    { name: "Algieba",       label: "Algieba — “Joao” (Suave)",              lang: "pt-BR" },
    { name: "Despina",       label: "Despina — “Luna” (Suave)",              lang: "pt-BR" },
    { name: "Erinome",       label: "Erinome — “Paula” (Clara)",             lang: "pt-BR" },
    { name: "Algenib",       label: "Algenib — “Gustavo” (Grave)",           lang: "pt-BR" },
    { name: "Rasalgethi",    label: "Rasalgethi — “Henrique” (Informativo)", lang: "pt-BR" },
    { name: "Laomedeia",     label: "Laomedeia — “Taina” (Animado)",         lang: "pt-BR" },
    { name: "Achernar",      label: "Achernar — “Noa” (Suave)",              lang: "pt-BR" },
    { name: "Alnilam",       label: "Alnilam — “Edu” (Firme)",               lang: "pt-BR" },
    { name: "Schedar",       label: "Schedar — “Rafa” (Linear/Constante)",   lang: "pt-BR" },
    { name: "Gacrux",        label: "Gacrux — “Sergio” (Maduro)",            lang: "pt-BR" },
    { name: "Pulcherrima",   label: "Pulcherrima — “Helena” (Projetado)",    lang: "pt-BR" },
    { name: "Achird",        label: "Achird — “Mia” (Amigavel)",             lang: "pt-BR" },
    { name: "Zubenelgenubi", label: "Zubenelgenubi — “Teo” (Casual)",        lang: "pt-BR" },
    { name: "Vindemiatrix",  label: "Vindemiatrix — “Erica” (Gentil)",       lang: "pt-BR" },
    { name: "Sadachbia",     label: "Sadachbia — “Duda” (Vivaz)",            lang: "pt-BR" },
    { name: "Sadaltager",    label: "Sadaltager — “Marcelo” (Conhecedor)",   lang: "pt-BR" },
    { name: "Sulafat",       label: "Sulafat — “Isis” (Acolhedor/Quente)",   lang: "pt-BR" },
    
  ].sort((a, b) => {
    const langOrder = ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "ja-JP", "ko-KR"];
    const indexA = langOrder.indexOf(a.lang);
    const indexB = langOrder.indexOf(b.lang);
    if (indexA !== indexB) return indexA - indexB;
    return a.label.localeCompare(b.label);
  })
};