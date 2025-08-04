import logging
import re

from bs4 import BeautifulSoup

logger = logging.getLogger("ava_app")


def get_element_value(element):
    if element.name.startswith("select"):
        selected_option = element.find('option', selected=True)
        if selected_option:
            return selected_option['value']
        return ""
    elif element.name.startswith("input"):
        return element["value"]
    elif element.name == "textarea":
        return element.text
    elif element.name in ["td", "span", "div"]:
        logger.debug(f"element.name: {element.name}, {element}")
        return element.get_text(strip=True)
    elif element.name in ["table"]:
        return str(element)


def replace_variable(soup: BeautifulSoup, match):
    element = soup.select_one(match)
    assert element, f"element: {match} not exists."
    return get_element_value(element)


def process_msg_elements(msg_ele):
    if msg_ele.find("pre"):
        msg_ele.pre.decompose()
    return msg_ele


def get_message(soup: BeautifulSoup, message_selector):
    message_element = soup.select_one(message_selector)
    if not message_element:
        msg = f"訊息欄位[{message_selector}]不存在，請洽管理員. \n"
        logger.error(msg + soup.text)
        raise ValueError(msg)
    msg_ele = process_msg_elements(message_element)
    return msg_ele.text


def process_output(soup: BeautifulSoup, outputs):
    pattern = r"\{(.*?)\}"
    output = "\n ".join(outputs)
    matches = re.findall(pattern, output)
    for match in matches:
        output = output.replace("{" + match + "}", replace_variable(soup, match))
    return output


def process_md_table_output(outputs, data_list):
    assert len(outputs) == 3, "only 3 rows are accepted in this output template"
    pattern = r"\{(.*?)\}"
    template = outputs.pop()
    for index, item in enumerate(data_list):
        matches = re.findall(pattern, outputs)
        record = template
        for match in matches:
            record = record.replace("{" + match + "}", item[match])
        outputs.append(record)
    return "\n ".join(outputs)


def process_md_form_output(outputs, data_form):
    pattern = r"\{(.*?)\}"
    output = "\n ".join(outputs)
    matches = re.findall(pattern, output)
    for match in matches:
        output = output.replace("{" + match + "}", data_form[match])
    return output


def parse_saved_data(soup, saved_data: list) -> dict:
    if not saved_data:
        return {}
    data: dict = {}
    for value_kept in saved_data:
        values = value_kept.split('=')
        assert len(values) == 2, f"{value_kept} must have `=`"
        element = soup.select_one(values[1].strip())
        assert element, "element in saved data [" + values[1] + "] not exists"
        data[values[0].strip()] = get_element_value(element)

    return data
