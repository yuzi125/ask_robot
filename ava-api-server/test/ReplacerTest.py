import re


def replace_variable(match):
    return db[match]


def process_output(output):
    pattern = r"\{(.*?)\}"
    matches = re.findall(pattern, output)
    # Print the matches
    for match in matches:
        print(match)
        output = re.sub(pattern, replace_variable(match), output)

    print("-------------")
    print(output)


s: str = "- 姓名:  {#chiName_m1}\n- 職稱:  {#deptNo_m0} {#tab1 tr:nth-of-type(2) td:nth-of-type(4)}\n- 電話:  {#telNo1_mh}\n- Email: [{#eMail_m1}](mailto:{#eMail_m1})"

db = {
    "#chiName_m1": "M1",
    "#deptNo_m0": "M0",
    "#tab1 tr:nth-of-type(2) td:nth-of-type(4)": "Tab1",
    "#telNo1_mh": "MH",
    "#eMail_m1": "EMAIL_qqq"
}

# process_output(s)


element_name = "select"
if element_name in ["span", "td"]:
    print(f"element:{element_name} has `span` or `td`")
else:
    print("NG")
