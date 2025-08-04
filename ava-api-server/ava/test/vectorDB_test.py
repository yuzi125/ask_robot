from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores.chroma import Chroma

import os

# 初始化向量資料庫實例
persist_directory = "db"

vector_db: Chroma = Chroma(
    # persist_directory=os.path.join("../../db", "973399e0-4555-466f-a50f-b19c82780927"),
    persist_directory=os.path.join("../../db",
                                   "f16dbfe0-6897-4992-8dc4-1b61fbcee4ce"),
    embedding_function=OpenAIEmbeddings(
        model="text-embedding-3-large",
        openai_api_key="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"),
    collection_metadata={"hnsw:space": "cosine"},
    relevance_score_fn=lambda distance: 1.0 - distance / 2,
)

# 定義查詢條件
# filename_to_search = './docs/hd/0af7b4c7-996e-426f-8b81-ecfb2379c809.pdf'
# filename_to_search = 'test.pdf'
# 使用 get 方法檢索文件名對應的向量資料
# documents = vector_db.get()

# 直接搜ID
# documents = vector_db.get('2e93d64c-a45a-11ee-8232-b40ede758770')
"""
{'ids': ['2e93d64c-a45a-11ee-8232-b40ede758770'], 'embeddings': None, 'documents': ['第五章 請 假 \n民國八十九年六月一日訂定  \n民國一一一一一二年九六月二十八二十九日第九十次修訂 \n第一條 名詞定義、請假期限及有關規定：  \n一、 曠職
：未經請假擅離職守。從業人員一個月之內曠職未滿六日者\n按日計扣薪給，累積達六日或無正當理由連續曠職三日者免職。  \n二、 留職停薪：保留職務停止支薪，由總經理核准。  \n三、 留資停薪：保留原資停支薪給，由總經理核准。  \n四、 事假：因事
須親自處理者，得請事假，事假期間不發薪給。事假\n及家庭照顧假全年合計不得超過十五日，逾期以曠職論。  \n五、 家庭照顧假： 因家庭成員預防接種、發生嚴重之疾病或其他重大\n事故須親自照顧 者，得請家庭照顧假，全年以七日為限，假期內\n不發給
薪給。  \n六、 普通傷病假：從業人員因普通傷害、疾病或生理原因必須治療或\n休養者得請普通傷病假，全年普通傷病假合計十五日以內者薪給\n照給；超過十五日而在卅日以內者，薪給減半發給。 普通傷病假\n全年不得超過三十日。  \n七、 生理假：女性
從業人員因生理日致工作有困難者，每月得請生理\n假一日，假期內薪給減半發給。 生理假及第六款普通傷病假全年\n合計不得超過三十三日。  \n八、 特准普通傷病假：全年不扣薪普通傷病假逾十五日，以特別休假\n抵充後仍須續請病假者，得依下列規定申請
特准普通傷病假：  \n1. 因嚴重傷病須開刀住 院或長期療養者，得申請前六個月支全\n薪，後六個月支半薪特准普通傷病假；因非屬嚴重傷病，須住\n院或在家療養者，得申請前六個月支半薪，後六個月不支薪特\n准普通傷病假，或申請一年不支薪特准普通傷病
假。'], 'metadatas': [{'source': './docs/hd/ad36e489-3a52-4c56-a960-891901b46a24.pdf', 'filename': 'ad36e489-3a52-4c56-a960-891901b46a24.pdf', 'originalname': 'LeaveRegulations.pdf'}]}
"""

# print(documents)

# embedding = OpenAIEmbeddings(model="text-embedding-ada-002",openai_api_key='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')
# result_docs = vector_db.similarity_search_with_score("中國打過來怎麼辦",distance_metric="cos")
# print("============================")
# result_docs = retriever.get_relevant_documents("哪些事項可以遊說")
# print(result_docs)
# print("============================")


# retriever = vector_db.as_retriever(search_kwargs={"k": 3,'score_threshold': 0.75}, search_type="similarity_score_threshold")
def retriever_search_and_print_results(query):
    retriever = vector_db.as_retriever(
        search_kwargs={
            "k": 3,
            'score_threshold': 0.73
        },
        search_type="similarity_score_threshold")
    result_docs = retriever.get_relevant_documents(query)

    print(f"query: {query}")
    print(result_docs)
    print("============================")


def perform_search_and_print_results(query):
    search_results = vector_db.similarity_search_with_score(query)
    result_docs = []  # 存儲Document物件的列表
    scores = []  # 存儲分數的列表
    print(search_results)

    for doc, score in search_results:
        result_docs.append(doc)
        scores.append(score)

    print(f"query: {query}")
    print(result_docs)
    print(scores)
    print("============================")


def perform_retriever_search_and_print_results(query):
    retriever = vector_db.as_retriever(
        search_kwargs={
            "k": 3,
            'score_threshold': 0.73
        },
        search_type="similarity_score_threshold")
    result_docs = retriever.get_relevant_documents(query)

    print(f"query: {query}")
    print(result_docs)

    search_results = vector_db.similarity_search_with_score(query)
    result_docs = []  # 存儲Document物件的列表
    scores = []  # 存儲分數的列表

    for doc, score in search_results:
        result_docs.append(doc)
        scores.append(score)
    # print(result_docs)
    print(scores)
    # vector_db._collection.delete(ids=[])
    print("============================")


# 以下是使用這個函數的範例
queries = [
    "如果我收到管委會的警告，但沒有及時清理我放置的物品，會怎樣？", "放籃球在我家門前可以嗎", "中國打過來怎麼辦", "美國打過來怎麼辦",
    "管委會可以自行清除公共區域的物品嗎", "我可以在走廊上放滅火器嗎", "可以在門口放雜物嗎", "可以把鞋子放在走廊上嗎",
    "可以在走廊上睡覺嗎", "高雄市長是誰?", "我家附近有流浪漢，我可以怎麼做?", "遊說是什麼?"
]

# delete_id = vector_db.get()
# print(delete_id)
# for query in queries:
#     perform_search_and_print_results(query)

print("----------------------------------------------------")

# for query in queries:
#     retriever_search_and_print_results(query)

# for query in queries:
#     perform_retriever_search_and_print_results(query)

#

# retriever = vector_db.as_retriever(search_kwargs={"k": 5,'score_threshold': 0.4},search_type="similarity_score_threshold")
# print("============================")
# result_docs = retriever.get_relevant_documents("水瓶該怎麼回收?")
# print(result_docs)
# print("============================")

# 取出question_id
# for document in result_docs:
#     metadata = document.metadata["question_id"]
#     print(metadata)  # 或您可以根據需要進行其他處理
# result = vector_db._collection.delete(ids=['c44283bd-89ce-11ee-b51e-b40ede758770', 'c44283be-89ce-11ee-adce-b40ede758770', 'c44283bf-89ce-11ee-8a66-b40ede758770', 'c44283c0-89ce-11ee-ba1b-b40ede758770', 'c44283c1-89ce-11ee-a957-b40ede758770', 'c44283c2-89ce-11ee-98fc-b40ede758770'])
# print(result)

# results = vector_db.get(ids=['c44283bd-89ce-11ee-b51e-b40ede758770', 'c44283be-89ce-11ee-adce-b40ede758770', 'c44283bf-89ce-11ee-8a66-b40ede758770', 'c44283c0-89ce-11ee-ba1b-b40ede758770', 'c44283c1-89ce-11ee-a957-b40ede758770', 'c44283c2-89ce-11ee-98fc-b40ede758770'])
# print(results)

# 列出所有文件
# doc_id_to_delete = '8dd9a33b-15a1-4d8f-8a04-07f914af6573'
# delete_id = vector_db.get(where = {'documents_id': doc_id_to_delete})['ids']
# delete_id = vector_db.get()
# print(delete_id)
# print("count before", vector_db._collection.count())
# if len(delete_id):
#     vector_db._collection.delete(ids=delete_id)

# print("count after", vector_db._collection.count())
# doc_id_to_delete = '2e93d64c-a45a-11ee-8232-b40ede758770'
# vector_db._collection.delete(ids=[doc_id_to_delete])
vector_db._collection.delete(where={"crawler_synchronize_id": 179})
all_documents = vector_db.get()
print(all_documents)

# ids = vector_db.get()['ids']
# print('REMOVE %s document(s) from %s collection' % (str(len(ids)), vector_db.name))
# if len(ids): vector_db.delete(ids)

# print("count after", vector_db._collection.count())

# # 如果找到文件，則進行刪除
# if documents.get('documents'):
#     # 獲取文件的 ID
#     print(documents)
#     doc_id = documents['ids'][0]
#     print(doc_id)
#     # 使用 delete 方法刪除該文件
#     vector_db._collection.delete(ids=[doc_id])
#
#     # 再次檢查文件是否存在
#     documents_after_delete = vector_db.get(where={"filename": filename_to_search})
#     print(documents_after_delete)  # 如果刪除成功，這應該顯示為空或類似的信息
# else:
#     print("未找到指定文件名的文件。")
