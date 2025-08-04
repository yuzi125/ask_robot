from tabulate import tabulate
import logging
from datetime import datetime
from urllib.error import HTTPError
import requests, os
import ava.utils.TimeSemanticExpressor as tse
import ava.tools.TransportDataAuth as auth
import shutil
import json

# import urllib3
from dotenv import load_dotenv

from ..utils import utils, env_utils
logger = logging.getLogger(__name__)

load_dotenv()
# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

station_data = {
    '南港': '0990',
    '台北': '1000',
    '板橋': '1010',
    '桃園': '1020',
    '新竹': '1030',
    '苗栗': '1035',
    '台中': '1040',
    '彰化': '1043',
    '雲林': '1047',
    '嘉義': '1050',
    '台南': '1060',
    '左營': '1070',
    '高雄': '1070'
}


def get_station_code(station_name):
    code = station_data[station_name]
    if code is None:
        raise ValueError(f"station name:{station_name} not exists.")

    return code


def refresh_token():
    logging.info("[THSR] refresh_token...")
    new_token = auth.refresh_token()
    env_utils.set_tdx_access_token(new_token)
    logging.info("[THSR] refresh_token finished !")
    return new_token


def get_trains(url, start_station, end_station, arrival_before_str, counter=0):
    # Download the timetable data
    access_token = env_utils.get_tdx_access_token()
    # print(f"access:{access_token}")
    headers = {
        'Content-Encoding': 'br,gzip',
        'authorization': f'Bearer {access_token}',
    }
    response = requests.get(url, headers=headers, verify=False)
    if response.status_code == 401:
        refresh_token()
        counter = counter + 1
        if counter > 5:
            raise ValueError("Error occurred in refreshing THSR token.")
        return get_trains(url, start_station, end_station, arrival_before_str, counter)

    if response.status_code != 200:
        logger.error(response)  # Print the response body
        logger.error(f"response.text{response.text}")
        data = json.loads(response.text)
        message = data.get("Message")

        raise HTTPError(code=response.status_code, msg=message, hdrs={}, fp=None,
                        url="https://tdx.transportdata.tw")

    timetable = response.json()

    # Convert the arrival before time to a datetime object
    arrival_before = datetime.strptime(arrival_before_str, "%H:%M")

    # Initialize an empty list to store the valid trains
    valid_trains = []

    # Loop over the data
    for train in timetable:
        # Check if the train starts at the start station and ends at the end station
        if (train['DailyTrainInfo']['StartingStationID'] == start_station
                and train['DestinationStopTime']['StationID'] == end_station):
            # Convert the arrival time to a datetime object
            arrival_time = datetime.strptime(train['DestinationStopTime']['ArrivalTime'], "%H:%M")
            # Check if the train arrives before the specified time
            if arrival_time <= arrival_before:
                valid_trains.append(train)

    # Sort the trains by how close their arrival time is to the specified time
    valid_trains_sorted = sorted(valid_trains, key=lambda x: abs(
        arrival_before - datetime.strptime(x['DestinationStopTime']['ArrivalTime'], "%H:%M")))

    # Get the first 3 trains
    first_3_trains = valid_trains_sorted[:3]

    # Extract the relevant information
    output = []
    for train in first_3_trains:
        output.append({
            'TrainNo': train['DailyTrainInfo']['TrainNo'],
            'DepartureTime': train['OriginStopTime']['DepartureTime'],
            'ArrivalTime': train['DestinationStopTime']['ArrivalTime']
        })

    return output


def get_suitable_train(date, start_station_name, end_station_name, arrival_before):
    logger.info(f"get_suitable_train => date:{date}, arrival_before:{arrival_before}")
    start_station = get_station_code(start_station_name)
    end_station = get_station_code(end_station_name)

    # return f"get_suitable_train => date:{date}, arrival_before:{arrival_before}"

    url = f"https://tdx.transportdata.tw/api/basic/v2/Rail/THSR/DailyTimetable/OD/{start_station}/to/{end_station}/{date}?%24top=30" \
          "&%24format=JSON"

    logger.info(f"url:{url}")

    trains = get_trains(url, start_station, end_station, arrival_before)
    rtn = []

    for train in trains:
        elapsed = tse.compute_elasped_time(train['DepartureTime'], train['ArrivalTime'])
        info = f" - 車次:{train['TrainNo']} {train['DepartureTime']} => {train['ArrivalTime']} ({elapsed})"
        rtn.append([train['TrainNo'], train['DepartureTime'], train['ArrivalTime'], elapsed])
        logger.info(info)

    headers = ["車次", "出發", "抵達", "歷時"]
    alignments = ["left", "left", "left", "left"]
    markdown_table = tabulate(rtn, headers, tablefmt="pipe", colalign=alignments)

    return "### 高鐵 " + date + "(" + tse.date_to_weekday(
        date) + ") " + start_station_name + " => " + end_station_name + "\n\n\n\n" + markdown_table

# get_suitable_train('2023-07-22', '左營', '台北', '10:00')
