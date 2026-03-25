// 简单的汉字转拼音映射表（常用汉字）
const pinyinMap: Record<string, string> = {
  '阿': 'a', '艾': 'ai', '安': 'an', '奥': 'ao',
  '巴': 'ba', '白': 'bai', '班': 'ban', '包': 'bao', '贝': 'bei', '本': 'ben', '比': 'bi', '边': 'bian', '表': 'biao', '别': 'bie', '宾': 'bin', '波': 'bo', '布': 'bu',
  '蔡': 'cai', '曹': 'cao', '岑': 'cen', '柴': 'chai', '常': 'chang', '陈': 'chen', '成': 'cheng', '池': 'chi', '迟': 'chi', '楚': 'chu', '褚': 'chu', '崔': 'cui',
  '达': 'da', '戴': 'dai', '丹': 'dan', '邓': 'deng', '迪': 'di', '丁': 'ding', '董': 'dong', '杜': 'du', '段': 'duan',
  '鄂': 'e', '恩': 'en',
  '范': 'fan', '方': 'fang', '冯': 'feng', '符': 'fu', '福': 'fu', '傅': 'fu',
  '甘': 'gan', '高': 'gao', '葛': 'ge', '耿': 'geng', '龚': 'gong', '顾': 'gu', '关': 'guan', '郭': 'guo',
  '哈': 'ha', '海': 'hai', '韩': 'han', '郝': 'hao', '何': 'he', '贺': 'he', '洪': 'hong', '侯': 'hou', '胡': 'hu', '华': 'hua', '黄': 'huang', '霍': 'huo',
  '姬': 'ji', '吉': 'ji', '纪': 'ji', '季': 'ji', '贾': 'jia', '简': 'jian', '江': 'jiang', '姜': 'jiang', '蒋': 'jiang', '金': 'jin', '焦': 'jiao', '靳': 'jin', '景': 'jing', '井': 'jing',
  '康': 'kang', '柯': 'ke', '孔': 'kong', '寇': 'kou', '匡': 'kuang',
  '赖': 'lai', '兰': 'lan', '蓝': 'lan', '郎': 'lang', '劳': 'lao', '乐': 'le', '雷': 'lei', '冷': 'leng', '黎': 'li', '李': 'li', '厉': 'li', '利': 'li', '林': 'lin', '刘': 'liu', '龙': 'long', '卢': 'lu', '鲁': 'lu', '陆': 'lu', '路': 'lu', '罗': 'luo', '吕': 'lv',
  '马': 'ma', '麦': 'mai', '满': 'man', '毛': 'mao', '梅': 'mei', '孟': 'meng', '米': 'mi', '苗': 'miao', '明': 'ming', '莫': 'mo', '墨': 'mo', '穆': 'mu',
  '那': 'na', '南': 'nan', '倪': 'ni', '年': 'nian', '宁': 'ning', '牛': 'niu', '农': 'nong',
  '欧': 'ou', '区': 'ou',
  '潘': 'pan', '庞': 'pang', '裴': 'pei', '彭': 'peng', '皮': 'pi', '朴': 'po', '浦': 'pu',
  '戚': 'qi', '齐': 'qi', '祁': 'qi', '钱': 'qian', '乔': 'qiao', '秦': 'qin', '邱': 'qiu', '秋': 'qiu', '曲': 'qu', '全': 'quan',
  '冉': 'ran', '任': 'ren', '荣': 'rong', '容': 'rong', '阮': 'ruan', '芮': 'rui',
  '撒': 'sa', '萨': 'sa', '桑': 'sang', '沙': 'sha', '山': 'shan', '商': 'shang', '尚': 'shang', '邵': 'shao', '申': 'shen', '沈': 'shen', '盛': 'sheng', '施': 'shi', '石': 'shi', '史': 'shi', '舒': 'shu', '帅': 'shuai', '双': 'shuang', '水': 'shui', '司': 'si', '宋': 'song', '苏': 'su', '孙': 'sun', '索': 'suo',
  '塔': 'ta', '台': 'tai', '太': 'tai', '谈': 'tan', '汤': 'tang', '唐': 'tang', '陶': 'tao', '滕': 'teng', '田': 'tian', '童': 'tong', '涂': 'tu', '屠': 'tu',
  '万': 'wan', '汪': 'wang', '王': 'wang', '韦': 'wei', '卫': 'wei', '魏': 'wei', '温': 'wen', '文': 'wen', '闻': 'wen', '翁': 'weng', '乌': 'wu', '巫': 'wu', '吴': 'wu', '武': 'wu', '伍': 'wu',
  '西': 'xi', '席': 'xi', '夏': 'xia', '鲜': 'xian', '咸': 'xian', '相': 'xiang', '项': 'xiang', '萧': 'xiao', '肖': 'xiao', '谢': 'xie', '辛': 'xin', '邢': 'xing', '熊': 'xiong', '徐': 'xu', '许': 'xu', '宣': 'xuan', '薛': 'xue',
  '牙': 'ya', '严': 'yan', '颜': 'yan', '阎': 'yan', '杨': 'yang', '阳': 'yang', '姚': 'yao', '叶': 'ye', '伊': 'yi', '易': 'yi', '殷': 'yin', '尹': 'yin', '应': 'ying', '尤': 'you', '于': 'yu', '余': 'yu', '俞': 'yu', '虞': 'yu', '宇': 'yu', '羽': 'yu', '郁': 'yu', '喻': 'yu', '元': 'yuan', '袁': 'yuan', '岳': 'yue', '云': 'yun',
  '宰': 'zai', '臧': 'zang', '曾': 'zeng', '查': 'zha', '翟': 'zhai', '詹': 'zhan', '张': 'zhang', '章': 'zhang', '赵': 'zhao', '甄': 'zhen', '郑': 'zheng', '支': 'zhi', '钟': 'zhong', '周': 'zhou', '朱': 'zhu', '诸': 'zhu', '祝': 'zhu', '庄': 'zhuang', '卓': 'zhuo', '宗': 'zong', '邹': 'zou', '祖': 'zu',
  '爱': 'ai', '八': 'ba', '百': 'bai', '半': 'ban', '宝': 'bao', '北': 'bei', '不': 'bu',
  '才': 'cai', '菜': 'cai', '草': 'cao', '茶': 'cha', '长': 'chang', '场': 'chang', '唱': 'chang', '车': 'che', '吃': 'chi', '春': 'chun',
  '大': 'da', '地': 'di', '点': 'dian', '电': 'dian', '东': 'dong', '冬': 'dong',
  '儿': 'er', '二': 'er',
  '发': 'fa', '飞': 'fei', '风': 'feng', '夫': 'fu',
  '个': 'ge', '工': 'gong', '公': 'gong', '古': 'gu', '谷': 'gu', '瓜': 'gua', '关': 'guan', '光': 'guang', '国': 'guo',
  '好': 'hao', '喝': 'he', '和': 'he', '河': 'he', '黑': 'hei', '红': 'hong', '后': 'hou', '花': 'hua', '画': 'hua', '话': 'hua', '欢': 'huan', '回': 'hui', '会': 'hui',
  '家': 'jia', '加': 'jia', '假': 'jia', '间': 'jian', '见': 'jian', '讲': 'jiang', '叫': 'jiao', '姐': 'jie', '今': 'jin', '进': 'jin', '近': 'jin', '就': 'jiu', '九': 'jiu', '久': 'jiu', '酒': 'jiu',
  '开': 'kai', '看': 'kan', '考': 'kao', '可': 'ke', '课': 'ke', '空': 'kong',
  '来': 'lai', '老': 'lao', '乐': 'le', '冷': 'leng', '里': 'li', '理': 'li', '力': 'li', '立': 'li', '丽': 'li', '两': 'liang', '亮': 'liang', '林': 'lin', '灵': 'ling', '六': 'liu', '路': 'lu', '绿': 'lv',
  '妈': 'ma', '马': 'ma', '买': 'mai', '卖': 'mai', '满': 'man', '美': 'mei', '门': 'men', '米': 'mi', '面': 'mian', '民': 'min', '明': 'ming', '命': 'ming', '木': 'mu',
  '那': 'na', '男': 'nan', '南': 'nan', '你': 'ni', '年': 'nian', '鸟': 'niao', '牛': 'niu',
  '女': 'nv',
  '排': 'pai', '朋': 'peng', '皮': 'pi', '平': 'ping',
  '七': 'qi', '期': 'qi', '气': 'qi', '起': 'qi', '千': 'qian', '前': 'qian', '强': 'qiang', '桥': 'qiao', '青': 'qing', '清': 'qing', '情': 'qing', '请': 'qing', '秋': 'qiu', '球': 'qiu', '去': 'qu', '全': 'quan',
  '人': 'ren', '日': 'ri',
  '三': 'san', '山': 'shan', '上': 'shang', '少': 'shao', '社': 'she', '深': 'shen', '生': 'sheng', '声': 'sheng', '十': 'shi', '时': 'shi', '实': 'shi', '食': 'shi', '史': 'shi', '世': 'shi', '事': 'shi', '是': 'shi', '市': 'shi', '室': 'shi', '书': 'shu', '水': 'shui', '说': 'shuo', '思': 'si', '四': 'si', '送': 'song', '苏': 'su',
  '他': 'ta', '她': 'ta', '它': 'ta', '台': 'tai', '太': 'tai', '天': 'tian', '田': 'tian', '听': 'ting', '同': 'tong', '头': 'tou', '图': 'tu',
  '外': 'wai', '完': 'wan', '玩': 'wan', '晚': 'wan', '万': 'wan', '王': 'wang', '网': 'wang', '往': 'wang', '望': 'wang', '微': 'wei', '为': 'wei', '位': 'wei', '文': 'wen', '我': 'wo', '五': 'wu',
  '西': 'xi', '希': 'xi', '息': 'xi', '习': 'xi', '下': 'xia', '夏': 'xia', '先': 'xian', '现': 'xian', '线': 'xian', '相': 'xiang', '香': 'xiang', '想': 'xiang', '向': 'xiang', '小': 'xiao', '校': 'xiao', '笑': 'xiao', '些': 'xie', '写': 'xie', '谢': 'xie', '心': 'xin', '新': 'xin', '信': 'xin', '星': 'xing', '行': 'xing', '醒': 'xing', '姓': 'xing', '修': 'xiu', '学': 'xue', '雪': 'xue',
  '牙': 'ya', '呀': 'ya', '烟': 'yan', '言': 'yan', '眼': 'yan', '阳': 'yang', '羊': 'yang', '样': 'yang', '药': 'yao', '要': 'yao', '也': 'ye', '业': 'ye', '夜': 'ye', '一': 'yi', '衣': 'yi', '医': 'yi', '已': 'yi', '以': 'yi', '艺': 'yi', '易': 'yi', '意': 'yi', '义': 'yi', '因': 'yin', '音': 'yin', '银': 'yin', '引': 'yin', '印': 'yin', '应': 'ying', '英': 'ying', '影': 'ying', '硬': 'ying', '用': 'yong', '友': 'you', '有': 'you', '又': 'you', '右': 'you', '于': 'yu', '鱼': 'yu', '娱': 'yu', '雨': 'yu', '语': 'yu', '玉': 'yu', '育': 'yu', '元': 'yuan', '员': 'yuan', '原': 'yuan', '远': 'yuan', '院': 'yuan', '愿': 'yuan', '月': 'yue', '越': 'yue', '云': 'yun', '运': 'yun',
  '再': 'zai', '在': 'zai', '早': 'zao', '怎': 'zen', '张': 'zhang', '长': 'zhang', '找': 'zhao', '照': 'zhao', '者': 'zhe', '这': 'zhe', '真': 'zhen', '正': 'zheng', '政': 'zheng', '之': 'zhi', '知': 'zhi', '直': 'zhi', '值': 'zhi', '职': 'zhi', '止': 'zhi', '只': 'zhi', '纸': 'zhi', '至': 'zhi', '治': 'zhi', '中': 'zhong', '终': 'zhong', '种': 'zhong', '重': 'zhong', '周': 'zhou', '州': 'zhou', '珠': 'zhu', '主': 'zhu', '住': 'zhu', '助': 'zhu', '祝': 'zhu', '注': 'zhu', '专': 'zhuan', '转': 'zhuan', '赚': 'zhuan', '准': 'zhun', '桌': 'zhuo', '资': 'zi', '子': 'zi', '自': 'zi', '字': 'zi', '总': 'zong', '走': 'zou', '租': 'zu', '最': 'zui', '左': 'zuo', '作': 'zuo', '坐': 'zuo', '座': 'zuo',
};

// 辅助函数：获取单个字符的拼音首字母（用于内部使用）
function getCharFirstLetter(char: string): string {
  if (!char) return '';
  
  if (/[a-zA-Z]/.test(char)) {
    return char.toUpperCase();
  }
  
  const pinyin = pinyinMap[char];
  if (pinyin) {
    return pinyin.charAt(0).toUpperCase();
  }
  
  return '';
}

// 获取汉字的首字母
export function getFirstLetter(str: string): string {
  if (!str) return '#';
  
  const trimmed = str.trim();
  if (!trimmed) return '#';
  
  const firstChar = trimmed.charAt(0);
  
  if (/[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }
  
  if (/[0-9]/.test(firstChar)) {
    return '#';
  }
  
  const pinyin = pinyinMap[firstChar];
  if (pinyin) {
    return pinyin.charAt(0).toUpperCase();
  }
  
  return '#';
}

// 获取完整拼音（简化版）
export function getPinyin(str: string): string {
  if (!str) return '';
  
  const trimmed = str.trim();
  if (!trimmed) return '';
  
  let result = '';
  for (const char of trimmed) {
    if (/[a-zA-Z]/.test(char)) {
      result += char.toLowerCase();
    } else if (/[0-9]/.test(char)) {
      result += char;
    } else {
      const pinyin = pinyinMap[char];
      if (pinyin) {
        result += pinyin;
      }
    }
  }
  return result;
}

// 按拼音排序
export function sortByPinyin<T>(items: T[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const nameA = getName(a);
    const nameB = getName(b);
    const pinyinA = getPinyin(nameA);
    const pinyinB = getPinyin(nameB);
    return pinyinA.localeCompare(pinyinB);
  });
}

// 按首字母分组
export function groupByFirstLetter<T>(items: T[], getName: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  
  items.forEach(item => {
    const letter = getFirstLetter(getName(item));
    if (!groups[letter]) {
      groups[letter] = [];
    }
    groups[letter].push(item);
  });
  
  return groups;
}

// 搜索匹配
export function searchByPinyin<T>(
  items: T[],
  getName: (item: T) => string,
  keyword: string
): T[] {
  if (!keyword) return items;
  
  const lowerKeyword = keyword.toLowerCase().trim();
  if (!lowerKeyword) return items;
  
  return items.filter(item => {
    const name = getName(item);
    const trimmedName = name.trim();
    const pinyin = getPinyin(trimmedName);
    
    if (trimmedName.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    
    if (pinyin.includes(lowerKeyword)) {
      return true;
    }
    
    const firstLetters = trimmedName.split('').map(c => getCharFirstLetter(c)).join('').toLowerCase();
    if (firstLetters.includes(lowerKeyword)) {
      return true;
    }
    
    return false;
  });
}

// 获取所有字母索引
export function getAlphabetIndex(): string[] {
  return ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
}
