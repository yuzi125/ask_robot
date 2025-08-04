import json

import jwt
import requests

token = "eyJhbGciOiJIUzI1NiJ9.eyJjb21wYW55SWQiOiJpY3NjIiwidXNlcklkIjoiSTIwNDk2IiwiY2hpbmVzZU5hbWUiOiLphKfkuJbpm4QiLCJlbmdsaXNoTmFtZSI6IlRhbmcgIFNhaSAgSG9uZyIsImF1dGhvcml0eUdyb3VwIjpudWxsLCJ1c2VyRGF0YSI6IntcInVzZXJOb1wiOlwiSTIwNDk2XCIsXCJzZXhcIjpcIjFcIixcImJpcnRoZGF5XCI6XCIxOTc0MDcxMFwiLFwiY05hbWVcIjpcIumEp-S4lumbhFwiLFwic3ViQ29tcE5vXCI6XCJcIixcImNvbXBOb1wiOlwiaWNzY1wiLFwiZGVwTm9cIjpcIlMyMlwiLFwiZU1haWxcIjpcInNhaWhvbmdAaWNzYy5jb20udHdcIixcImVOYW1lXCI6XCJUYW5nICBTYWkgIEhvbmdcIixcImlkVHlwZVwiOlwiRVwiLFwiY2l0eVwiOlwiXCIsXCJwb3N0Tm9cIjpcIjIxXCJ9Iiwic3ViIjoiSTIwNDk2IiwiaWF0IjoxNjkzNjQ0NTE2fQ._VYhTWuO31YQ7x44ng_5a5x4xvphLNv1ARdUMCHru_0"

response = requests.post("http://localhost:8081/decode/jwt", json={"t": token})

print(response.status_code)
print(response.json())

user_info = response.json()
userData = user_info["userData"]

user = json.loads(userData)

print( user["birthday"] )
print( user["depNo"] )
print( user["cName"] )
print( user["eMail"] )
