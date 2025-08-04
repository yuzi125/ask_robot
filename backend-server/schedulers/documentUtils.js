async function checkAndDeleteExpiredDocuments(task, client) {
    const expiredDocsResult = await client.query(`
        SELECT id, datasets_id FROM upload_documents 
        WHERE expiration_time <= NOW() AND is_enable = 1
    `);
    const expiredDocs = expiredDocsResult.rows;

    for (const doc of expiredDocs) {
        const folderNameResult = await client.query("SELECT folder_name FROM datasets WHERE id = $1", [
            doc.datasets_id,
        ]);
        const folderName = folderNameResult.rows[0]?.folder_name;

        if (folderName) {
            await client.query(
                `
                INSERT INTO task_operations (id, cron_task_id, operation, status, params)
                VALUES (gen_random_uuid(), $1, $2, 'pending', $3)
                `,
                [
                    task.id,
                    task.function_name,
                    JSON.stringify({
                        document_id: doc.id,
                        folder_name: folderName,
                    }),
                ]
            );
        }
    }
}

module.exports = { checkAndDeleteExpiredDocuments };
