const sqlArr = [
    `ALTER TABLE public.datasets ALTER COLUMN folder_name TYPE varchar(255) USING folder_name::varchar;`,
    `ALTER TABLE public.skill ALTER COLUMN "class" TYPE varchar(255) USING "class"::varchar;`,
    `ALTER TABLE public.documents ALTER COLUMN filename TYPE varchar(255) USING filename::varchar;`,
    `ALTER TABLE public.datasets ADD icon varchar(1000) NULL;`,
    `ALTER TABLE public.skill ADD icon varchar(1000) NULL;`,
    `ALTER TABLE public.documents ALTER COLUMN originalname TYPE varchar(255) USING originalname::varchar;`,
];

module.exports = sqlArr;
