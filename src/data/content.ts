import type { StoryCard, TideKey } from '@/types';
import type { TideCard } from '@/types';

export const answerBookCards = [
  '先把最急的声音放低一点，再听真正重要的那一个。',
  '答案不一定在更用力之后，也可能在停一下之后。',
  '今天适合把问题缩小，而不是把自己逼大。',
  '允许一件事暂时没有结论，它仍然可以向前。',
  '你已经知道一部分答案，只是还需要一点安静。',
  '先照顾能被照顾的那一小块，其他可以晚一点。',
  '如果两条路都不确定，选择更能保留余力的那条。',
  '不必证明感受合理，先承认它正在这里。',
  '今天的转机，也许是一句更诚实的话。',
  '把下一步变得足够小，小到此刻就能开始。',
  '有些答案不是找到的，是在生活里慢慢长出来的。',
  '先问自己想守住什么，再决定需要放下什么。',
];

export const genericThemes = [
  '我想看看，为什么总担心自己做得不够好',
  '我想知道，为什么明明很累却不敢停下来',
  '我想梳理，怎样更真实地表达自己的需要',
];

export const tideMeta: Record<
  TideKey,
  { label: string; symbol: string; description: string; quotes: string[] }
> = {
  insight: {
    label: '觉察',
    symbol: '◐',
    description: '辨认念头、感受与正在发生的模式',
    quotes: [
      '看见正在发生什么，本身就是一点变化。',
      '你不必马上解释自己，先准确地看见就好。',
      '当一个念头被看见，它就不再等于全部的你。',
    ],
  },
  grounding: {
    label: '安定',
    symbol: '⌁',
    description: '为身体、边界与当下留出落脚处',
    quotes: [
      '先让此刻有地方落脚，答案可以晚一点来。',
      '暂停不是离开生活，是把自己也放回生活里。',
      '你可以先稳稳地站在这里，再决定下一步。',
    ],
  },
  connection: {
    label: '联结',
    symbol: '∞',
    description: '与他人，也与内在不同的声音保持联系',
    quotes: [
      '靠近不必一次说完，一句真实也能成为入口。',
      '被听见之前，你可以只说愿意说的那一点。',
      '关系不要求你立刻完整，真实的一小部分也可以。',
    ],
  },
  vitality: {
    label: '精力',
    symbol: '✦',
    description: '照顾当下可用的力气，也允许疲惫存在',
    quotes: [
      '今天留下的一点力气，也属于完成的一部分。',
      '行动不必宏大，留有余力也是一种前进。',
      '不必把力气用尽，才算认真地生活。',
    ],
  },
};

export const storyCards: StoryCard[] = [
  {
    speaker: '叙事向导 · 林岚',
    role: '陪你换一个角度',
    portrait: '岚',
    prompt: '提交之前，你又发现一个不太确定的地方。此刻，你更想怎么做？',
    whisper: '确定感很诱人，但它不一定会在下一次检查后出现。',
    left: {
      label: '再检查一次',
      result: '你选择多争取一点确定感。',
      tides: { insight: 26, grounding: 8 },
    },
    right: {
      label: '先交出够用版',
      result: '你给“已经够用”留了一个位置。',
      tides: { vitality: 28, grounding: 12 },
    },
  },
  {
    speaker: '身体',
    role: '一直在替你记得',
    portrait: '息',
    prompt: '肩膀已经绷紧很久了，可事情还没有做完。你会怎样回应这个信号？',
    whisper: '身体没有催你回答，它只是把消息送到。',
    left: {
      label: '做完再休息',
      result: '你决定先守住事情的进度。',
      tides: { vitality: 20, insight: 12 },
    },
    right: {
      label: '先离开两分钟',
      result: '事情仍在那里，你先把自己接了回来。',
      tides: { grounding: 30, vitality: 10 },
    },
  },
  {
    speaker: '阿澄',
    role: '一位愿意听的朋友',
    portrait: '澄',
    prompt: '朋友问你最近怎么样。你知道自己并不轻松，却还没有想好要说多少。',
    whisper: '表达不必一次完成，关系也可以从一句话开始。',
    left: {
      label: '说我没事',
      result: '你先保留了自己的空间。',
      tides: { grounding: 24, insight: 10 },
    },
    right: {
      label: '只说一点点',
      result: '你让真实近况有了一个很小的出口。',
      tides: { connection: 30, insight: 10 },
    },
  },
  {
    speaker: '内在的高标准',
    role: '总想替你避开失望',
    portrait: '准',
    prompt: '它说：“如果没有做到最好，就先别让别人看见。”你想怎样接住这句话？',
    whisper: '严格有时是一种保护，只是代价也会被一起带来。',
    left: {
      label: '听它的，继续改',
      result: '熟悉的保护方式再次接管了方向。',
      tides: { insight: 28, vitality: 8 },
    },
    right: {
      label: '问它在怕什么',
      result: '你没有赶走它，只是把选择权拿回来一点。',
      tides: { connection: 24, insight: 16 },
    },
  },
  {
    speaker: '明天',
    role: '一个还没有发生的时刻',
    portrait: '明',
    prompt: '你无法保证结果，却可以决定今晚怎样结束。哪一种更接近此刻的你？',
    whisper: '不确定不会因为想得更久就自动消失。',
    left: {
      label: '把所有可能想完',
      result: '你试着用准备回应未知。',
      tides: { insight: 28, grounding: 8 },
    },
    right: {
      label: '给今天一个停点',
      result: '你没有消除未知，但划出了今晚的边界。',
      tides: { grounding: 30, vitality: 12 },
    },
  },
  {
    speaker: '此刻的你',
    role: '拥有最后决定的人',
    portrait: '我',
    prompt: '走到这里，你想把哪一种态度带出这一章？',
    whisper: '这不是结论，只是今天愿意尝试的一种方向。',
    left: {
      label: '再等等，想清楚',
      result: '你为理解自己多留了一点时间。',
      tides: { insight: 24, grounding: 12 },
    },
    right: {
      label: '先走一小步',
      result: '你允许行动比答案更小，也更具体。',
      tides: { vitality: 30, grounding: 10 },
    },
  },
];

export const dailyReport = {
  headline: '今天似乎有一点向前的冲劲，也需要给自己留些余地。',
  basis: ['先聚焦一件事', '给身体留一个停点'],
  quote: '今天不用一次走完，只要把下一步放稳。',
  summary:
    '这是一份不做人格推断的基础日报。它不会假装读懂你，只提供几条低负担的生活节奏建议。',
  suggestions: [
    ['节奏', '先选一件今天最重要的事，完成后再决定是否继续。'],
    ['身体', '连续专注一段时间后，离开屏幕两分钟，让肩膀和呼吸先回来。'],
    ['联结', '如果想找人聊聊，可以只发一句真实近况，不必一次解释完整。'],
  ],
};

export const dailyReportVariants = {
  generic: dailyReport,
  insight: {
    headline: '今天很适合看清重点，但不必把每个念头都解释完。',
    basis: ['近期主动收藏了觉察潮笺', '这类潮笺靠近观察与命名'],
    quote: '先把问题照亮一角，答案可以慢一点来。',
    summary: '你近期主动收进卡槽的内容包含「觉察」潮笺。它只提供一个可解释的内容线索，不代表固定人格。',
    suggestions: [['聚焦', '把脑中的问题写成一句话，只处理最想看清的那一部分。'], ['停笔', '反复分析超过十分钟时，先做一件不需要答案的小事。'], ['表达', '用“我注意到……”开头，描述事实，不急着给自己下结论。']],
  },
  grounding: {
    headline: '今天适合把步子放稳一点，先照顾身体和边界。',
    basis: ['近期主动收藏了安定潮笺', '这类潮笺靠近身体与边界'],
    quote: '先让脚底找到地面，答案可以晚一点来。',
    summary: '你近期主动收下的内容更靠近「安定」。日报因此把建议放在减速、边界和身体信号上。',
    suggestions: [['节奏', '给今天安排一个明确停点，到了就先离开正在做的事。'], ['身体', '喝水、松开肩膀，再确认自己是否真的需要继续硬撑。'], ['边界', '面对临时请求，先说“让我看一下安排”，不必立刻答应。']],
  },
  connection: {
    headline: '今天可以靠近一点真实，也保留只说到这里的权利。',
    basis: ['近期主动收藏了联结潮笺', '这类潮笺靠近表达与关系'],
    quote: '真实不必一次说完，关系可以从一句话开始。',
    summary: '你近期主动收下的内容更靠近「联结」。这份日报会优先提供表达、倾听和关系边界方面的小建议。',
    suggestions: [['表达', '想联系谁时，先发一句近况，不必组织成完整故事。'], ['倾听', '聊天前可以先说清楚：此刻更需要陪伴，还是一起想办法。'], ['边界', '对方没有及时回应，不等于你的表达不重要。先把注意力带回今天。']],
  },
  vitality: {
    headline: '今天有一些向前的力量，也别忘了给自己留下余力。',
    basis: ['近期主动收藏了精力潮笺', '这类潮笺靠近小步行动与恢复'],
    quote: '今天留下的一点力气，也属于完成的一部分。',
    summary: '你近期主动收下的内容更靠近「精力」。这份日报会提醒你推进一件事，同时避免把可用的力气一次耗尽。',
    suggestions: [['行动', '只推进一个核心任务，其他事项先放进稍后清单。'], ['恢复', '在还有力气的时候就安排休息，而不是等到完全耗尽。'], ['期待', '把今天的完成标准写小一点，让行动可以真实发生。']],
  },
} satisfies Record<'generic' | TideKey, typeof dailyReport>;

export function reportForCards(cards: TideCard[]) {
  if (!cards.length) return dailyReportVariants.generic;
  const recent = cards.filter((card) => Date.now() - card.collectedAt <= 30 * 24 * 60 * 60 * 1000);
  if (!recent.length) return dailyReportVariants.generic;
  const counts = recent.reduce<Record<TideKey, number>>((result, card) => {
    result[card.tide] += 1;
    return result;
  }, { insight: 0, grounding: 0, connection: 0, vitality: 0 });
  const dominant = (Object.entries(counts) as Array<[TideKey, number]>).sort((a, b) => b[1] - a[1])[0][0];
  return dailyReportVariants[dominant];
}

export const quickPrompts = ['我只想说说', '帮我把压力拆小一点', '我现在有点累'];

export const localReplies = [
  '我在听。我们可以先不急着解决，把最占空间的那一小部分说清楚。',
  '听起来你已经撑了一会儿。要不要先把下一步缩小到十分钟内能做完？',
  '这件事可以暂时没有结论。此刻更需要被照顾的是身体、边界，还是有人听见你？',
];
