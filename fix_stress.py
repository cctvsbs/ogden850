import json

with open('src/data/ogden850-phonetic.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

fixed = 0
for word, entry in data.items():
    ipa = entry['written']['ipa']
    # 去掉首尾斜杠
    p = ipa.replace('/', '')
    
    # 找主重音 ˈ 的位置
    stress_pos = 0
    if 'ˈ' in p:
        # 数 ˈ 之前有几个 . 分隔符
        before_stress = p.split('ˈ')[0]
        stress_pos = before_stress.count('.')
    elif 'ˌ' in p:
        # 只有次重音，用第一个次重音位置
        before_stress = p.split('ˌ')[0]
        stress_pos = before_stress.count('.')
    
    if entry['stress'] != stress_pos:
        entry['stress'] = stress_pos
        # 更新 note
        syls = entry['written']['syllables']
        if len(syls) == 1:
            entry['note'] = '单音节'
        else:
            entry['note'] = f"重音在第{stress_pos + 1}个音节"
        fixed += 1

with open('src/data/ogden850-phonetic.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f'✅ 修正完成，共修正 {fixed} 个单词的重音位置')