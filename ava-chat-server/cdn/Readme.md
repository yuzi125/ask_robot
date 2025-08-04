# 右下角聊天外掛

## 簡介

引入 cdn 後建立實例，即會在網頁右下角生成聊天 icon 及視窗

## 使用方法

1.引入 cdn

```
<script src="http://localhost:8081/cdn/AVALoader.js"></script>
```

2.宣告建立實例

```
const xxx = new AVALoader({
    url: "http://localhost:5000",
    icon: "http://localhost:8081/cdn/robot.png",
});
```

3.控制方法

```
初始化=>
xxx.init();

撤銷=>
xxx.destroy();

顯示=>
xxx.show();

隱藏=>
xxx.hide();
```

```
以上的程式碼要記得
http://localhost:8081的地方改成chat-server的domain
http://localhost:5000的地方改成chat-client的domain
domain裝在env變數使用較好
```
