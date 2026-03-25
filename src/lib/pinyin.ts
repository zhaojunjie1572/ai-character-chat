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
};

// 获取汉字的首字母
export function getFirstLetter(str: string): string {
  if (!str) return '#';
  
  const firstChar = str.charAt(0);
  
  // 如果是英文，直接返回大写
  if (/[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase();
  }
  
  // 如果是数字
  if (/[0-9]/.test(firstChar)) {
    return '#';
  }
  
  // 查找拼音
  const pinyin = pinyinMap[firstChar];
  if (pinyin) {
    return pinyin.charAt(0).toUpperCase();
  }
  
  // 默认返回 #
  return '#';
}

// 获取完整拼音（简化版）
export function getPinyin(str: string): string {
  if (!str) return '';
  
  let result = '';
  for (const char of str) {
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
  
  const lowerKeyword = keyword.toLowerCase();
  
  return items.filter(item => {
    const name = getName(item);
    const pinyin = getPinyin(name);
    
    // 匹配原始名称
    if (name.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    
    // 匹配拼音
    if (pinyin.includes(lowerKeyword)) {
      return true;
    }
    
    // 匹配首字母
    const firstLetters = name.split('').map(c => getFirstLetter(c)).join('').toLowerCase();
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
