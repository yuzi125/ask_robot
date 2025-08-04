import re

user_contents="從 Log 來看，我覺得程式沒問題，應該是你們亂操作，下次請注意看說明文件。"
print( len(user_contents) )

user_contents="7月30號9點前到台北的高鐵有哪些班次?"
print( len(user_contents) )

day_fmt = "7/26(四)"
day_fmt = re.sub(r"\(.+\)", "", day_fmt)
print( day_fmt )

key = "MAS_COOKIES"
print(  key.replace("_COOKIES", "") )
