from pathlib import Path
text = Path('app/(tabs)/index.tsx').read_text(encoding='utf-8')
needle = '<Text style={styles.quickNote>'
pos = text.find(needle)
print(pos)
print(text[pos-40:pos+40])

