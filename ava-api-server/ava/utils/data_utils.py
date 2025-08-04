from ava.exceptions.AvaError import InputError


def has_value(data: str):
    if not data or len(data.strip()) == 0:
        return False
    return True


def is_empty(data: str):
    if not data or len(data.strip()) == 0:
        return True
    return False


def assert_not_empty(data, message):
    if not has_value(data):
        raise AssertionError(message)


def assert_not_equal(data1, data2, message):
    if data1 == data2:
        raise AssertionError(message)


def is_integer(s):
    return s.lstrip('-').isdigit()


def convert_csv_to_arrays(csv_data):
    lines = [line.strip() for line in csv_data.split('\n') if line.strip()]

    rows = []
    # Iterate over each line and split the values
    for line in lines:
        # Splitting the line by comma and removing quotes and extra commas
        columns = line.replace('"', '').split(',')
        row = []
        for column in columns:
            if not column or "Query" in column:
                continue
            if is_integer(column):
                row.append(int(column))
            else:
                row.append(column)
        if len(row) > 0:
            rows.append(row)
    return rows
