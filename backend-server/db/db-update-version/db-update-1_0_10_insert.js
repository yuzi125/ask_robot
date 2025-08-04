const sqlArr = [
    `INSERT INTO public.datasource_type
    (id, mark, "name")
    VALUES('A', '手動上傳', 'upload');`,
    `INSERT INTO public.datasource_type
    (id, mark, "name")
    VALUES('B', '爬蟲', 'crawler');`
]

module.exports = sqlArr;
