from prometheus_client import Counter, Gauge, Histogram

# 定義公開模組變數，方便外部引用
__all__ = [
    'SKILL_COMPLATE_COUNTER',
    'KNOWLEDGE_TRIGGER_COUNTER',
    'KNOWLEDGE_RESPONSE_COMPLETE_COUNTER',
    'USER_QUESTION_COUNTER',
    'API_EXECUTION_TIME_HISTOGRAM',
    'KNOWLEDGE_RESPONSE_TIME_HISTOGRAM',
    'API_REQUEST_COUNTER',
    'USER_INFO_PARSE_ERROR_COUNTER',
    'TUNNEL_PROCESS_ERROR_COUNTER',
    'TUNNEL_MAPPING_ERROR_COUNTER',
    'TUNNEL_GENERAL_ERROR_COUNTER',
    'API_ERROR_COUNTER',
    'API_SUCCESS_COUNTER',
    'API_CALL_RATE_HISTOGRAM',
    'ERROR_TYPE_COUNTER',
    'DB_QUERY_TIME_HISTOGRAM',
    'CPU_USAGE_GAUGE',
    'MEMORY_USAGE_GAUGE',
    'ACTIVE_THREADS_GAUGE',
    'CACHE_HIT_COUNTER',
    'TUNNEL_GENERAL_SUCCESS_COUNTER',
    'TUNNEL_TRIGGER_COUNTER',
    'TUNNEL_SKILL_SUCCESS_COUNTER',
    'TUNNEL_SKILL_TRIGGER_COUNTER',
]

# 自定義 Histogram : 追蹤 ava/api 的執行時間
API_EXECUTION_TIME_HISTOGRAM = Histogram('api_execution_time_histogram',
                                         'Execution time for API')

# 自定義 Counter : 追蹤 API 呼叫次數
API_REQUEST_COUNTER = Counter('api_request_counter',
                              'Number of times the API is called')

# 自定義 Counter : 追蹤 API 成功呼叫次數
API_SUCCESS_COUNTER = Counter('api_success_counter',
                              'Number of successful API calls')

# 自定義 Cache 命中次數計數器
CACHE_HIT_COUNTER = Counter('cache_hit_counter',
                            'Number of times the cache was hit')

# 自定義 Counter : 追蹤使用者資訊解析錯誤次數
USER_INFO_PARSE_ERROR_COUNTER = Counter(
    'user_info_parse_error_counter',
    'Number of times user info parsing failed')

# 自定義 Counter : 追蹤隧道模式處理錯誤次數
TUNNEL_PROCESS_ERROR_COUNTER = Counter(
    'tunnel_process_error_counter', 'Number of times tunnel processing failed')

# 自定義 Counter : 追蹤隧道模式映射錯誤次數
TUNNEL_MAPPING_ERROR_COUNTER = Counter(
    'tunnel_mapping_error_counter', 'Number of times tunnel mapping failed')

# 自定義 Counter : 追蹤隧道模式一般錯誤次數
TUNNEL_GENERAL_ERROR_COUNTER = Counter('tunnel_general_error_counter',
                                       'Number of general tunnel errors')

# 自定義 Counter : 追蹤隧道模式一般成功次數
TUNNEL_GENERAL_SUCCESS_COUNTER = Counter('tunnel_general_success_counter',
                                         'Number of general tunnel successes')

# 自定義 Counter : 追蹤隧道模式觸發次數
TUNNEL_TRIGGER_COUNTER = Counter('tunnel_trigger_counter',
                                 'Number of times tunnel mode was triggered')

# 自定義 Counter : 追蹤隧道模式技能成功次數
TUNNEL_SKILL_SUCCESS_COUNTER = Counter(
    'tunnel_skill_success_counter',
    'Number of successful tunnel skill executions')

# 自定義 Counter : 追蹤隧道模式技能觸發次數
TUNNEL_SKILL_TRIGGER_COUNTER = Counter(
    'tunnel_skill_trigger_counter',
    'Number of times tunnel skill mode was triggered')

# 自定義 Counter : 追蹤內部 API 錯誤次數
API_ERROR_COUNTER = Counter('api_error_counter',
                            'Number of internal API errors')

# 自定義 Counter : 追蹤使用者提問次數
USER_QUESTION_COUNTER = Counter('user_question_counter',
                                'Number of times a question was asked')

# 自定義 Counter : 追蹤技能完成次數
SKILL_COMPLATE_COUNTER = Counter('skill_complate_counter',
                                 'Number of times a skill was completed')

# 自定義 Counter : 追蹤知識庫觸發次數
KNOWLEDGE_TRIGGER_COUNTER = Counter(
    'knowledge_trigger_counter',
    'Number of times the knowledge base is triggered')

# 自定義 Counter : 追蹤知識庫回應完成次數
KNOWLEDGE_RESPONSE_COMPLETE_COUNTER = Counter(
    'knowledge_response_complete_counter',
    'Number of times a knowledge response is completed')

# 自定義 Histogram : 追蹤知識庫回應時間
KNOWLEDGE_RESPONSE_TIME_HISTOGRAM = Histogram(
    'knowledge_response_time_histogram', 'Response time for knowledge base')

# 自定義 Histogram : 追蹤每分鐘的 API 呼叫次數
API_CALL_RATE_HISTOGRAM = Histogram('api_call_rate_histogram',
                                    'API call rate per minute')

# 自定義 Counter : 追蹤不同類型錯誤的次數
ERROR_TYPE_COUNTER = Counter('error_type_counter',
                             'Count of different types of errors',
                             ['error_type'])

# 自定義 Histogram : 追蹤資料庫查詢時間
DB_QUERY_TIME_HISTOGRAM = Histogram('db_query_time_histogram',
                                    'Time taken for database queries')

# 自定義 Gauge : 追蹤系統的 CPU 使用率
CPU_USAGE_GAUGE = Gauge('cpu_usage_gauge', 'CPU usage of the system')

# 自定義 Gauge : 追蹤系統的記憶體使用率
MEMORY_USAGE_GAUGE = Gauge('memory_usage_gauge', 'Memory usage of the system')

# 自定義 Gauge : 追蹤活躍的線程數量
ACTIVE_THREADS_GAUGE = Gauge('active_threads_gauge',
                             'Number of active threads')

# 自定義 Histogram : 追蹤知識庫搜尋時間
KNOWLEDGE_SEARCH_DURATION_SECONDS = Histogram(
    'ava_knowledge_search_request_duration_seconds',
    'Total duration of knowledge search request including thread pool overhead',
    ['collection_name', 'expert_id'])

# 自定義 Histogram : 追蹤向量搜尋時間
VECTOR_SEARCH_DURATION_SECONDS = Histogram(
    'ava_vector_search_query_duration_seconds',
    'Duration of vector similarity search query execution in database',
    ['collection_name'])
