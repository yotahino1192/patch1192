import type { GeneratedMaterial } from "./types";
export type Preset = GeneratedMaterial & { id: string; sourceContent: string };
export const INTEREST_GROUPS: Record<string,string[]> = {
  "AI・テクノロジー": [
    "生成AI",
    "AIエージェント",
    "ChatGPT",
    "プログラミング",
    "Web開発",
    "アプリ開発",
    "データサイエンス",
    "サイバーセキュリティ",
    "ロボティクス",
    "未来のテクノロジー"
  ],
  "ビジネス": [
    "起業",
    "スタートアップ",
    "マーケティング",
    "経営戦略",
    "営業",
    "プロダクトマネジメント",
    "リーダーシップ",
    "組織・マネジメント",
    "キャリア",
    "コンサルティング"
  ],
  "お金・経済": [
    "投資",
    "株式",
    "金融",
    "経済",
    "会計",
    "企業分析",
    "マクロ経済",
    "行動経済学",
    "資産形成"
  ],
  "心理・思考": [
    "心理学",
    "認知バイアス",
    "意思決定",
    "習慣",
    "モチベーション",
    "コミュニケーション",
    "論理的思考",
    "クリティカルシンキング",
    "生産性"
  ],
  "語学": [
    "英語",
    "英会話",
    "英単語",
    "ビジネス英語",
    "中国語",
    "韓国語",
    "スペイン語"
  ],
  "教養": [
    "哲学",
    "歴史",
    "世界史",
    "日本史",
    "政治",
    "社会",
    "宗教",
    "地理",
    "国際関係",
    "文化"
  ],
  "科学": [
    "宇宙",
    "物理",
    "化学",
    "生物",
    "脳科学",
    "医療",
    "人体",
    "環境",
    "数学",
    "統計"
  ],
  "クリエイティブ": [
    "デザイン",
    "UX/UI",
    "動画制作",
    "写真",
    "音楽",
    "ライティング",
    "SNS",
    "広告",
    "コンテンツ制作"
  ],
  "生活・自己成長": [
    "健康",
    "筋トレ",
    "睡眠",
    "栄養",
    "旅行",
    "料理",
    "人間関係",
    "自己成長",
    "読書"
  ]
};
export const GOALS = ["仕事で使いたい", "教養を広げたい", "学校の勉強に使いたい", "資格勉強", "将来に役立てたい", "語学を学びたい", "ただ気になる"];
export const PRESETS: Preset[] = [
  {
    "id": "ai-basics",
    "title": "生成AIの基本",
    "category": "AI",
    "summary": "文章や画像を作るAIの仕組みと限界を知る。",
    "keyPoints": [
      "生成AIは何をするAI？",
      "LLMとは何の略？",
      "生成AIの回答が自然でも、確認が必要なのはなぜ？"
    ],
    "sourceContent": "生成AIは何をするAI？\n学習したデータのパターンをもとに、新しい文章・画像・音声などを生成するAI。\nLLMとは何の略？\nLarge Language Model（大規模言語モデル）。大量の文章から言語のパターンを学ぶモデル。\n生成AIの回答が自然でも、確認が必要なのはなぜ？\nもっともらしくても事実と異なる内容を生成することがあるため。\nプロンプトとは？\nAIに渡す指示や質問、条件などの入力。\nトークンとは？\nモデルが文章を処理する単位。単語の一部や文字などに分割され、日本語でも一文字と一致するとは限らない。\n学習と推論の違いは？\n学習はデータからモデルのパラメーターを調整すること。推論は学習済みモデルで入力に応じた出力を作ること。\nRAGの基本的な流れは？\n関連資料を検索し、その内容を入力に添えて回答を生成する。\n機密情報を入力する前に確認することは？\nサービスの保存・学習利用の方針と、所属組織の利用ルール。",
    "cards": [
      {
        "question": "生成AIは何をするAI？",
        "answer": "学習したデータのパターンをもとに、新しい文章・画像・音声などを生成するAI。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "LLMとは何の略？",
        "answer": "Large Language Model（大規模言語モデル）。大量の文章から言語のパターンを学ぶモデル。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "生成AIの回答が自然でも、確認が必要なのはなぜ？",
        "answer": "もっともらしくても事実と異なる内容を生成することがあるため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "プロンプトとは？",
        "answer": "AIに渡す指示や質問、条件などの入力。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "トークンとは？",
        "answer": "モデルが文章を処理する単位。単語の一部や文字などに分割され、日本語でも一文字と一致するとは限らない。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "学習と推論の違いは？",
        "answer": "学習はデータからモデルのパラメーターを調整すること。推論は学習済みモデルで入力に応じた出力を作ること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "RAGの基本的な流れは？",
        "answer": "関連資料を検索し、その内容を入力に添えて回答を生成する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "機密情報を入力する前に確認することは？",
        "answer": "サービスの保存・学習利用の方針と、所属組織の利用ルール。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "agents",
    "title": "AIエージェント入門",
    "category": "AI",
    "summary": "目標に向けてツールを使うAIを理解する。",
    "keyPoints": [
      "AIエージェントとは？",
      "ツール呼び出しとは？",
      "通常のチャットとの違いは？"
    ],
    "sourceContent": "AIエージェントとは？\n目標に向け、状況を見ながら行動やツールの利用を選ぶ仕組み。\nツール呼び出しとは？\n検索や計算などの外部機能を、モデルの判断に基づいて実行すること。\n通常のチャットとの違いは？\n回答を返すだけでなく、外部の情報取得や操作まで行う場合がある。\n計画が必要なのはなぜ？\n複数の作業を順序立て、次に何をするか判断するため。\n人の承認を入れるべき操作の例は？\n送金、公開、データ削除など、影響が大きく戻しにくい操作。\n最小権限とは？\nその作業に必要な範囲だけ、データやツールへのアクセスを許すこと。\n実行ログを残す目的は？\n何を根拠に何を実行したかを確認し、失敗の原因を調べるため。\nエージェントの停止条件の例は？\n目標達成、試行回数や費用の上限、承認が必要になった場合。",
    "cards": [
      {
        "question": "AIエージェントとは？",
        "answer": "目標に向け、状況を見ながら行動やツールの利用を選ぶ仕組み。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ツール呼び出しとは？",
        "answer": "検索や計算などの外部機能を、モデルの判断に基づいて実行すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "通常のチャットとの違いは？",
        "answer": "回答を返すだけでなく、外部の情報取得や操作まで行う場合がある。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "計画が必要なのはなぜ？",
        "answer": "複数の作業を順序立て、次に何をするか判断するため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "人の承認を入れるべき操作の例は？",
        "answer": "送金、公開、データ削除など、影響が大きく戻しにくい操作。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "最小権限とは？",
        "answer": "その作業に必要な範囲だけ、データやツールへのアクセスを許すこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "実行ログを残す目的は？",
        "answer": "何を根拠に何を実行したかを確認し、失敗の原因を調べるため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "エージェントの停止条件の例は？",
        "answer": "目標達成、試行回数や費用の上限、承認が必要になった場合。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "chatgpt-work",
    "title": "ChatGPTを仕事で使う",
    "category": "AI",
    "summary": "依頼の仕方と確認の習慣を身につける。",
    "keyPoints": [
      "仕事の依頼で最初に伝えることは？",
      "出力形式を指定する利点は？",
      "良い例を一つ添える効果は？"
    ],
    "sourceContent": "仕事の依頼で最初に伝えることは？\n目的と、誰が何のために使う成果物なのか。\n出力形式を指定する利点は？\n表、箇条書き、メールなど、後で使いやすい形で受け取れる。\n良い例を一つ添える効果は？\n求める文体や詳しさ、構成を具体的に伝えられる。\n長い文章を要約させるときの指定は？\n対象読者、残すべき要点、文字数や形式を伝える。\nAIが挙げた出典はどう扱う？\n実在するか、原文が主張を裏づけるかを自分で確認する。\n顧客データを入力するときの注意は？\n組織の規程を確認し、不要な個人情報や機密情報を除く。\n回答が期待と違ったときは？\n違う点と改善条件を具体的に伝え、段階的に修正する。\n最終的な成果物の責任は誰にある？\n利用する人や組織。事実・権利・社内基準を確認して使う。",
    "cards": [
      {
        "question": "仕事の依頼で最初に伝えることは？",
        "answer": "目的と、誰が何のために使う成果物なのか。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "出力形式を指定する利点は？",
        "answer": "表、箇条書き、メールなど、後で使いやすい形で受け取れる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "良い例を一つ添える効果は？",
        "answer": "求める文体や詳しさ、構成を具体的に伝えられる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "長い文章を要約させるときの指定は？",
        "answer": "対象読者、残すべき要点、文字数や形式を伝える。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "AIが挙げた出典はどう扱う？",
        "answer": "実在するか、原文が主張を裏づけるかを自分で確認する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "顧客データを入力するときの注意は？",
        "answer": "組織の規程を確認し、不要な個人情報や機密情報を除く。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "回答が期待と違ったときは？",
        "answer": "違う点と改善条件を具体的に伝え、段階的に修正する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "最終的な成果物の責任は誰にある？",
        "answer": "利用する人や組織。事実・権利・社内基準を確認して使う。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "bias",
    "title": "認知バイアス入門",
    "category": "心理",
    "summary": "判断の偏りに気づくための基本を学ぶ。",
    "keyPoints": [
      "認知バイアスとは？",
      "確証バイアスとは？",
      "アンカリングとは？"
    ],
    "sourceContent": "認知バイアスとは？\n情報の受け取り方や判断に生じる、一定の傾向を持つ偏り。\n確証バイアスとは？\n自分の考えを支持する情報を集めやすく、反する情報を軽視しやすい傾向。\nアンカリングとは？\n最初に見た数値や情報が、その後の判断の基準になりやすいこと。\n利用可能性ヒューリスティックとは？\n思い出しやすい事例をもとに、頻度や可能性を判断すること。\nサンクコストとは？\nすでに支払い、今後の選択で取り戻せない費用。意思決定では将来の費用と利益を比べる。\nハロー効果とは？\n一つの目立つ特徴が、他の特徴の評価にも影響すること。\n後知恵バイアスとは？\n結果を知った後で、最初から予測できたと思いやすくなること。\n判断の偏りを減らす工夫は？\n反証を探し、判断基準を先に決め、他の人の視点も取り入れる。",
    "cards": [
      {
        "question": "認知バイアスとは？",
        "answer": "情報の受け取り方や判断に生じる、一定の傾向を持つ偏り。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "確証バイアスとは？",
        "answer": "自分の考えを支持する情報を集めやすく、反する情報を軽視しやすい傾向。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "アンカリングとは？",
        "answer": "最初に見た数値や情報が、その後の判断の基準になりやすいこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "利用可能性ヒューリスティックとは？",
        "answer": "思い出しやすい事例をもとに、頻度や可能性を判断すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "サンクコストとは？",
        "answer": "すでに支払い、今後の選択で取り戻せない費用。意思決定では将来の費用と利益を比べる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ハロー効果とは？",
        "answer": "一つの目立つ特徴が、他の特徴の評価にも影響すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "後知恵バイアスとは？",
        "answer": "結果を知った後で、最初から予測できたと思いやすくなること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "判断の偏りを減らす工夫は？",
        "answer": "反証を探し、判断基準を先に決め、他の人の視点も取り入れる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "behavior",
    "title": "行動経済学の基本",
    "category": "心理",
    "summary": "人の選択が状況で変わる理由を学ぶ。",
    "keyPoints": [
      "行動経済学は何を研究する？",
      "損失回避とは？",
      "現在バイアスとは？"
    ],
    "sourceContent": "行動経済学は何を研究する？\n心理学の知見などを使い、現実の人の経済的な意思決定を研究する。\n損失回避とは？\n同じ大きさの利益より、損失を強く感じやすい傾向。\n現在バイアスとは？\n将来の利益に比べ、目先の利益を過大に重視しやすい傾向。\nフレーミング効果とは？\n同じ内容でも、表現の仕方によって選択が変わること。\nデフォルト効果とは？\nあらかじめ設定された選択肢が選ばれやすいこと。\nナッジとは？\n選択の自由を残したまま、選び方の環境を工夫して行動を促すこと。\nメンタルアカウンティングとは？\nお金を用途や出所ごとに心の中で分け、別々に扱う傾向。\nナッジ設計で大切なことは？\n本人の利益や選択の自由を尊重し、意図を隠して不利益へ誘導しないこと。",
    "cards": [
      {
        "question": "行動経済学は何を研究する？",
        "answer": "心理学の知見などを使い、現実の人の経済的な意思決定を研究する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "損失回避とは？",
        "answer": "同じ大きさの利益より、損失を強く感じやすい傾向。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "現在バイアスとは？",
        "answer": "将来の利益に比べ、目先の利益を過大に重視しやすい傾向。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "フレーミング効果とは？",
        "answer": "同じ内容でも、表現の仕方によって選択が変わること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "デフォルト効果とは？",
        "answer": "あらかじめ設定された選択肢が選ばれやすいこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ナッジとは？",
        "answer": "選択の自由を残したまま、選び方の環境を工夫して行動を促すこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "メンタルアカウンティングとは？",
        "answer": "お金を用途や出所ごとに心の中で分け、別々に扱う傾向。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ナッジ設計で大切なことは？",
        "answer": "本人の利益や選択の自由を尊重し、意図を隠して不利益へ誘導しないこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "habits",
    "title": "習慣が続く仕組み",
    "category": "心理",
    "summary": "小さく始めて続けるための工夫を学ぶ。",
    "keyPoints": [
      "習慣とは？",
      "小さく始める利点は？",
      "実行意図とは？"
    ],
    "sourceContent": "習慣とは？\n特定の状況や合図に結びつき、繰り返し行いやすくなった行動。\n小さく始める利点は？\n着手の負担を減らし、繰り返す機会を作りやすくする。\n実行意図とは？\n「もしXの状況になったらYをする」と、行動のきっかけを具体的に決めること。\n環境を整える例は？\n読書したいなら、読みたい本を手の届く場所に置いておく。\n行動記録の役割は？\n取り組みの有無や傾向を見えるようにし、振り返りにつなげる。\n一日できなかったときは？\n失敗を全体の断念にせず、次にできる小さな行動から再開する。\n習慣化に必要な日数は一律？\n一律ではない。行動の難しさ、頻度、環境、個人によって異なる。\n成果より行動目標を決める利点は？\n「3枚学ぶ」のように、自分が実行したかを確認しやすい。",
    "cards": [
      {
        "question": "習慣とは？",
        "answer": "特定の状況や合図に結びつき、繰り返し行いやすくなった行動。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "小さく始める利点は？",
        "answer": "着手の負担を減らし、繰り返す機会を作りやすくする。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "実行意図とは？",
        "answer": "「もしXの状況になったらYをする」と、行動のきっかけを具体的に決めること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "環境を整える例は？",
        "answer": "読書したいなら、読みたい本を手の届く場所に置いておく。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "行動記録の役割は？",
        "answer": "取り組みの有無や傾向を見えるようにし、振り返りにつなげる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "一日できなかったときは？",
        "answer": "失敗を全体の断念にせず、次にできる小さな行動から再開する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "習慣化に必要な日数は一律？",
        "answer": "一律ではない。行動の難しさ、頻度、環境、個人によって異なる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "成果より行動目標を決める利点は？",
        "answer": "「3枚学ぶ」のように、自分が実行したかを確認しやすい。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "invest",
    "title": "投資の基本",
    "category": "お金",
    "summary": "リスクと分散の考え方を学ぶ。",
    "keyPoints": [
      "投資のリターンとは？",
      "投資でいうリスクとは？",
      "分散投資とは？"
    ],
    "sourceContent": "投資のリターンとは？\n投資によって得られる利益や損失。値上がり益や配当などを含む。\n投資でいうリスクとは？\n結果の不確実さや値動きの幅など。元本を失う可能性もある。\n分散投資とは？\n複数の資産や地域などに投資先を分け、特定の要因への集中を減らすこと。\n複利とは？\n運用で得た利益を元本に加え、その合計に対して利益が生じる仕組み。\n株式と債券の基本的な違いは？\n株式は会社の持分。債券は発行体への貸付に相当する証券。\nインデックスファンドとは？\n特定の指数に連動する運用成果を目指す投資信託。元本保証ではない。\n手数料が重要なのはなぜ？\n運用成果から差し引かれ、長期では積み重なって結果に影響するため。\n投資前に整理することは？\n目的、使う時期、生活に必要なお金、損失を許容できる範囲。",
    "cards": [
      {
        "question": "投資のリターンとは？",
        "answer": "投資によって得られる利益や損失。値上がり益や配当などを含む。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "投資でいうリスクとは？",
        "answer": "結果の不確実さや値動きの幅など。元本を失う可能性もある。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "分散投資とは？",
        "answer": "複数の資産や地域などに投資先を分け、特定の要因への集中を減らすこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "複利とは？",
        "answer": "運用で得た利益を元本に加え、その合計に対して利益が生じる仕組み。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "株式と債券の基本的な違いは？",
        "answer": "株式は会社の持分。債券は発行体への貸付に相当する証券。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "インデックスファンドとは？",
        "answer": "特定の指数に連動する運用成果を目指す投資信託。元本保証ではない。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "手数料が重要なのはなぜ？",
        "answer": "運用成果から差し引かれ、長期では積み重なって結果に影響するため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "投資前に整理することは？",
        "answer": "目的、使う時期、生活に必要なお金、損失を許容できる範囲。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "macro",
    "title": "金利・インフレ・為替",
    "category": "お金",
    "summary": "ニュースの基本用語をつなげて理解する。",
    "keyPoints": [
      "金利とは？",
      "インフレとは？",
      "デフレとは？"
    ],
    "sourceContent": "金利とは？\nお金を借りる費用や、貸すことで受け取る対価を割合で表したもの。\nインフレとは？\n幅広い財やサービスの価格が継続的に上昇すること。\nデフレとは？\n幅広い財やサービスの価格が継続的に下落すること。\n名目金利と実質金利の違いは？\n名目金利は表示上の金利。実質金利は物価変動を考慮した金利で、概ね名目金利からインフレ率を引く。\n円安とは？\n他の通貨に対する円の価値が下がること。1ドル100円から150円は円安。\n円高が輸入価格に与える基本的な影響は？\n同じ外貨建て価格なら円での支払額が下がる。ただし実際の価格は契約などにも左右される。\n政策金利とは？\n中央銀行が金融政策のために誘導・設定する短期金利などのこと。\n金利差だけで為替は決まる？\n決まらない。将来の見通し、貿易、資金移動など複数の要因が関わる。",
    "cards": [
      {
        "question": "金利とは？",
        "answer": "お金を借りる費用や、貸すことで受け取る対価を割合で表したもの。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "インフレとは？",
        "answer": "幅広い財やサービスの価格が継続的に上昇すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "デフレとは？",
        "answer": "幅広い財やサービスの価格が継続的に下落すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "名目金利と実質金利の違いは？",
        "answer": "名目金利は表示上の金利。実質金利は物価変動を考慮した金利で、概ね名目金利からインフレ率を引く。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "円安とは？",
        "answer": "他の通貨に対する円の価値が下がること。1ドル100円から150円は円安。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "円高が輸入価格に与える基本的な影響は？",
        "answer": "同じ外貨建て価格なら円での支払額が下がる。ただし実際の価格は契約などにも左右される。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "政策金利とは？",
        "answer": "中央銀行が金融政策のために誘導・設定する短期金利などのこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "金利差だけで為替は決まる？",
        "answer": "決まらない。将来の見通し、貿易、資金移動など複数の要因が関わる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "accounts",
    "title": "決算書の読み方",
    "category": "お金",
    "summary": "三つの財務諸表の役割を理解する。",
    "keyPoints": [
      "財務三表とは？",
      "貸借対照表が示すことは？",
      "損益計算書が示すことは？"
    ],
    "sourceContent": "財務三表とは？\n貸借対照表、損益計算書、キャッシュ・フロー計算書。\n貸借対照表が示すことは？\nある時点の資産、負債、純資産。\n損益計算書が示すことは？\n一定期間の収益、費用、利益。\nキャッシュ・フロー計算書が示すことは？\n一定期間の現金などの増減を、営業・投資・財務活動に分けて示す。\n資産と負債・純資産の関係は？\n資産＝負債＋純資産。\n売上総利益の基本的な計算は？\n売上高から売上原価を引く。\n黒字でも資金不足になるのはなぜ？\n売上の入金前に支払いが来るなど、利益の計上と現金の動く時期が異なるため。\n企業を比較するときの注意は？\n業種、規模、会計方針、一時的な要因を確認し、複数年の推移も見る。",
    "cards": [
      {
        "question": "財務三表とは？",
        "answer": "貸借対照表、損益計算書、キャッシュ・フロー計算書。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "貸借対照表が示すことは？",
        "answer": "ある時点の資産、負債、純資産。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "損益計算書が示すことは？",
        "answer": "一定期間の収益、費用、利益。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "キャッシュ・フロー計算書が示すことは？",
        "answer": "一定期間の現金などの増減を、営業・投資・財務活動に分けて示す。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "資産と負債・純資産の関係は？",
        "answer": "資産＝負債＋純資産。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "売上総利益の基本的な計算は？",
        "answer": "売上高から売上原価を引く。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "黒字でも資金不足になるのはなぜ？",
        "answer": "売上の入金前に支払いが来るなど、利益の計上と現金の動く時期が異なるため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "企業を比較するときの注意は？",
        "answer": "業種、規模、会計方針、一時的な要因を確認し、複数年の推移も見る。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "marketing",
    "title": "マーケティングの基本",
    "category": "ビジネス",
    "summary": "誰にどんな価値を届けるかを考える。",
    "keyPoints": [
      "マーケティングで考える中心的な問いは？",
      "セグメンテーションとは？",
      "ターゲティングとは？"
    ],
    "sourceContent": "マーケティングで考える中心的な問いは？\n誰に、どんな価値を、どのように届けるか。\nセグメンテーションとは？\n共通の特徴やニーズを持つ集団に市場を分けること。\nターゲティングとは？\n分けた市場の中から、価値を届ける対象を選ぶこと。\nポジショニングとは？\n顧客の中で、競合と比べてどんな違いや価値で認識されるかを定めること。\n4Pとは？\nProduct（製品）、Price（価格）、Place（流通）、Promotion（販促）。\n顧客インサイトとは？\n行動の背景にある動機や課題についての深い理解。単なる属性情報とは異なる。\nコンバージョンとは？\n購入や登録など、設定した目標行動が達成されること。\nA/Bテストとは？\n対象を分けて異なる案を試し、指標の違いを比較する方法。",
    "cards": [
      {
        "question": "マーケティングで考える中心的な問いは？",
        "answer": "誰に、どんな価値を、どのように届けるか。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "セグメンテーションとは？",
        "answer": "共通の特徴やニーズを持つ集団に市場を分けること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ターゲティングとは？",
        "answer": "分けた市場の中から、価値を届ける対象を選ぶこと。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ポジショニングとは？",
        "answer": "顧客の中で、競合と比べてどんな違いや価値で認識されるかを定めること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "4Pとは？",
        "answer": "Product（製品）、Price（価格）、Place（流通）、Promotion（販促）。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "顧客インサイトとは？",
        "answer": "行動の背景にある動機や課題についての深い理解。単なる属性情報とは異なる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "コンバージョンとは？",
        "answer": "購入や登録など、設定した目標行動が達成されること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "A/Bテストとは？",
        "answer": "対象を分けて異なる案を試し、指標の違いを比較する方法。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "strategy",
    "title": "戦略フレームワーク",
    "category": "ビジネス",
    "summary": "事業を整理する道具の使い方を学ぶ。",
    "keyPoints": [
      "戦略と戦術の違いは？",
      "SWOT分析の四つの要素は？",
      "SWOTの内部要因と外部要因は？"
    ],
    "sourceContent": "戦略と戦術の違いは？\n戦略は目標達成のための大きな選択や方針。戦術はそれを実行する具体策。\nSWOT分析の四つの要素は？\n強み、弱み、機会、脅威。\nSWOTの内部要因と外部要因は？\n強み・弱みが内部、機会・脅威が外部の要因。\n3C分析とは？\nCustomer（市場・顧客）、Competitor（競合）、Company（自社）を整理する方法。\nPEST分析とは？\n政治、経済、社会、技術の観点から外部環境を整理する方法。\nファイブフォース分析の目的は？\n新規参入、代替品、買い手、売り手、既存競合から業界の競争構造を考えること。\nフレームワークを使うときの注意は？\n枠を埋めることを目的にせず、事実と仮説を区別して意思決定につなげる。\n戦略で「やらないこと」を決める理由は？\n限られた資源を重要な選択に集中させるため。",
    "cards": [
      {
        "question": "戦略と戦術の違いは？",
        "answer": "戦略は目標達成のための大きな選択や方針。戦術はそれを実行する具体策。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "SWOT分析の四つの要素は？",
        "answer": "強み、弱み、機会、脅威。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "SWOTの内部要因と外部要因は？",
        "answer": "強み・弱みが内部、機会・脅威が外部の要因。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "3C分析とは？",
        "answer": "Customer（市場・顧客）、Competitor（競合）、Company（自社）を整理する方法。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "PEST分析とは？",
        "answer": "政治、経済、社会、技術の観点から外部環境を整理する方法。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ファイブフォース分析の目的は？",
        "answer": "新規参入、代替品、買い手、売り手、既存競合から業界の競争構造を考えること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "フレームワークを使うときの注意は？",
        "answer": "枠を埋めることを目的にせず、事実と仮説を区別して意思決定につなげる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "戦略で「やらないこと」を決める理由は？",
        "answer": "限られた資源を重要な選択に集中させるため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "startup",
    "title": "スタートアップ基礎用語",
    "category": "ビジネス",
    "summary": "事業づくりで使う言葉を押さえる。",
    "keyPoints": [
      "MVPとは？",
      "PMFとは？",
      "ピボットとは？"
    ],
    "sourceContent": "MVPとは？\n仮説を検証するために必要な最小限の製品。機能の少なさ自体が目的ではない。\nPMFとは？\n製品が市場の強い需要に合っている状態。\nピボットとは？\n検証から学んだことをもとに、事業や製品の重要な方針を転換すること。\nランウェイとは？\n現在の支出などを前提に、手元資金で事業を続けられる期間。\nバーンレートとは？\n一定期間に消費する資金のペース。純額か総額かを区別する。\nCACとは？\n顧客一人を獲得するためにかかった費用。\nLTVとは？\n顧客との取引期間全体で得る価値の見積もり。売上ベースか利益ベースかに注意する。\nリテンションとは？\n顧客や利用者が継続して利用すること、またはその割合。",
    "cards": [
      {
        "question": "MVPとは？",
        "answer": "仮説を検証するために必要な最小限の製品。機能の少なさ自体が目的ではない。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "PMFとは？",
        "answer": "製品が市場の強い需要に合っている状態。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ピボットとは？",
        "answer": "検証から学んだことをもとに、事業や製品の重要な方針を転換すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ランウェイとは？",
        "answer": "現在の支出などを前提に、手元資金で事業を続けられる期間。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "バーンレートとは？",
        "answer": "一定期間に消費する資金のペース。純額か総額かを区別する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "CACとは？",
        "answer": "顧客一人を獲得するためにかかった費用。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "LTVとは？",
        "answer": "顧客との取引期間全体で得る価値の見積もり。売上ベースか利益ベースかに注意する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "リテンションとは？",
        "answer": "顧客や利用者が継続して利用すること、またはその割合。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "work-english",
    "title": "仕事で使う英語表現",
    "category": "英語",
    "summary": "会議や依頼で使える短い表現を学ぶ。",
    "keyPoints": [
      "「確認させてください」を英語で？",
      "「もう少し詳しく説明していただけますか」を英語で？",
      "「念のため確認ですが」を英語で？"
    ],
    "sourceContent": "「確認させてください」を英語で？\nLet me confirm. 確認してから返答したいときに使う。\n「もう少し詳しく説明していただけますか」を英語で？\nCould you elaborate on that?\n「念のため確認ですが」を英語で？\nJust to clarify, ...\n「進捗を教えてください」を丁寧に言うと？\nCould you give me an update?\n「ご都合のよい時間を教えてください」を英語で？\nPlease let me know what time works for you.\n「金曜までに送ります」を英語で？\nI’ll send it by Friday. by は期限を示す。\n「その点について後でお返事します」を英語で？\nI’ll get back to you on that.\n「お知らせいただきありがとうございます」を英語で？\nThank you for letting me know.",
    "cards": [
      {
        "question": "「確認させてください」を英語で？",
        "answer": "Let me confirm. 確認してから返答したいときに使う。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「もう少し詳しく説明していただけますか」を英語で？",
        "answer": "Could you elaborate on that?",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「念のため確認ですが」を英語で？",
        "answer": "Just to clarify, ...",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「進捗を教えてください」を丁寧に言うと？",
        "answer": "Could you give me an update?",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「ご都合のよい時間を教えてください」を英語で？",
        "answer": "Please let me know what time works for you.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「金曜までに送ります」を英語で？",
        "answer": "I’ll send it by Friday. by は期限を示す。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「その点について後でお返事します」を英語で？",
        "answer": "I’ll get back to you on that.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「お知らせいただきありがとうございます」を英語で？",
        "answer": "Thank you for letting me know.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "conversation",
    "title": "会話で使う基本フレーズ",
    "category": "英語",
    "summary": "会話を始め、聞き返し、つなぐ表現を学ぶ。",
    "keyPoints": [
      "「最近どう？」を英語で？",
      "「お会いできてうれしいです」を英語で？",
      "「もう一度言ってもらえますか」を英語で？"
    ],
    "sourceContent": "「最近どう？」を英語で？\nHow’s it going?\n「お会いできてうれしいです」を英語で？\nIt’s nice to meet you.\n「もう一度言ってもらえますか」を英語で？\nCould you say that again?\n「もう少しゆっくり話してもらえますか」を英語で？\nCould you speak a little more slowly?\n「どういう意味ですか」を英語で？\nWhat do you mean?\n「なるほど、それはもっともです」を英語で？\nThat makes sense.\n「少し考えさせてください」を英語で？\nLet me think for a moment.\n「話せてよかったです」を英語で？\nIt was nice talking to you.",
    "cards": [
      {
        "question": "「最近どう？」を英語で？",
        "answer": "How’s it going?",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「お会いできてうれしいです」を英語で？",
        "answer": "It’s nice to meet you.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「もう一度言ってもらえますか」を英語で？",
        "answer": "Could you say that again?",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「もう少しゆっくり話してもらえますか」を英語で？",
        "answer": "Could you speak a little more slowly?",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「どういう意味ですか」を英語で？",
        "answer": "What do you mean?",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「なるほど、それはもっともです」を英語で？",
        "answer": "That makes sense.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「少し考えさせてください」を英語で？",
        "answer": "Let me think for a moment.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "「話せてよかったです」を英語で？",
        "answer": "It was nice talking to you.",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "news-english",
    "title": "英語ニュース頻出語",
    "category": "英語",
    "summary": "見出しで出会う基本単語を学ぶ。",
    "keyPoints": [
      "increase の意味は？",
      "decline の意味は？",
      "policy の意味は？"
    ],
    "sourceContent": "increase の意味は？\n増加する、または増加。名詞としても動詞としても使う。\ndecline の意味は？\n減少する、低下する。文脈によっては断るという意味もある。\npolicy の意味は？\n政策、方針。\nsurvey の意味は？\n調査。人々への質問調査などに使われる。\nforecast の意味は？\n予測、予報。または予測する。\nissue の意味は？\n問題、論点。動詞では発行するなどの意味もある。\naccording to ... の意味は？\n〜によると。情報の出所を示す表現。\nannounce の意味は？\n発表する、知らせる。",
    "cards": [
      {
        "question": "increase の意味は？",
        "answer": "増加する、または増加。名詞としても動詞としても使う。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "decline の意味は？",
        "answer": "減少する、低下する。文脈によっては断るという意味もある。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "policy の意味は？",
        "answer": "政策、方針。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "survey の意味は？",
        "answer": "調査。人々への質問調査などに使われる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "forecast の意味は？",
        "answer": "予測、予報。または予測する。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "issue の意味は？",
        "answer": "問題、論点。動詞では発行するなどの意味もある。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "according to ... の意味は？",
        "answer": "〜によると。情報の出所を示す表現。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "announce の意味は？",
        "answer": "発表する、知らせる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "philosophers",
    "title": "哲学者10人の考え方",
    "category": "教養",
    "summary": "十人の問いから哲学への入口を見つける。",
    "keyPoints": [
      "ソクラテスが対話で目指したことは？",
      "プラトンのイデアとは？",
      "アリストテレスの徳の中庸とは？"
    ],
    "sourceContent": "ソクラテスが対話で目指したことは？\n問いを重ねて思い込みを検討し、よく生きることや徳について考えること。\nプラトンのイデアとは？\n感覚的な個物とは区別される、普遍的で変わらない本質的なあり方。\nアリストテレスの徳の中庸とは？\n感情や行為で、過剰と不足の間の適切なあり方。単純な平均ではない。\nデカルトの「我思う、ゆえに我あり」とは？\nすべてを疑っても、疑い考えている自分の存在は疑えないという確実性。\nスピノザの「神即自然」とは？\n神を自然の外の人格的存在とせず、唯一の実体として自然と同一視する考え。\nヒュームは因果関係をどう論じた？\n原因と結果の必然的な結びつきを直接知覚するのでなく、反復経験による習慣が期待を生むと論じた。\nカントの定言命法とは？\n自分の行為の原則が、誰にとっても普遍的な法則となりうるかを問う無条件の道徳命令。\nミルの功利主義の基本は？\n行為を幸福への寄与で評価する考え。ミルは快楽の量だけでなく質も重視した。\nニーチェが既存の価値を問い直した理由は？\n道徳や価値の由来を検討し、生を肯定する新しい価値の創造を考えるため。\nサルトルの「実存は本質に先立つ」とは？\n人はあらかじめ定められた本質に従うのでなく、選択と行為を通して自分を形づくるという考え。",
    "cards": [
      {
        "question": "ソクラテスが対話で目指したことは？",
        "answer": "問いを重ねて思い込みを検討し、よく生きることや徳について考えること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "プラトンのイデアとは？",
        "answer": "感覚的な個物とは区別される、普遍的で変わらない本質的なあり方。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "アリストテレスの徳の中庸とは？",
        "answer": "感情や行為で、過剰と不足の間の適切なあり方。単純な平均ではない。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "デカルトの「我思う、ゆえに我あり」とは？",
        "answer": "すべてを疑っても、疑い考えている自分の存在は疑えないという確実性。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "スピノザの「神即自然」とは？",
        "answer": "神を自然の外の人格的存在とせず、唯一の実体として自然と同一視する考え。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ヒュームは因果関係をどう論じた？",
        "answer": "原因と結果の必然的な結びつきを直接知覚するのでなく、反復経験による習慣が期待を生むと論じた。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "カントの定言命法とは？",
        "answer": "自分の行為の原則が、誰にとっても普遍的な法則となりうるかを問う無条件の道徳命令。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ミルの功利主義の基本は？",
        "answer": "行為を幸福への寄与で評価する考え。ミルは快楽の量だけでなく質も重視した。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "ニーチェが既存の価値を問い直した理由は？",
        "answer": "道徳や価値の由来を検討し、生を肯定する新しい価値の創造を考えるため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "サルトルの「実存は本質に先立つ」とは？",
        "answer": "人はあらかじめ定められた本質に従うのでなく、選択と行為を通して自分を形づくるという考え。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "spinoza",
    "title": "スピノザ入門",
    "category": "教養",
    "summary": "神・自然・自由をめぐる考えを学ぶ。",
    "keyPoints": [
      "スピノザの実体とは？",
      "スピノザは実体をいくつ認めた？",
      "属性とは？"
    ],
    "sourceContent": "スピノザの実体とは？\nそれ自体において存在し、それ自体によって考えられるもの。\nスピノザは実体をいくつ認めた？\n唯一の実体を認め、それを神あるいは自然と呼んだ。\n属性とは？\n知性が実体の本質を構成すると認識するもの。\n人が認識する二つの属性は？\n思惟と延長。\n様態とは？\n実体の変状で、他のもののうちに存在し、それを通して考えられるもの。\nコナトゥスとは？\nそれぞれのものが自分の存在を維持しようとする努力。\nスピノザにとって自由とは？\n原因のない気まぐれではなく、自らの本性の必然性によって存在し行為すること。\n感情を理解することが重要なのはなぜ？\n感情の原因を理解することで、受動的な状態から能動的なあり方へ近づけると考えたため。",
    "cards": [
      {
        "question": "スピノザの実体とは？",
        "answer": "それ自体において存在し、それ自体によって考えられるもの。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "スピノザは実体をいくつ認めた？",
        "answer": "唯一の実体を認め、それを神あるいは自然と呼んだ。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "属性とは？",
        "answer": "知性が実体の本質を構成すると認識するもの。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "人が認識する二つの属性は？",
        "answer": "思惟と延長。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "様態とは？",
        "answer": "実体の変状で、他のもののうちに存在し、それを通して考えられるもの。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "コナトゥスとは？",
        "answer": "それぞれのものが自分の存在を維持しようとする努力。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "スピノザにとって自由とは？",
        "answer": "原因のない気まぐれではなく、自らの本性の必然性によって存在し行為すること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "感情を理解することが重要なのはなぜ？",
        "answer": "感情の原因を理解することで、受動的な状態から能動的なあり方へ近づけると考えたため。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  },
  {
    "id": "history",
    "title": "世界史を変えた20の出来事",
    "category": "教養",
    "summary": "二つずつ関連づけて、世界史の転機をたどる。",
    "keyPoints": [
      "農耕の開始と都市の成立は何を変えた？",
      "文字の成立とハンムラビ法典の意義は？",
      "アテネ民主政とアレクサンドロスの遠征の影響は？"
    ],
    "sourceContent": "農耕の開始と都市の成立は何を変えた？\n定住と余剰の蓄積を促し、分業や政治組織の発達につながった。地域ごとに時期や経路は異なる。\n文字の成立とハンムラビ法典の意義は？\n文字は情報の記録を可能にし、法典は古代メソポタミアの法や社会秩序を知る重要な資料となった。\nアテネ民主政とアレクサンドロスの遠征の影響は？\n前者は市民の政治参加を発展させ、後者はギリシア文化と各地の文化が交わる契機となった。\n秦の統一とローマの帝政成立の共通点は？\n広域を支配する政治体制を整え、その後の制度や文化に大きな影響を与えた。\nキリスト教の公認とイスラームの成立の影響は？\n宗教が政治・社会・文化と深く結びつき、広域の交流や秩序形成に影響した。\nモンゴル帝国の拡大と黒死病の流行が示すことは？\nユーラシアの交流の広がりと、交通網を通じて感染症も広がり得ること。\n活版印刷の普及と宗教改革の関係は？\n印刷物の流通が、宗教的な批判や新しい考えが広まるのを助けた。\n大西洋をまたぐ航海と大西洋奴隷貿易の影響は？\n地域間の結びつきを変える一方、植民地支配や強制移動による甚大な被害をもたらした。\n産業革命とフランス革命は何を変えた？\n前者は生産と労働のあり方を、後者は政治秩序や市民の権利をめぐる考えを大きく変えた。\n二つの世界大戦は国際秩序をどう変えた？\n第一次大戦後は帝国の解体や国際連盟、第二次大戦後は国連設立や冷戦などにつながった。",
    "cards": [
      {
        "question": "農耕の開始と都市の成立は何を変えた？",
        "answer": "定住と余剰の蓄積を促し、分業や政治組織の発達につながった。地域ごとに時期や経路は異なる。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "文字の成立とハンムラビ法典の意義は？",
        "answer": "文字は情報の記録を可能にし、法典は古代メソポタミアの法や社会秩序を知る重要な資料となった。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "アテネ民主政とアレクサンドロスの遠征の影響は？",
        "answer": "前者は市民の政治参加を発展させ、後者はギリシア文化と各地の文化が交わる契機となった。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "秦の統一とローマの帝政成立の共通点は？",
        "answer": "広域を支配する政治体制を整え、その後の制度や文化に大きな影響を与えた。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "キリスト教の公認とイスラームの成立の影響は？",
        "answer": "宗教が政治・社会・文化と深く結びつき、広域の交流や秩序形成に影響した。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "モンゴル帝国の拡大と黒死病の流行が示すことは？",
        "answer": "ユーラシアの交流の広がりと、交通網を通じて感染症も広がり得ること。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "活版印刷の普及と宗教改革の関係は？",
        "answer": "印刷物の流通が、宗教的な批判や新しい考えが広まるのを助けた。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "大西洋をまたぐ航海と大西洋奴隷貿易の影響は？",
        "answer": "地域間の結びつきを変える一方、植民地支配や強制移動による甚大な被害をもたらした。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "産業革命とフランス革命は何を変えた？",
        "answer": "前者は生産と労働のあり方を、後者は政治秩序や市民の権利をめぐる考えを大きく変えた。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      },
      {
        "question": "二つの世界大戦は国際秩序をどう変えた？",
        "answer": "第一次大戦後は帝国の解体や国際連盟、第二次大戦後は国連設立や冷戦などにつながった。",
        "difficulty": 1,
        "format": "qa",
        "choices": []
      }
    ]
  }
];
export function validInterests(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === 3 && new Set(value).size === 3 && value.every(v => Object.values(INTEREST_GROUPS).flat().includes(v));
}
export function recommend(interests: string[], goal: string): { preset: Preset; reason: string }[] {
  const categories: Record<string,string> = { 'AI・テクノロジー':'AI', 'ビジネス':'ビジネス', 'お金・経済':'お金', '心理・思考':'心理', '教養':'教養' };
  const matches = (interest: string, category: string) => interest === '行動経済学' ? category === '心理' : ['英語','英会話','英単語','ビジネス英語'].includes(interest) ? category === '英語' : Object.entries(categories).some(([group,c]) => c === category && INTEREST_GROUPS[group].includes(interest));
  const purpose: Record<string,string[]> = { '仕事で使いたい':['chatgpt-work','work-english','marketing'], '教養を広げたい':['philosophers','history','bias'], '学校の勉強に使いたい':['history','news-english'], '資格勉強':['accounts','habits'], '将来に役立てたい':['invest','ai-basics'], '語学を学びたい':['work-english','conversation','news-english'], 'ただ気になる':[] };
  const popular = ['ai-basics','bias','invest'];
  return PRESETS.map((preset,index) => {
    const matched = interests.filter(i=>matches(i,preset.category));
    const purposeMatch = (purpose[goal] || []).includes(preset.id);
    return { preset, index, score: matched.length * 10 + (purposeMatch ? 3 : 0) + (popular.includes(preset.id) ? 0.5 : 0), reason: matched.length ? `${matched[0]}に興味があるあなたへ` : purposeMatch ? `「${goal}」の最初の一歩に` : 'はじめての学びにおすすめ' };
  }).sort((a,b)=>b.score-a.score || a.index-b.index).slice(0,3).map(({preset,reason})=>({preset,reason}));
}
