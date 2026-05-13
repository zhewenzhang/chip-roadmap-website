/**
 * Signals page label mappings — enum keys (English) → display labels (Traditional Chinese).
 * DB stores English keys only; UI renders Chinese via these maps.
 */

export const STAGE_LABEL = {
  rumor: '傳聞',
  announced: '已宣布',
  sampling: '送樣',
  design_win: '設計勝出',
  pilot: '試產',
  ramp: '爬產',
  volume: '量產',
};

export const STATUS_LABEL = {
  draft: '草稿',
  watch: '觀察中',
  verified: '已驗證',
  downgraded: '降級',
  invalidated: '已失效',
};

export const IMPACT_LABEL = {
  low: '低',
  medium: '中',
  high: '高',
  explosive: '爆發性',
};

export const REGION_LABEL = {
  Global: '全球',
  China: '中國',
  Taiwan: '台灣',
  US: '美國',
  USA: '美國',
  Japan: '日本',
  Korea: '韓國',
  Europe: '歐洲',
  Israel: '以色列',
  Canada: '加拿大',
  Other: '其他',
};

/**
 * Generic lookup — falls back to the raw value when no mapping exists
 * or the value is already in Chinese.
 */
export const labelize = (map, key) => map[key] || key || '';
