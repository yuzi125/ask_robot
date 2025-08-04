const sql = require("./db/pgsql");
const { v4: uuidv4 } = require("uuid");

async function test() {
    // console.log(parseInt(Math.random() * 300));
    // async function delay(ms) {
    //     return new Promise((resolve) => {
    //         setTimeout(resolve, ms);
    //     });
    // }
    // await delay(1000);
    // console.log(1);
    // await delay(1000);
    // console.log(2);
    // await sql.query('insert into "UserMessages"(room_id) values($1)', ["p001"]);
    // let a = await sql.query('select * from "UserMessages"');
    // console.log(a.rows);
    // console.log(uuidv4());
    // let uid = "316747e9-2f89-4be1-a954-f590a72c10f2";
    // let sqlstr =
    //     "select u.*,ur.room_id from users u left join user_rooms ur on u.uid=ur.initiator_uid and $1 = ur.receiver_uid \
    //                 or $2=ur.initiator_uid and u.uid = ur.receiver_uid where u.uid != $3";
    // let sqlparam = [uid, uid, uid];
    // let users = (await sql.query(sqlstr, sqlparam)).rows;
    // console.log(users);
    // let rs = await sql.query(
    //     "insert into user_messages(room_id,from_uid,to_uid,message,message_type) values($1,$2,$3,$4,$5) returning create_time",
    //     [
    //         "c016b190-d9f2-4a95-ae7f-14881aee007a",
    //         "316747e9-2f89-4be1-a954-f590a72c10f2",
    //         "3b78c6be-3769-43a7-be1a-f01e9f79a80c",
    //         "hello",
    //         "text",
    //     ]
    // );
    // console.log(rs.rows[0].create_time);
}
test();
