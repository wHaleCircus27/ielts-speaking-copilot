import type { TranscriptSegment } from './types';

export function createDraftTranscript(duration: number | null): TranscriptSegment[] {
  const safeDuration = duration && duration > 0 ? duration : 90;
  const segmentLength = Math.max(8, Math.min(18, Math.floor(safeDuration / 5)));
  const samples = [
    'I think this topic is very common in daily life, and I want to share one personal example.',
    'When I was preparing for an exam, I learned that time management was really important.',
    'At first, I made many grammar mistakes because I tried to speak too quickly.',
    'Later, I started to organize my answer with a clearer beginning, detail, and ending.',
    'This experience helped me become more confident when speaking English.'
  ];

  return samples.map((text, index) => {
    const start = index * segmentLength;
    return {
      id: `segment-${index + 1}`,
      start,
      end: Math.min(start + segmentLength, safeDuration),
      text
    };
  });
}

export function buildFeedback(transcript: TranscriptSegment[]): string {
  const transcriptPreview = transcript.map((segment) => segment.text).join(' ');

  const feedbackMarkdown = `## 总评\n\n这段回答整体表达清楚，能够围绕题目展开，并且有一定个人经历支撑。当前主要提升空间在语法准确性、句式变化和细节展开。\n\n## 优点\n\n- 回答结构比较完整，能给出背景、过程和结果。\n- 词汇选择自然，适合雅思口语 Part 2/Part 3 的日常表达。\n- 有主动解释个人感受，能体现交流感。\n\n## 主要问题\n\n- 部分句子偏长，容易造成语法控制不稳定。\n- 连接词可以更丰富，避免一直使用简单顺序表达。\n- 例子还可以加入更多具体细节，例如时间、地点、人物和结果。\n\n## 原句与修改建议\n\n> ${transcriptPreview.slice(0, 180)}${transcriptPreview.length > 180 ? '...' : ''}\n\n建议把长句拆成两到三个短句，并优先保证时态和主谓一致准确。可以使用 “What impressed me most was...” 或 “Looking back, I realized that...” 来增强表达层次。\n\n## 提升建议\n\n1. 每个答案先用一句话直接回应题目。\n2. 之后补充一个具体例子，而不是只给抽象描述。\n3. 录音复盘时重点检查时态、单复数和冠词。\n\n## 可直接发送给学生的最终评语\n\n你的回答整体清楚自然，有比较完整的故事线。下一步建议你减少过长句子，优先保证语法准确，同时加入更多具体细节，让答案更有画面感。`;

  return JSON.stringify({
    scorecard: {
      overallBand: 6.7,
      fluencyCoherence: {
        band: 6.8,
        evidence: '回答有清楚顺序，能持续展开，但连接手段偏基础。',
        suggestion: '增加因果、转折和总结类连接表达，减少重复使用简单顺序词。'
      },
      lexicalResource: {
        band: 6.6,
        evidence: '词汇自然但范围中等，抽象描述多于具体细节。',
        suggestion: '补充更精准的动作、情绪和场景词汇。'
      },
      grammaticalRangeAccuracy: {
        band: 6.4,
        evidence: '基本句准确，但长句中时态和从句控制不稳定。',
        suggestion: '先拆分长句，再逐步加入定语从句和名词性从句。'
      },
      pronunciation: {
        band: 6.9,
        evidence: '整体可理解，语流较自然，但重音和停顿仍可优化。',
        suggestion: '练习关键词重读，并在观点转换处主动停顿。'
      }
    },
    feedbackMarkdown
  }, null, 2);
}
