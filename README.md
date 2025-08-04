![系統架構圖](https://github.com/yuzi125/ask_robot/raw/main/Untitled%20diagram%20_%20Mermaid%20Chart-2025-08-04-043932.png)

🧑‍💻【用戶層】
👤 User（用戶）
一般訪客或使用者，使用聊天功能的主要對象。

👨‍💼 Admin（管理員）
系統維運與管理者，負責後台內容維護、帳號管理等。

🖥️【前端應用層】
🖥️ Front-Client（Vue 3 + Tailwind）
使用者介面，實作與顯示聊天 UI（如文字框、訊息列表等）。

🔧 Backend-Client（Vue 3 + Vuetify）
管理員後台 UI，提供帳號管理、操作紀錄查詢、監控管理等功能。

⚙️【後端伺服器層】
⚡ Front-Server（Node.js + Express, Port: 8081）
使用者前端的中介伺服器，負責處理聊天室的請求與串接 API/AI 模型/文件上傳。

🔧 Backend-Server（Node.js + Express, Port: 5001）
管理後台的中介伺服器，處理資料查詢、後台操作、與核心 API 交互。

🧠【核心處理服務】
🤖 API-Server（Python Flask / FastAPI）
核心 AI/LLM 推論服務，負責：

與 LLM 服務提供者串接

處理聊天上下文

回傳 AI 回應

📁 File-Service（Node.js + Fastify）
提供高效能的檔案處理（上傳、下載），支援使用者或管理員的附件上傳需求。

💾【資料存儲層】
🐘 PostgreSQL
關聯式資料庫，儲存使用者資訊、聊天紀錄、後台資料（如帳號、權限等）。

🍃 MongoDB
文檔型資料庫，適合儲存非結構化的資料，如使用者設定、聊天室設定、日誌紀錄等。

🔴 Redis
記憶體型快取資料庫，用於暫存登入 Session、快速查詢熱門資料、推播快取等。

💾 LocalStorage
實體硬碟或雲端儲存空間，用來儲存上傳檔案（例如圖片、PDF、CSV 等）。

🌐【外部服務層】
🧠 LLM 服務商
AI 模型的來源，可支援多模型：
本地部署 LLM（例如 LLaMA3、Mistral 等）

🔐 SSO 認證系統
單一登入（Single Sign-On）整合，可支援多種機構或自定認證方式：
自定義帳密驗證

📈【監控系統】
📊 Prometheus
系統監控工具，收集：

API 請求頻率

系統負載

記憶體使用率

容錯/健康檢查資訊

