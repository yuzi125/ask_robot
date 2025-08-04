import requests


def post_data():
    url = 'https://testicsc3.icsc.com.tw/erp/ue/jsp/uejjwfchart.jsp?ticket=ST-1-5BFAD60790564592A40EE7AC06932D61-sso'
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJTVC1GNTNCQTJFMjdFRDk0MzE4QTY2NEQ3RDhBQUI3QjcxNyIsImlhdCI6MTY5MzQ3NjQxNH0.Csl-rG29C07QQVaI6M9-cV78Ivuvb84raGvKJZ9Myns"
    session = "db6ccf49-bc29-4d20-9f0f-30e882d06709"
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive',
        'Cookie': f"JWT-TOKEN={jwt};SESSION={session}"
        # 'X-Requested-With': 'XMLHttpRequest',
    }
    post_data = {
        'type': 'ROOM',
        'itemID': '18F-0002',  # 18F-0002
        'alreadFillDesc': 'ok',
        'doAction': 'ok',
        'itemName': '',  # 會議室
        'itemGroupID': 'icsc',
        'descColumn1': 'Meeting',
        'descColumn2': '',
        'descColumn3': '35617',
        'date': '1120830',
        'reserveFrom': '0800',
        'reserveTo': '1200',
        'fromTime': '0800',
        'toTime': '1200',
        'chairman': 'I20496',
        'meetingSubject': '開會'
    }
    # print(f'request:{post_data}')
    response = requests.post(url, data=post_data, headers=headers, allow_redirects=False)
    if response.status_code == 302:
        redirect_url = response.headers['Location']
        print('(1) redirect_url:', redirect_url)
        response = requests.get(redirect_url, headers=headers)
        print(response)
        if response.status_code == 302:
            redirect_url = response.headers['Location']
            print('(2) redirect_url:', redirect_url)
            response = requests.get(redirect_url, headers=headers, allow_redirects=False)
            print("Redirected Response Body:")
            print(response.text)
        else:
            print("Redirected Response Body:")
            print(response.text)
    else:
        print(" ---------- ")
        print(response.text)

    print(f'response.status_code:{response.status_code}')
    print(f'response.text:{response.text}')


post_data()
