-- 更新 update_time 欄位的觸發器函數
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為所有包含 update_time 欄位的表建立觸發器的函數
CREATE OR REPLACE FUNCTION create_trigger_on_tables()
RETURNS VOID AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'update_time' AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_table_trigger ON %I', rec.table_name);
        EXECUTE format('CREATE TRIGGER update_table_trigger
                        BEFORE UPDATE ON %I
                        FOR EACH ROW
                        EXECUTE FUNCTION update_timestamp()', rec.table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 執行函數以建立觸發器
SELECT create_trigger_on_tables();