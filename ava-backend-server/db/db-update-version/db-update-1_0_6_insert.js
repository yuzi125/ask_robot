const sqlArr = [
    `INSERT INTO public.settings
    ("key", value)
    VALUES('system_bulletin', '');`,
    `INSERT INTO public.settings
    ("key", value)
    VALUES('system_bulletin_color', '');`,
    `INSERT INTO public.settings
    ("key", value)
    VALUES('system_bulletin_color_back', '');`,
];

module.exports = sqlArr;
