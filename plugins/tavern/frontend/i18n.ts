/**
 * The Tavern's own English strings. The workbench translates only its own text, so a downloaded plugin
 * carries the translations of what it adds; anything not listed here falls back to the workbench.
 */
import { t as hostT, tf as hostTf, useLocale } from '@xueness/host';

const EN: Record<string, string> = {
  '酒馆': 'Tavern', '角色': 'Characters', '世界书': 'World books', '预设': 'Presets', '人设': 'Personas',
  '角色扮演：角色卡、世界书、预设与人设。对话以角色扮演模式进行：每轮请求按预设重新组织角色、人设与世界书，工具关闭。': 'Roleplay with character cards, world books, presets and personas. Chats run in roleplay mode: every request is rebuilt from the preset, character, persona and world books, with tools off.',
  '导入角色卡': 'Import card', '导入世界书': 'Import world book', '导入 SillyTavern 预设': 'Import SillyTavern preset', '搜索角色': 'Search characters',
  '还没有角色': 'No characters yet', '导入 SillyTavern 兼容的角色卡（JSON 或 PNG）。PNG 里的设定在浏览器中读取，只上传设定和一张小头像。': 'Import a SillyTavern-compatible card (JSON or PNG). A PNG is read in the browser; only its definition and a small avatar are uploaded.',
  '开场白': 'Greeting', '开始新对话': 'New chat', '你的第一句话': 'Your first line', '留空则以「（故事开始）」开场': 'Leave empty to open with "(The story begins.)"',
  '（故事开始）': '(The story begins.)', '开始对话': 'Start chat', '在酒馆面板中开始对话': 'Start chats from the Tavern panel', '打开酒馆面板': 'Open Tavern panel',
  '放进输入框': 'Put in composer', '存档': 'Playthroughs', '打开': 'Open', '尚未开始': 'Not started', '删除': 'Delete', '移除': 'Remove',
  '设定': 'Definition', '描述': 'Description', '性格': 'Personality', '场景': 'Scenario', '示例对话': 'Example dialogue',
  '卡片系统提示': 'Card system prompt', '后置指令': 'Post-history instructions', '作者备注': "Creator's notes", '预览提示词': 'Preview prompt',
  '无人设': 'No persona', '当前': 'Active', '设为当前': 'Make active', '全局': 'Global', '对所有角色扮演对话启用': 'On for every roleplay chat',
  '条目': 'Entries', '启用': 'On', '常驻': 'Constant', '关键词': 'Keys', '次要关键词': 'Secondary', '位置': 'Position', '顺序': 'Order', '概率': 'Chance',
  '角色前': 'Before', '角色后': 'After', '新建': 'New', '复制': 'Duplicate', '保存': 'Save', '名称': 'Name', '主提示': 'Main prompt',
  '段落顺序': 'Sections', '上移': 'Move up', '下移': 'Move down', '作者注释': "Author's note", '深度': 'Depth',
  '世界书扫描': 'World information', '扫描深度': 'Scan depth', '字符预算': 'Budget (characters)', '递归扫描': 'Recursive scan', '最大递归层数': 'Max recursion',
  '区分大小写': 'Case-sensitive', '整词匹配': 'Whole words', '使用角色卡内嵌世界书': "Use the card's embedded book",
  '角色卡自带系统提示时替换主提示': "Use the card's system prompt instead of the main prompt when it has one",
  '角色卡自带后置指令时替换后置指令': "Use the card's post-history instructions instead when it has them",
  '把开场白作为角色的第一条消息': "Send the greeting as the character's first message", '角色扮演时不提供工作区工具': 'No workspace tools in roleplay chats',
  '内置预设不能直接修改，复制后编辑。': 'The built-in preset is read-only; duplicate it to edit.', '采样参数（温度等）由模型连接决定；导入时会忽略。': 'Sampling (temperature and so on) comes from the model connection; imported values are ignored.',
  '这个文件不是可用的预设。': 'This file is not a usable preset.', '文件不是有效的 JSON。': 'The file is not valid JSON.',
  '这不是可用的角色卡：需要名称，以及描述、性格或开场白之一。': 'Not a usable card: it needs a name and a description, personality or greeting.',
  '这个世界书里没有可用的条目。': 'This world book has no usable entries.', '文件内容超过大小上限。': 'The file is over the size limit.',
  '资料库已满，请先移除一些条目。': 'The library is full; remove some items first.', '没有找到这个条目，请刷新后重试。': 'That item is gone; refresh and try again.',
  '这张 PNG 里没有角色卡数据。': 'This PNG has no card data.', '放弃修改': 'Discard', '内置': 'Built-in', '副本': 'copy',
  '人设描述': 'Persona description', '新人设': 'New persona', '已保存': 'Saved', '正在读取…': 'Loading…', '关闭': 'Close',
  '激活的世界书条目': 'Activated world entries', '没有激活的条目': 'No entries activated', '示例输入（用于触发关键词）': 'Sample input (to trigger keys)',
  '刷新预览': 'Refresh preview', '常驻条目': 'constant', '关键词命中': 'key', '递归命中': 'recursion',
  '在左侧选择一个角色。': 'Choose a character on the left.', '在左侧选择一本世界书。': 'Choose a world book on the left.', '在左侧选择一个预设。': 'Choose a preset on the left.',
  '还没有人设。人设是你在故事里的身份，会写进每轮请求。': 'No personas yet. A persona is who you are in the story; it is sent with every request.',
  '还没有世界书。世界书是可选的：条目在关键词出现在最近的对话里时才写进请求，常驻条目始终写入。': 'No world books yet. They are optional: an entry is sent when one of its keys appears in recent messages; constant entries always are.',
};
const FORMATS: Record<string, string> = {
  '开场白 {0}/{1}': 'Greeting {0}/{1}', '{0} 个存档': '{0} playthroughs', '{0} 条，常驻 {1} 条': '{0} entries, {1} constant',
  '已导入 {0} 张角色卡': 'Imported {0} cards', '已导入 {0} 本世界书': 'Imported {0} world books', '已导入 {0} 个预设': 'Imported {0} presets',
  '未导入：{0}': 'Not imported: {0}', '已开始与 {0} 的对话。': 'Started a chat with {0}.', '系统提示 {0} 字': 'System prompt: {0} characters',
  '超出预算未写入 {0} 条': '{0} over budget, left out', '最后使用 {0}': 'Last used {0}', '内嵌世界信息 {0} 条': '{0} embedded world entries',
};

/** Translation for the current interface language; re-renders when it changes. */
export function useTr(): { t: (text: string) => string; tf: (text: string, values: unknown[]) => string } {
  const locale = useLocale();
  return {
    t: (text) => locale === 'en' ? EN[text] ?? hostT(text) : text,
    tf: (text, values) => locale === 'en' && FORMATS[text] ? FORMATS[text]!.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? '')) : hostTf(text, values),
  };
}

/** "3 分钟前"-style age. */
export function age(iso: string, locale: 'zh' | 'en', now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return locale === 'en' ? 'just now' : '刚刚';
  if (minutes < 60) return locale === 'en' ? `${minutes} min ago` : `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale === 'en' ? `${hours} h ago` : `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return locale === 'en' ? `${days} d ago` : `${days} 天前`;
}
