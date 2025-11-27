from pathlib import Path
text = Path('app/(tabs)/index.tsx').read_text(encoding='utf-8')
for idx,line in enumerate(text.splitlines(),1):
    if 'quickNote' in line:
        print(idx, line)

