from ava.handlers.CSCInquirerExtensionNum import CSCInquirerExtensionNum
from ava.handlers.CSCInquirerTelNoByName import CSCInquirerTelNoByName
from ava.handlers.DataInquirer import DataInquirer
from ava.handlers.ICSC_hdjjb01A import ICSC_hdjjb01A
from ava.handlers.ICSC_hdjjc05A import ICSC_hdjjc05A
from ava.handlers.Knowledge import *
from ava.handlers.ResourceBooker import ResourceBooker
from ava.handlers.ResourceInquirer import ResourceInquirer
from ava.handlers.ThsrTimetableInquirer import ThsrTimetableInquirer
from ava.handlers.WishMaker import WishMaker

classification_prompt = f'''
Please answer questions about the attributes of user input, with the following response options:

Asking a question: Q
Explaining a plan: P
Making a request: E

Examples:
1. How long does it take to apply for compensatory leave after overtime? => Q
2. Planning to apply for overtime from 5:30 to 7:00, getting ready to switch online. => P
3. Applying for overtime from 5:30 to 7:30 yesterday. => E

Finally, You will output the code for the guessed intent from the above options, in the following format: 

Category: {{number}}


Here are some examples. 

User Input: 下個月就要結婚了，請問婚假怎麼請 ? 
Category: 0

User Input: 陪太去產檢可以請假嗎? 
Category: 0

User Input: 外祖父去糺可以請幾天喪假? 
Category: 0

User Input: 合約金額超過 300 萬元以上有甚麼要注意? 
Category: 1

User Input: 集團外承攬合約有甚麼要注意 ? 
Category: 1

User Input: 有哪些合約種類 ?
Category: 1

User Input: 住宿費怎麼報 ?
Category: 2

User Input: 出差申請程序如何 ?
Category: 2

User Input: 出差後怎麼報支 ?
Category: 2

User Input: 出差後沒有報支會怎樣 ?
Category: 2
 
User Input: 經理出差台北的住宿補助額度有多少 ?
Category: 2

User Input: 預約明天8點到9點的1802會議室.
Category: 3

User Input: 預約下週一的下午的公務車.
Category: 3

User Input: 我想請6/23到6/25的休假辦理私務
Category: 4

User Input: 因為臨時有事，需要請今天下午1點到5點的事假
Category: 4

User Input: 下週一家裡要修水電，請休假一天
Category: 4

User Input: 下週四要請假一天
Category: 4

User Input: S部門各單位分別有多少人
Category: 5

User Input: S部門女生最多是哪個單位
Category: 5

User Input: S部門有幾位經理
Category: 5

User Input: 莊雅閔電話幾號?
Category: 6

User Input: 莊雅閔的聯絡資訊?
Category: 6
 
User Input: 18樓還有哪些會議室 ?
Category: 9

User Input: 今天還有哪些會議室 ?
Category: 9

User Input: 我想借一間18樓的會議室
Category: 9

User Input: 35617
Category: 10

User Input: 5250
Category: 10

User Input: 新華冶金
Category: 11

User Input: 中龍電商
Category: 11

User Input: 預計5點到6點加班1小時，準備系統整體測試工作
Category: 12

User Input: 為了中保切換上線保駕，下週六下午1點到5點預計加班3小時
Category: 12
 


User Input: $PROMPT
'''
