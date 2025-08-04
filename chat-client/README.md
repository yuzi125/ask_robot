## 前端與 python 建立長連接

---

1.設定 response 響應頭建長連接  
return Response(generate(), **content_type='text/event-stream'**) //參考 chatgpt

---

## 前端接收參數的格式

---

yield '{ type: "data" }'  
yield '&lt;/end&gt;' 結束符號  
yield '1 次送 1 組'  
yield '第 2 組 '  
yield '&lt;/end&gt;' 不同 type 以及 json 與一般字串的切換都需要結束符號分隔
yield '{ type: "image", data: { src: "https://i.imgur.com/yozbBhh.jpeg", title: "統計圖", alt: "統計圖" } }'  
yield '{ type: "card", data: card:[{id:"",title:"",items:[{text:"",value:""}]},...] }'  
yield '{ type: "charts_line", data: { title: "屆退趨勢圖", preset: "近 2 年"} }'  
yield '{ type: "charts_stacked", data: { title: "各層級人員學歷分布"} }'  
yield '{ type: "hint", data: ["產品問題", "訂閱問題"] }'  
yield '{ type: "iframe", data: { title: "屆退趨勢圖", url: "../../src/iframs/iframe.html?search=近 1 年", needHorizontal: true,needReload: true, shareJobId: "之後帶工號"}}'

---
