from datetime import datetime, timedelta

def convert_to_time(datetime_data):
    # Convert the given datetime_data to a string
    datetime_str = str(datetime_data)

    return datetime_str[-4:-2]+":"+datetime_str[-2:]

# Test the function with the provided datetime_data
datetime_data = "11207221430"
time_data = convert_to_time(datetime_data)
# print(time_data)  # Output: 14:00


str="1300"

format  = str[:2]+":"+str[2:]

print( format )
