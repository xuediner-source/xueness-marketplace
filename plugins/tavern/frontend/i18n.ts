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
  // Tavern 2.1: editing, gallery, exports, bindings
  '更换图片': 'Change picture', '上传图片': 'Upload picture', '移除图片': 'Remove picture', '这张图片读不出来，换一张试试。': "That picture can't be read; try another.", '取消': 'Cancel',
  '还含其中任一': 'also has any of', '还含全部': 'also has all of', '都不含': 'has none of', '不全含': 'lacks some of',
  '没有内容': 'no content', '不是常驻条目，却没有关键词': 'not constant and has no keys', '搜索标题、关键词或内容': 'Search titles, keys or content', '搜索条目': 'Search entries',
  '全部启用': 'Turn all on', '全部停用': 'Turn all off', '添加条目': 'Add entry', '未命名条目': 'Untitled entry', '没有关键词': 'no keys',
  '还没有条目。一条只写一个人物、地点或规则：关键词出现在最近的对话里时，内容才写进请求。': 'No entries yet. Write one person, place or rule per entry: its content is sent when one of its keys appears in recent messages.',
  '没有符合搜索的条目。': 'No entries match.', '复制条目': 'Duplicate entry', '删除条目': 'Delete entry', '标题': 'Title', '只给你看，例如「林晓君」「学生会」': 'For you only, such as "Lin" or "Student council"',
  '激活方式': 'Activation', '关键词触发': 'By keys', '关键词出现在最近的对话里时写入': 'Sent when a key appears in recent messages', '每轮都写入，不看关键词': 'Sent every turn, keys or not',
  '回车或逗号添加；/正则/ 也可以': 'Enter or comma to add; /regex/ works too', '可选：进一步限定': 'Optional: narrows the match', '次要关键词的要求': 'Secondary keys rule',
  '内容': 'Content', '满足条件时写进请求的设定文字。支持 {{char}} 和 {{user}}。': 'The text sent when the entry fires. {{char}} and {{user}} work here.',
  '角色定义之前': 'Before the character', '角色定义之后': 'After the character', '顺序（大的更靠后，超预算时先保留）': 'Order (higher goes later and is kept first when over budget)', '大的靠后': 'higher is later',
  '触发概率 %': 'Chance %', '跟随预设': 'Preset default', '区分': 'Yes', '不区分': 'No', '是': 'Yes', '否': 'No',
  '不参与递归': 'No recursion', '这条内容里的词不会再触发别的条目': "Words in this entry don't trigger other entries",
  '名称不能为空': 'Name is required', '世界书名称': 'World book name', '创建': 'Create', '新建世界书': 'New world book', '搜索世界书': 'Search world books',
  '这本世界书还有没保存的修改。': 'This world book has unsaved changes.', '继续编辑': 'Keep editing', '导出为 SillyTavern 世界书 JSON': 'Export as a SillyTavern world-info JSON',
  '导出': 'Export', '删除世界书': 'Delete world book', '确认删除': 'Delete', '说明': 'Description', '可选：这本书写的是什么': 'Optional: what this book covers', '保存前要处理': 'Fix before saving',
  '描述、性格和开场白至少写一项': 'Write a description, personality or greeting', '内嵌世界书': 'Embedded world book', '编辑角色': 'Edit character', '新建角色': 'New character',
  '未保存': 'Unsaved', '关闭编辑': 'Close editor', '还有没保存的修改。': 'You have unsaved changes.', '基本信息': 'Basics', '必填，即 {{char}}': 'Required; this is {{char}}',
  '作者': 'Creator', '标签': 'Tags', '回车或逗号添加，例如「校园」「纯爱」': 'Enter or comma to add, such as "school" or "romance"', '写给玩家看，不发给模型': 'For players; never sent to the model',
  '外貌、身份、经历、说话方式；每轮都发给模型': 'Looks, background, history, voice; sent every turn', '可选：一段性格摘要': 'Optional: a personality summary', '可选：故事发生的时间、地点和处境': 'Optional: when and where the story happens',
  '第一条是默认开场；其余作为备选，开始对话时可以挑': 'The first is the default; pick an alternate when starting a chat', '默认开场白': 'Default greeting', '删除开场白': 'Delete greeting',
  '先交代场景，再让角色说一句话或给出线索，留一个能接住的话头。"引号"是对白，*星号*是动作。': 'Set the scene, let the character say something or drop a hint, and leave an opening to answer. "Quotes" are speech, *asterisks* are actions.',
  '添加备选开场白': 'Add alternate greeting', '用 <START> 分段，每行以 {{char}}: 或 {{user}}: 开头；教模型怎么说话': 'Separate blocks with <START>; start lines with {{char}}: or {{user}}:. Shows the model how to talk.',
  '高级：卡片自带的指令': "Advanced: the card's own instructions", '预设允许时替换主提示；写 {{original}} 可保留原主提示': "Replaces the main prompt when the preset allows; {{original}} keeps the preset's",
  '放在最新一条消息之后；预设允许时替换预设的后置指令': "Placed after the latest message; replaces the preset's when it allows",
  '随角色卡一起导出；预设里打开「使用角色卡内嵌世界书」时生效。': 'Exported with the card; used when the preset has "Use the card\'s embedded book" on.', '创建角色': 'Create character',
  '最近游玩': 'Recently played', '最近编辑': 'Recently edited', '导入时间': 'Recently imported',
  '导入 SillyTavern 兼容的角色卡（JSON 或 PNG），或者自己写一张。PNG 里的设定在浏览器中读取，只上传设定和一张小头像。': 'Import a SillyTavern-compatible card (JSON or PNG), or write your own. A PNG is read in the browser; only its definition and a small picture are uploaded.',
  '搜索名字、作者、标签或描述': 'Search names, creators, tags or descriptions', '按标签筛选': 'Filter by tag', '全部标签': 'All tags', '排序': 'Sort', '显示方式': 'View',
  '卡片': 'Cards', '列表': 'List', '没有符合条件的角色。': 'No characters match.', '取消收藏': 'Unfavorite', '收藏': 'Favorite', '已收藏': 'Favorited', '还没开始': 'Not played yet',
  '继续上次': 'Continue', '编辑': 'Edit', 'PNG 角色卡': 'PNG card', 'SillyTavern 等可直接导入': 'Imports straight into SillyTavern and others', 'JSON 角色卡': 'JSON card',
  '删除角色': 'Delete character', '上一个开场白': 'Previous greeting', '下一个开场白': 'Next greeting', '绑定此角色': 'bound to this character', '角色库': 'Library',
  '存档设置': 'Playthrough settings', '删除存档': 'Delete playthrough', '存档名': 'Name',
  '改动从这个对话的下一轮开始生效；已经写下的消息不变。删除存档只是让酒馆忘掉它，对话本身还在。': "Changes apply from the chat's next turn; past messages stay as they are. Deleting a playthrough only makes the Tavern forget it; the chat itself stays.",
  '各段占比': 'Share of each part', '新建人设': 'New persona', '默认': 'Default', '即 {{user}}': 'This is {{user}}', '设为默认': 'Make default', '取消默认': 'Remove default',
  '删除人设': 'Delete persona', '头像': 'Picture', '你在故事里是谁：年龄、外貌、身份、和角色的关系。会写进每轮请求。': 'Who you are in the story: age, looks, role, how you know the character. Sent with every request.',
  '绑定角色': 'Bound characters', '和这些角色开始对话时默认用这个人设': 'Chats with these characters start with this persona', '在左侧选择一个人设。': 'Choose a persona on the left.',
  '拖动或用箭头调整；越靠前越早发给模型。取消勾选的段落不发送。': 'Drag or use the arrows; earlier sections are sent first. Unchecked sections are not sent.', '删除预设': 'Delete preset',
};
const FORMATS: Record<string, string> = {
  '开场白 {0}/{1}': 'Greeting {0}/{1}', '{0} 个存档': '{0} playthroughs', '{0} 条，常驻 {1} 条': '{0} entries, {1} constant',
  '已导入 {0} 张角色卡': 'Imported {0} cards', '已导入 {0} 本世界书': 'Imported {0} world books', '已导入 {0} 个预设': 'Imported {0} presets',
  '未导入：{0}': 'Not imported: {0}', '已开始与 {0} 的对话。': 'Started a chat with {0}.', '系统提示 {0} 字': 'System prompt: {0} characters',
  '超出预算未写入 {0} 条': '{0} over budget, left out', '最后使用 {0}': 'Last used {0}', '内嵌世界信息 {0} 条': '{0} embedded world entries',
  '{0} 字 · 约 {1} tokens': '{0} characters · about {1} tokens', '{0} 条 · 常驻 {1} · 停用 {2}': '{0} entries · {1} constant · {2} off', '还有 {0} 处': '{0} more',
  '已创建角色 {0}': 'Created {0}', '编辑 {0}': 'Edit {0}', '备选 {0}': 'Alternate {0}', '内嵌世界书 · {0} 条': 'Embedded world book · {0} entries',
  '{0}玩过': 'Played {0}', '作者 {0}': 'By {0}', '设定约 {0} tokens': 'Definition about {0} tokens', '存档 · {0}': 'Playthroughs · {0}',
  '设定 · 约 {0} tokens': 'Definition · about {0} tokens', '世界书 {0} 本': '{0} world books', '系统提示 {0} 字 · 约 {1} tokens': 'System prompt: {0} characters, about {1} tokens',
  '{0} 字': '{0} chars', '激活的世界书条目 · {0}': 'Activated world entries · {0}', '绑定 {0} 个角色': 'Bound to {0} characters', '现在绑定的是 {0}': 'Now bound to {0}',
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
