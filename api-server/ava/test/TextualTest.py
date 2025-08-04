#
# class_name="_ERPWebApiRunner_hdc01"
# runner = class_name[1:]
# pg = runner[:runner.find("_")]
# print(pg)
import re

#
# date_str = "A  下星期五"
# date_str = re.sub(r"\s+.+$", "", date_str)
# print(date_str+"|")
#
# mapping = [
#     "A 拜訪客戶及備標階段",
#     "B 專案規劃及管理",
#     "C 需求規劃及分析階段",
#     "D 設計及開發階段",
#     "E 試車及整體測試階段",
#     "F 上線運行保駕階段",
#     "G 保固維護階段-需求處理",
#     "H 保固維護階段-問題處理",
#     "I 設備及線路之安裝、維護及保養等",
#     "J 業務需要排班之固定性加班",
#     "K 處理其他臨時指派之緊急任務",
#     "L 緊急搶修"
# ]
# text="問題處理"
# found = next((code for code in mapping if text in code), None)
# code = re.sub(r"\s+.+$", "", found)
# print(code)
#
#
# text="申請成功!!!icsc_20231216_hdjjc01A_I20496_32272710418682"
# ans = re.sub(r"\![\w]+$", "", text)
# print( ans )
#
# output = "xxx {#tab1 tr:nth-of-type(2) td:nth-of-type(4)} yyyy"
# pattern = r"\{(.*?)\}"
# matches = re.findall(pattern, output)
# for m in matches:
#     output = output.replace("{"+m+"}", "經理")
# # Print the matches
# print("---- match ---- ")
# print(output)

sql = "'```sql\nSELECT COUNT(*) FROM DB.TBDU01"
sql = re.sub(r"^['`]*\w+\sSELECT ", "SELECT ", sql)
print(sql)
