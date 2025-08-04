graph TB
    %% 用戶層
    User[👤 用戶] --> FrontClient[🖥️ Front-Client<br/>Vue 3 + Tailwind<br/>主要聊天界面]
    Admin[👨‍💼 管理員] --> BackendClient[🔧 Backend-Client<br/>Vue 3 + Vuetify<br/>管理後台界面]
    
    %% 前端應用層
    FrontClient --> FrontServer[⚡ Front-Server<br/>Node.js + Express<br/>Port: 8081<br/>聊天服務器]
    BackendClient --> BackendServer[🔧 Backend-Server<br/>Node.js + Express<br/>Port: 5001<br/>管理服務器]
    
    %% 核心服務層
    FrontServer --> |"HTTP/SSE 流式響應"| APIServer[🤖 API-Server<br/>Python Flask/FastAPI<br/>AI/LLM 處理引擎]
    FrontServer --> |"文件上傳/下載"| FileService[📁 File-Service<br/>Node.js + Fastify<br/>高性能文件服務]
    BackendServer --> |"數據操作"| APIServer
    BackendServer --> |"文件管理"| FileService
    
    %% 數據存儲層
    BackendServer --> PostgreSQL[(🐘 PostgreSQL<br/>主要關聯數據)]
    BackendServer --> MongoDB[(🍃 MongoDB<br/>文檔存儲)]
    BackendServer --> Redis[(🔴 Redis<br/>緩存/會話)]
    
    APIServer --> PostgreSQL
    FileService --> LocalStorage[💾 本地文件存儲]
    
    %% 外部服務層
    APIServer --> |"多模型支持"| LLMProviders[🧠 LLM 服務商<br/>• OpenAI GPT<br/>• Azure OpenAI<br/>• Google Gemini<br/>• 本地模型]
    
    %% 認證系統
    FrontServer --> SSOSystem[🔐 SSO 認證系統<br/>• KCG SSO<br/>• CSC SSO<br/>• KSG SSO<br/>• 自定義認證]
    BackendServer --> SSOSystem
    
    %% 監控系統
    BackendServer --> Prometheus[📊 Prometheus<br/>監控指標]
    APIServer --> Prometheus
    
    %% 樣式設置
    classDef frontend fill:#e1f5fe,stroke:#01579b,color:#000
    classDef backend fill:#f3e5f5,stroke:#4a148c,color:#000
    classDef database fill:#e8f5e8,stroke:#1b5e20,color:#000
    classDef external fill:#fff3e0,stroke:#e65100,color:#000
    classDef user fill:#ffe0e0,stroke:#c62828,color:#000
    
    class FrontClient,BackendClient frontend
    class FrontServer,BackendServer,APIServer,FileService backend
    class PostgreSQL,MongoDB,Redis,LocalStorage database
    class LLMProviders,SSOSystem,Prometheus external
    class User,Admin user
