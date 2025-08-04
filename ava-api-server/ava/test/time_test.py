import time

current_time_milliseconds = int(time.time() * 1000)
print(current_time_milliseconds)
# time.sleep(0.001)
#
# current_time_milliseconds = int(time.time() * 1000)
# print(current_time_milliseconds)
# time.sleep(0.001)
#
# current_time_milliseconds = int(time.time() * 1000)
# print(current_time_milliseconds)


from datetime import datetime

current_date = datetime.now().strftime('%Y%m%d')

print(current_date)
