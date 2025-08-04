import re

time = "上午"
# print(int(time))

content = " abc UpdatE  db.tbdu01 set sex=1"
if re.search(r"(update|delete|insert)\s+", content, re.IGNORECASE):
    print( "Found")
else:
    print("not found")

