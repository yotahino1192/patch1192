import type { CardSet } from "./types";

const topics: [RegExp, string][] = [
  [/政治|行政|省庁|内閣|国会|三権|government|politic|public administration/iu, "🏛️"],
  [/法律|憲法|民法|刑法|司法|判例|\blaw\b|legal|constitution/iu, "⚖️"],
  [/日本史|戦国|江戸|幕府|japanese history/iu, "🏯"],
  [/歴史|世界史|古代|history|historical/iu, "📜"],
  [/哲学|倫理|思想|スピノザ|プラトン|ソクラテス|philosoph|ethic|spinoza/iu, "🧠"],
  [/心理|認知|記憶|psycholog|cognit|memory/iu, "🧠"],
  [/英語|英単語|英文|english|vocabulary|grammar/iu, "🔤"],
  [/日本語|漢字|国語|japanese|kanji/iu, "📖"],
  [/言語|語学|中国語|韓国語|フランス語|ドイツ語|スペイン語|language|french|german|spanish|chinese|korean/iu, "💬"],
  [/数学|算数|数式|幾何|微分|積分|math|algebra|geometr|calculus/iu, "📐"],
  [/統計|確率|データ分析|statistic|probability|data analysis/iu, "📊"],
  [/化学|元素|分子|chemistry|chemical/iu, "🧪"],
  [/生物|細胞|遺伝|生命|biolog|genetic|\bdna\b/iu, "🧬"],
  [/物理|力学|電磁|量子|physics|quantum/iu, "⚛️"],
  [/地理|地図|地形|地球|geograph|geolog/iu, "🌏"],
  [/宇宙|天文|惑星|astronom|planet/iu, "🪐"],
  [/医学|医療|看護|解剖|病理|薬学|medical|medicine|nursing|anatomy/iu, "🩺"],
  [/経済|金融|投資|経営|会計|簿記|econom|finance|accounting|business/iu, "📈"],
  [/プログラ|情報|データベース|ネットワーク|コンピュータ|ソフトウェア|python|javascript|typescript|\bsql\b|\bhtml\b|computer|software|programming|database/iu, "💻"],
  [/音楽|楽譜|作曲|music/iu, "🎵"],
  [/美術|絵画|デザイン|\bart\b|design/iu, "🎨"],
  [/文学|小説|詩人|literature|novel|poetry/iu, "📚"],
  [/料理|調理|栄養|食材|cook|nutrition/iu, "🍳"],
  [/スポーツ|運動|体育|sport|exercise/iu, "🏃"],
  [/植物|環境|生態|plant|ecolog|environment/iu, "🌱"],
];

// Prefer the title over the category. All set surfaces share the same choice.
export function setEmoji(set: Pick<CardSet, "title"> & Partial<Pick<CardSet, "category" | "summary">>): string {
  for (const text of [set.title, set.category, set.summary]) {
    if (!text) continue;
    const topic = topics.find(([pattern]) => pattern.test(text.normalize("NFKC")));
    if (topic) return topic[1];
  }
  return "📚";
}
