const fs = require('fs');
const path = 'app/(tabs)/settings.tsx';
let src = fs.readFileSync(path, 'utf8');
const marker = '  const refreshAllData = useCallback(() => {\r\n    if (typeof window !== "undefined" && (window as any).haloWord?.refreshAll) {\r\n      try { (window as any).haloWord.refreshAll(); } catch {}\r\n    }\r\n  }, []);\r\n\r\n';
const helper = `${marker}  const hydrateSettings = useCallback(async () => {\r\n    try {\r\n      setLoadingVoices(true);\r\n      const speech = await loadSpeechSettings();\r\n      setRatePercent(speech.ratePercent);\r\n      setPitchPercent(await loadPitchPercent());\r\n      const voicesList = await listVoices();\r\n      setVoices(voicesList);\r\n      const selections = await loadVoiceSelection();\r\n      setVoiceEn(selections.voiceEn);\r\n      setVoiceZh(selections.voiceZh);\r\n      const limits = await getSrsLimits();\r\n      setDailyNewLimit(limits.dailyNewLimit);\r\n      setDailyReviewLimit(limits.dailyReviewLimit);\r\n      setWordFontSize(await getWordFontSize());\r\n      setZhRate(await loadZhRate());\r\n    } finally {\r\n      setLoadingVoices(false);\r\n    }\r\n  }, []);\r\n\r\n`;
if (!src.includes(marker)) throw new Error('marker not found');
src = src.replace(marker, helper);
const effectPattern = /useEffect\(\(\) => {([\s\S]*?)\}, \[\]\);/;
if (effectPattern.test(src)) {
  src = src.replace(effectPattern, 'useEffect(() => {\r\n    hydrateSettings();\r\n  }, [hydrateSettings]);');
}
fs.writeFileSync(path, src, 'utf8');
