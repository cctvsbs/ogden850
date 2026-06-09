export const POS_MAP = {
  operations: '操作词',
  thingsGeneral: '名词',
  thingsPicturable: '名词',
  qualitiesGeneral: '形容词',
  qualitiesOpposite: '形容词',
}

export function getPosTag(category) {
  return POS_MAP[category] || ''
}

export const POS_COLORS = {
  operations: '#409EFF',
  thingsGeneral: '#67c23a',
  thingsPicturable: '#67c23a',
  qualitiesGeneral: '#e6a23c',
  qualitiesOpposite: '#f56c6c',
}

export function getPosColor(category) {
  return POS_COLORS[category] || '#909399'
}
