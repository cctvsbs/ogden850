import json
import re

# 读取 ogden850.json
with open('src/data/ogden850.json', 'r', encoding='utf-8') as f:
    words = json.load(f)

# ===== 手动标注的 exception 词 =====
exceptions = {
    'every': {
        'type': 'exception',
        'written': {'syllables': ['ev', 'e', 'ry'], 'ipa': '/ˈev.ə.ri/'},
        'spoken': {'syllables': ['ev', 'ry'], 'ipa': '/ˈev.ri/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '中间 /ə/ 弱化被压缩'
    },
    'different': {
        'type': 'exception',
        'written': {'syllables': ['dif', 'fe', 'rent'], 'ipa': '/ˈdɪf.ə.rənt/'},
        'spoken': {'syllables': ['dif', 'rent'], 'ipa': '/ˈdɪf.rənt/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '中间 /ə/ 弱化被压缩'
    },
    'camera': {
        'type': 'exception',
        'written': {'syllables': ['cam', 'e', 'ra'], 'ipa': '/ˈkæm.ə.rə/'},
        'spoken': {'syllables': ['cam', 'ra'], 'ipa': '/ˈkæm.rə/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '中间 /ə/ 弱化被压缩'
    },
    'family': {
        'type': 'exception',
        'written': {'syllables': ['fam', 'i', 'ly'], 'ipa': '/ˈfæm.ɪ.li/'},
        'spoken': {'syllables': ['fam', 'ly'], 'ipa': '/ˈfæm.li/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '中间 /ɪ/ 弱化被压缩'
    },
    'vegetable': {
        'type': 'exception',
        'written': {'syllables': ['veg', 'e', 'ta', 'ble'], 'ipa': '/ˈvedʒ.ɪ.tə.bəl/'},
        'spoken': {'syllables': ['veg', 'ta', 'ble'], 'ipa': '/ˈvedʒ.tə.bəl/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '两个弱读音节被压缩'
    },
    'chocolate': {
        'type': 'exception',
        'written': {'syllables': ['choc', 'o', 'late'], 'ipa': '/ˈtʃɒk.ə.lət/'},
        'spoken': {'syllables': ['choc', 'late'], 'ipa': '/ˈtʃɒk.lət/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '中间 /ə/ 弱化被压缩，不是字母 o 消失'
    },
    'comfortable': {
        'type': 'exception',
        'written': {'syllables': ['com', 'for', 'ta', 'ble'], 'ipa': '/ˈkʌm.fə.tə.bəl/'},
        'spoken': {'syllables': ['comf', 'ta', 'ble'], 'ipa': '/ˈkʌmf.tə.bəl/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '中间两个弱读音节被压缩'
    },
    'temperature': {
        'type': 'exception',
        'written': {'syllables': ['tem', 'pe', 'ra', 'ture'], 'ipa': '/ˈtem.pə.rə.tʃə/'},
        'spoken': {'syllables': ['tem', 'pra', 'ture'], 'ipa': '/ˈtem.prə.tʃə/'},
        'stress': 0, 'tags': ['schwa', 'reduction'],
        'note': '弱读被压缩'
    },
    # ===== 成音节辅音 / 弱化尾音（音节数相同） =====
    'even': {
        'type': 'exception',
        'written': {'syllables': ['e', 'ven'], 'ipa': '/ˈiː.vən/'},
        'spoken': {'syllables': ['e', 'ven'], 'ipa': '/ˈiː.vən/'},
        'stress': 0, 'tags': ['stress-initial', 'syllabic-n'],
        'note': '/ən/ 成音节辅音，尾音节弱化'
    },
    'ever': {
        'type': 'exception',
        'written': {'syllables': ['ev', 'er'], 'ipa': '/ˈev.ə/'},
        'spoken': {'syllables': ['ev', 'er'], 'ipa': '/ˈev.ə/'},
        'stress': 0, 'tags': ['stress-initial', 'weak-final'],
        'note': '尾音节 /ə/ 弱化'
    },
    'after': {
        'type': 'exception',
        'written': {'syllables': ['af', 'ter'], 'ipa': '/ˈɑːf.tə/'},
        'spoken': {'syllables': ['af', 'ter'], 'ipa': '/ˈɑːf.tə/'},
        'stress': 0, 'tags': ['stress-initial', 'weak-final'],
        'note': '尾音节 /ə/ 弱化'
    },
    'forward': {
        'type': 'exception',
        'written': {'syllables': ['for', 'ward'], 'ipa': '/ˈfɔː.wəd/'},
        'spoken': {'syllables': ['for', 'ward'], 'ipa': '/ˈfɔː.wəd/'},
        'stress': 0, 'tags': ['stress-initial', 'weak-final'],
        'note': '尾音节 /əd/ 弱化'
    },
    'little': {
        'type': 'exception',
        'written': {'syllables': ['lit', 'tle'], 'ipa': '/ˈlɪt.əl/'},
        'spoken': {'syllables': ['lit', 'tle'], 'ipa': '/ˈlɪt.əl/'},
        'stress': 0, 'tags': ['stress-initial', 'syllabic-l'],
        'note': '-tle = /təl/ 成音节辅音'
    },
    'over': {
        'type': 'exception',
        'written': {'syllables': ['o', 'ver'], 'ipa': '/ˈəʊ.və/'},
        'spoken': {'syllables': ['o', 'ver'], 'ipa': '/ˈəʊ.və/'},
        'stress': 0, 'tags': ['stress-initial', 'weak-final'],
        'note': '尾音节 /ə/ 弱化'
    },
    'under': {
        'type': 'exception',
        'written': {'syllables': ['un', 'der'], 'ipa': '/ˈʌn.də/'},
        'spoken': {'syllables': ['un', 'der'], 'ipa': '/ˈʌn.də/'},
        'stress': 0, 'tags': ['stress-initial', 'weak-final'],
        'note': '尾音节 /ə/ 弱化'
    },
    'other': {
        'type': 'exception',
        'written': {'syllables': ['oth', 'er'], 'ipa': '/ˈʌð.ə/'},
        'spoken': {'syllables': ['oth', 'er'], 'ipa': '/ˈʌð.ə/'},
        'stress': 0, 'tags': ['stress-initial', 'weak-final'],
        'note': '尾音节 /ə/ 弱化'
    },
}

# ===== 自动生成函数 =====
vowels = 'aeiou'

def count_vowel_clusters(word):
    """数元音簇数量 = 音节数"""
    w = word.lower()
    count = 0
    prev_v = False
    for ch in w:
        is_v = ch in vowels
        if is_v and not prev_v:
            count += 1
        prev_v = is_v
    return max(count, 1)

def simple_split(word, count):
    """简单按音节数均分"""
    if count == 1:
        return [word]
    avg = len(word) // count
    parts = []
    pos = 0
    for i in range(count):
        if i == count - 1:
            parts.append(word[pos:])
        else:
            parts.append(word[pos:pos + avg])
            pos += avg
    return parts

def get_stress_from_ipa(ipa):
    """从音标中找主重音在第几个音节"""
    if not ipa:
        return 0
    p = ipa.replace('/', '')
    if 'ˈ' in p:
        return p.split('ˈ')[0].count('.')
    if 'ˌ' in p:
        return p.split('ˌ')[0].count('.')
    return 0

def get_tags(word, count, ipa):
    """自动生成标签"""
    tags = []
    if count == 1:
        tags.append('monosyllabic')
    if 'ˈ' in ipa and ipa.split('ˈ')[0].count('.') == 0:
        tags.append('stress-initial')
    elif 'ˈ' in ipa and ipa.split('ˈ')[0].count('.') == count - 1:
        tags.append('stress-final')
    return tags

def get_note(count, stress):
    """生成注释"""
    if count == 1:
        return '单音节'
    return f'重音在第{stress + 1}个音节'

# ===== 生成 =====
output = {}
for w in words:
    key = w['word'].lower()
    
    if key in exceptions:
        output[key] = exceptions[key]
        continue
    
    phonetic = w.get('phonetic', '')
    count = count_vowel_clusters(w['word'])
    syls = simple_split(w['word'], count)
    stress = get_stress_from_ipa(phonetic)
    tags = get_tags(w['word'], count, phonetic)
    note = get_note(count, stress)
    
    ipa_str = phonetic if phonetic else f"/{w['word']}/"
    
    output[key] = {
        'type': 'regular',
        'written': {'syllables': syls, 'ipa': ipa_str},
        'spoken': {'syllables': syls, 'ipa': ipa_str},
        'stress': stress,
        'tags': tags,
        'note': note
    }

# 写入
with open('src/data/ogden850-phonetic.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f'✅ 生成完成，共 {len(output)} 个单词')
print(f'📋 其中 exception 词：{len(exceptions)} 个')