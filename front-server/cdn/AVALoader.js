class AVALoader {
    constructor(options) {
        this.options = options;
        this.circle = "";
        this.rectangle = "";
        this.iframe = "";
        this.close_btn = "";
        this.isOpen = false;
        this.downX = "";
        this.downY = "";
        this.move = false;
        this.touchMove = false;
        this.circle_move = false;
        this.circleMouseDown = false;
        this.circleX = "";
        this.circleY = "";
        this.direction = "";
        this.mobileWidth = 768; // 自訂行動裝置寬度，for RWD設計。
        this.IframeDirection = options.IframeDirection;
        this.position = options.position || "center";
        this.fullScreen = options.fullScreen === true;
        this.transformValue = "";
        this.isDragAndResizeMode = false;
        this.cdn = options.cdn || options.url + "chat/cdn";
        this.showAVA = options.showAVA || options.showAVA === undefined ? true : false;
        this.icon = options.icon || options.url + "chat/cdn/robot.png";
        this.userId = options.userId || "";
        this.targetExpert = options.targetExpert || "";
        // 判斷拖曳的時候要不要關閉視窗
        this.dragIframeWrapper = false;
        // 要顯示的專家
        this.showExpertIds = options.showExpertIds || [];
        // 要隱藏的專家
        this.hideExpertIds = options.hideExpertIds || [];
        // 是否要禁用拖曳icon
        this.dragIcon = options.dragIcon !== false;
        // 是否要禁用拖曳聊天室
        this.dragChatRoom = options.dragChatRoom !== false;
        // icon透明度
        this.iconOpacity = options.iconOpacity || 0.8;
        // this.init();

        // 新增一個屬性來儲存聊天室提示元素
        this.chatPrompt = null;
        // 聊天室提示字幕
        this.innerText = options.innerText;
        this.textElement = null;
        this.closeBtnUrl = options.closeBtnUrl || `${options.url}/close.svg`;
        this.debounceTimer = null;
        // 是否要開啟選單
        this.openMenu = options.openMenu === true;

        this.loadCDN(`${this.cdn}/interact.min.js`, () => {
            let _self = this;
            interact("#iframeWrapper")
                .resizable({
                    // resize from all edges and corners
                    edges: {
                        left: true,
                        right: true,
                        bottom: true,
                        top: true,
                    },
                    margin: 15, // 設定觸發resize的邊緣範圍。
                    listeners: {
                        start() {
                            _self.dragIframeWrapper = true;
                            const overlay = document.createElement("div");
                            overlay.style.position = "absolute";
                            overlay.style.top = "0";
                            overlay.style.left = "0";
                            overlay.style.width = "100%";
                            overlay.style.height = "100%";
                            overlay.style.backgroundColor = "transparent";
                            overlay.style.zIndex = "9999";
                            overlay.id = "drag-overlay";
                            document.body.appendChild(overlay);
                        },
                        end(event) {
                            const overlay = document.getElementById("drag-overlay");
                            if (overlay) {
                                document.body.removeChild(overlay);
                            }
                            event.preventDefault();
                            event.stopPropagation();

                            /**
                             * 這邊利用 event loop 的特性 讓 dragIframeWrapper 不要馬上執行
                             * 不然 dragIframeWrapper 如果瞬間變成 false 會把視窗關掉
                             * */
                            setTimeout(() => {
                                _self.dragIframeWrapper = false;
                            }, 0);
                        },
                        move(event) {
                            console.log("move");
                            const currentTransform = window.getComputedStyle(iframeWrapper).transform;
                            const matrix = new DOMMatrix(currentTransform);
                            const currentX = matrix.m41;
                            const currentY = matrix.m42;
                            localStorage.setItem(
                                `${_self.userId}_iframeXY`,
                                JSON.stringify({ x: currentX, y: currentY })
                            );
                            _self.rectangle.style.transition = "";

                            let target = event.target;

                            let x = 0,
                                y = 0;

                            if (localStorage.getItem(`${_self.userId}_iframeXY`) !== null) {
                                const iframeXY = JSON.parse(localStorage.getItem(`${_self.userId}_iframeXY`));
                                x = iframeXY.x;
                                y = iframeXY.y;
                            } else {
                                // 如果 localStorage 裡沒有數據，獲取元素的初始位置
                                const style = window.getComputedStyle(target);
                                const matrix = new DOMMatrix(style.transform);
                                x = matrix.m41;
                                y = matrix.m42;
                            }

                            let moveX = x;
                            let moveY = y;

                            // update the element's style
                            target.style.width = event.rect.width + "px";
                            target.style.height = event.rect.height + "px";

                            // translate when resizing from top or left edges
                            if (_self.position === "right") {
                                // 當設定為 right 時，固定 X 軸為 0，只更新 Y 軸
                                moveX = 0;
                                moveY = y + event.deltaRect.top;
                            } else {
                                // 其他情況，正常更新 X 與 Y 軸
                                moveX += event.deltaRect.left;
                                moveY += event.deltaRect.top;
                            }

                            target.style.transform = "translate(" + moveX + "px," + moveY + "px)";

                            target.setAttribute("data-x", moveX);
                            target.setAttribute("data-y", moveY);

                            localStorage.setItem(`${_self.userId}_iframeXY`, JSON.stringify({ x: moveX, y: moveY }));
                            localStorage.setItem(
                                `${_self.userId}_iframeSize`,
                                JSON.stringify({
                                    width: event.rect.width,
                                    height: event.rect.height,
                                })
                            );
                        },
                    },
                    modifiers: [
                        // keep the edges inside the parent
                        interact.modifiers.restrictEdges({
                            outer: "parent",
                        }),

                        // minimum size
                        interact.modifiers.restrictSize({
                            min: { width: 100, height: 50 },
                        }),
                    ],

                    inertia: true,
                })
                .draggable({
                    listeners: {
                        start(event) {
                            _self.dragIframeWrapper = true;
                            const overlay = document.createElement("div");
                            overlay.style.position = "absolute";
                            overlay.style.top = "0";
                            overlay.style.left = "0";
                            overlay.style.width = "100%";
                            overlay.style.height = "100%";
                            overlay.style.backgroundColor = "transparent";
                            overlay.style.zIndex = "9999";
                            overlay.id = "drag-overlay";
                            document.body.appendChild(overlay);
                        },
                        move: this.dragMoveListener.bind(this),
                        end(event) {
                            const overlay = document.getElementById("drag-overlay");
                            if (overlay) {
                                document.body.removeChild(overlay);
                            }
                            event.preventDefault();
                            event.stopPropagation();

                            /**
                             * 這邊利用 event loop 的特性 讓 dragIframeWrapper 不要馬上執行
                             * 不然 dragIframeWrapper 如果瞬間變成 false 會把視窗關掉
                             * */
                            setTimeout(() => {
                                _self.dragIframeWrapper = false;
                            }, 0);
                        },
                    },
                    inertia: true,
                    modifiers: [
                        interact.modifiers.restrictRect({
                            restriction: "parent",
                            endOnly: true,
                        }),
                    ],
                });
        });
    }

    loadCDN(url, callback) {
        let script = document.createElement("script");
        script.type = "text/javascript";
        script.src = url;

        script.onload = callback;

        document.head.appendChild(script);
    }

    dragMoveListener(event) {
        const target = event.target;
        // 如果目標是iframeWrapper且沒有拖曳聊天室，則不進行拖曳
        if (target.getAttribute("id") === "iframeWrapper" && !this.dragChatRoom) return;
        // Extract and parse the current transform values
        const style = window.getComputedStyle(target);

        const matrix = new DOMMatrix(style.transform);

        const currentTranslateX = matrix.m41;
        const currentTranslateY = matrix.m42;

        // Calculate the new position by adding the drag delta
        const newX = currentTranslateX + event.dx;
        const newY = currentTranslateY + event.dy;
        localStorage.setItem(`${this.userId}_iframeXY`, JSON.stringify({ x: newX, y: newY }));
        // Apply the new translation
        target.style.transform = `translate(${newX}px, ${newY}px)`;

        // Reset any transition effect during drag
        this.rectangle.style.transition = "";

        // Store the updated position back in data-x/data-y attributes
        target.setAttribute("data-x", newX);
        target.setAttribute("data-y", newY);
    }

    destroy() {
        removeEventListener("resize", this.handleResize);
        removeEventListener("message", this.handleIframeMessage);
        document.removeEventListener("mousemove", this.handleMousemove);
        document.removeEventListener("mouseup", this.handleMouseup);
        document.removeEventListener("click", this.handleOutsideClick);
        this.close_btn.removeEventListener("click", this.handleCloseClick);
        this.circle.removeEventListener("click", this.handleCircleClick);
        this.circle.removeEventListener("mousedown", this.handleCircleMousedown);
        this.circle.removeEventListener("touchmove", this.handleCircleTouchmove);
        this.circle.removeEventListener("touchend", this.handleCircleTouchEnd);
        document.body.removeChild(this.circle);
        document.body.removeChild(this.rectangle);
        document.body.removeChild(this.chatPrompt);
    }
    hide() {
        this.circle.style.display = "none";
        this.chatPrompt.style.display = "none";
        // this.rectangle.style.display = "none";
    }
    show() {
        this.circle.style.display = "block";
        this.chatPrompt.style.display = "block";
        this.rectangle.style.display = "flex";

        // chatprompt確保長度能夠正確顯示
        // requestAnimationFrame(() => {
        //     this.chatPrompt.style.width = `${this.textElement.scrollWidth + 1.5}px`;
        // });
    }

    setIframeDirection(direction) {
        this.IframeDirection = direction;
    }

    getTranslateValue = (isInit) => {
        // 判斷是否為初始化

        if (localStorage.getItem(`${this.userId}_iframeXY`) !== null) {
            let { x, y } = JSON.parse(localStorage.getItem(`${this.userId}_iframeXY`));

            const iframeWrapper = document.getElementById("iframeWrapper");
            if (iframeWrapper) {
                const iframeWidth = iframeWrapper.offsetWidth || 0;
                const iframeHeight = iframeWrapper.offsetHeight || 0;

                // 檢查位置是否超出螢幕邊界，若超出則將位置重置到螢幕中央
                if (x + iframeWidth > window.innerWidth || y + iframeHeight > window.innerHeight) {
                    // 重置到螢幕中央，使用 translate(-50%, -50%) 來居中
                    console.log("reset to center");
                    return `translate(-50%, -50%)`;
                }

                // 更新 localStorage 中的位置
                localStorage.setItem(`${this.userId}_iframeXY`, JSON.stringify({ x, y }));
            }

            if (isInit && this.IframeDirection === "top") {
                return `translateX(${x}px) translateY(calc(-120% + ${y}px))`;
            } else if (isInit && this.IframeDirection === "bottom") {
                return `translateX(${x}px) translateY(calc(120% + ${y}px))`;
            } else if (isInit && this.IframeDirection === "left") {
                return `translateX(calc(-120% + ${x}px)) translateY(${y}px)`;
            } else if (isInit && this.IframeDirection === "right") {
                return `translateX(calc(120% + ${x}px)) translateY(${y}px)`;
            }

            switch (this.IframeDirection) {
                case "top":
                    return !this.isOpen
                        ? `translateX(${x}px) translateY(calc(-120% + ${y}px))`
                        : `translateX(${x}px) translateY(${y}px)`;
                case "bottom":
                    return !this.isOpen
                        ? `translateX(${x}px) translateY(calc(120% + ${y}px))`
                        : `translateX(${x}px) translateY(${y}px)`;
                case "left":
                    return !this.isOpen
                        ? `translateX(calc(-120% + ${x}px)) translateY(${y}px)`
                        : `translateX(${x}px) translateY(${y}px)`;
                case "right":
                    return !this.isOpen
                        ? `translateX(calc(120% + ${x}px)) translateY(${y}px)`
                        : `translateX(${x}px) translateY(${y}px)`;
                default:
                    console.error("Invalid IframeDirection");
                    return;
            }
        } else {
            // 當 localStorage 沒有數據時的預設行為
            if (isInit && this.IframeDirection === "top") {
                return `translate(-50%, -120%)`; // Counteract left: 50%, move up
            } else if (isInit && this.IframeDirection === "bottom") {
                return `translate(-50%, 120%)`; // Counteract left: 50%, move down
            } else if (isInit && this.IframeDirection === "left") {
                return `translate(-120%, -50%)`; // Counteract top: 50%, move left
            } else if (isInit && this.IframeDirection === "right") {
                return `translate(120%, -50%)`; // Counteract top: 50%, move right
            }

            // 判斷方向;
            switch (this.IframeDirection) {
                case "top":
                    return !this.isOpen
                        ? `translate(-50%, -120%)` // Counteract left: 50%, move up
                        : `translate(-50%, -50%)`; // Center the element
                case "bottom":
                    return !this.isOpen
                        ? `translate(-50%, 120%)` // Counteract left: 50%, move down
                        : `translate(-50%, -50%)`; // Center the element
                case "left":
                    return !this.isOpen
                        ? `translate(-120%, -50%)` // Counteract top: 50%, move left
                        : `translate(-50%, -50%)`; // Center the element
                case "right":
                    return !this.isOpen
                        ? `translate(120%, -50%)` // Counteract top: 50%, move right
                        : `translate(-50%, -50%)`; // Center the element
                default:
                    console.error("Invalid IframeDirection");
                    return;
            }
        }

        // if (isInit && this.IframeDirection === "top") {
        //   return `translate(-50%, -120%)`; // Counteract left: 50%, move up
        // } else if (isInit && this.IframeDirection === "bottom") {
        //   return `translate(-50%, 120%)`; // Counteract left: 50%, move down
        // } else if (isInit && this.IframeDirection === "left") {
        //   return `translate(-120%, -50%)`; // Counteract top: 50%, move left
        // } else if (isInit && this.IframeDirection === "right") {
        //   return `translate(120%, -50%)`; // Counteract top: 50%, move right
        // }

        // 判斷方向
        // switch (this.IframeDirection) {
        //   case "top":
        //     return !this.open
        //       ? `translate(-50%, -120%)` // Counteract left: 50%, move up
        //       : `translate(-50%, -50%)`; // Center the element
        //   case "bottom":
        //     return !this.open
        //       ? `translate(-50%, 120%)` // Counteract left: 50%, move down
        //       : `translate(-50%, -50%)`; // Center the element
        //   case "left":
        //     return !this.open
        //       ? `translate(-120%, -50%)` // Counteract top: 50%, move left
        //       : `translate(-50%, -50%)`; // Center the element
        //   case "right":
        //     return !this.open
        //       ? `translate(120%, -50%)` // Counteract top: 50%, move right
        //       : `translate(-50%, -50%)`; // Center the element
        //   default:
        //     console.error("Invalid IframeDirection");
        //     return;
        // }
    };

    init() {
        let url = this.options.url;
        // let icon = this.options.icon;
        let transformValue = this.getTranslateValue(true);

        // 建立icon元素
        this.circle = document.createElement("div");
        this.circle.style.width = "4rem";
        this.circle.style.height = "4rem";
        this.circle.style.borderRadius = "50%";
        this.circle.style.background = `url(${this.icon}) no-repeat center`;
        this.circle.style.backgroundSize = "contain";
        this.circle.style.backgroundColor = "white";
        this.circle.style.position = "fixed";
        this.circle.style.boxShadow = "3px 3px 5px gray";
        this.circle.style.cursor = "pointer";
        this.circle.style.opacity = this.iconOpacity;
        this.circle.style.transitionProperty = "opacity,right,bottom";
        this.circle.style.transitionDuration = "0.3s";
        this.circle.style.transitionTimingFunction = "ease";
        this.circle.style.zIndex = "9999";
        this.circle.style.bottom = this.options.iconPosition?.bottom || "1rem";
        this.circle.style.right = this.options.iconPosition?.right || "1rem";

        //建立iframe外層
        this.rectangle = document.createElement("div");
        // this.rectangle.style.width = "100px";
        // this.rectangle.style.height = "100%";

        // 沒有去調整大小的話，就去取得當前視窗的寬度，如果小於 768px 寬度就設定為 80%，因為手機版的調 500px 會太大。
        let windowWidth = window.innerWidth;

        if (localStorage.getItem(`${this.userId}_iframeSize`) !== null) {
            const { width, height } = JSON.parse(localStorage.getItem(`${this.userId}_iframeSize`));
            this.rectangle.style.width = `${width}px`;
            this.rectangle.style.height = `${height}px`;
        } else if (this.options.setWidth || this.options.setHeight) {
            this.rectangle.style.width = `${this.options.setWidth}px` || "500px";
            this.rectangle.style.height = `${this.options.setHeight}px` || "calc(100% - 7rem)";
        } else if (windowWidth <= this.mobileWidth) {
            // 預設行動裝置為滿版
            this.rectangle.style.width = "100%";
            this.rectangle.style.height = "100%";
        } else {
            this.rectangle.style.width = "500px";
            this.rectangle.style.height = "calc(100% - 7rem)";
        }

        this.rectangle.style.zIndex = "9999";
        this.rectangle.style.backgroundColor = "#fff";

        if (window.innerWidth > this.mobileWidth) {
            this.rectangle.style.padding = "45px 15px 15px 15px";
            this.rectangle.style.borderRadius = "1rem";
            this.rectangle.style.border = "3px solid gray";
            this.rectangle.style.boxShadow = "5px 5px 15px gray";
        }

        this.rectangle.style.position = "fixed";
        this.rectangle.style.top = "50%";
        this.rectangle.style.left = "50%";
        this.rectangle.style.display = "flex";
        this.rectangle.style.justifyContent = "center";
        this.rectangle.style.alignItems = "center";
        this.rectangle.id = "iframeWrapper";
        this.rectangle.style.transition = "all 0.3s ease-in-out";
        this.rectangle.style.transform = transformValue;
        this.rectangle.style.touchAction = "none";
        this.rectangle.style.opacity = "0";
        this.rectangle.style.visibility = "hidden";
        this.rectangle.style.userSelect = "none";
        this.rectangle.style.boxSizing = "border-box";

        //建立關閉按鈕
        this.close_btn = document.createElement("img");
        this.close_btn.src = this.closeBtnUrl;
        this.close_btn.style.width = "24px";
        this.close_btn.style.height = "24px";
        this.close_btn.style.backgroundColor = "white";
        this.close_btn.style.position = "absolute";
        if (window.innerWidth > this.mobileWidth) {
            this.close_btn.style.top = "8px";
            this.close_btn.style.right = "12px";
        } else {
            this.close_btn.style.top = "8px";
            this.close_btn.style.left = "8px";
        }
        this.close_btn.style.cursor = "pointer";
        this.close_btn.style.border = "3px solid gray";
        this.close_btn.style.borderRadius = "50%";
        this.rectangle.appendChild(this.close_btn);

        // this.getLocal("iframe");
        // this.getLocal("icon");

        // 建立視窗調整提示元素
        if (window.innerWidth > this.mobileWidth) {
            this.resize_tip = document.createElement("div");
            this.resize_tip.style.position = "absolute";
            this.resize_tip.style.top = "15px";
            this.resize_tip.style.left = "15px";
            this.resize_tip.style.color = "rgba(0, 0, 0, 0.4)";
            this.resize_tip.style.fontSize = "16px";
            this.resize_tip.style.fontWeight = "900";
            this.resize_tip.style.opacity = "0"; // 初始設定為隱藏
            this.resize_tip.style.transform = "translateY(20px)"; // 初始位置設定為向下移動
            this.resize_tip.style.transition = "opacity 0.5s ease-in-out, transform 0.5s ease-in-out"; // 設定過渡效果
            this.resize_tip.innerText = "提示 : 按住邊框可以調整與拖拉視窗";
            this.rectangle.addEventListener("mouseenter", this.handleMouseenter);
            this.rectangle.addEventListener("mouseleave", this.handleMouseleave);
            this.rectangle.appendChild(this.resize_tip);
        }

        // 建立iframe元素
        this.iframe = document.createElement("iframe");

        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.border = "0";
        // this.iframe.style.backgroundColor = "#202123";

        this.iframe.style.backgroundColor = "#fff"; // 使用純白色背景，與外層 rectangle 一致

        this.iframe.style.overflow = "hidden";
        if (window.innerWidth > this.mobileWidth) {
            this.iframe.style.borderRadius = "1rem";
        }

        this.iframe.allow = "microphone";

        // 添加一個載入器在 iframe 上層
        const loadingIndicator = document.createElement("div");
        loadingIndicator.style.position = "absolute";
        loadingIndicator.style.top = "0";
        loadingIndicator.style.left = "0";
        loadingIndicator.style.width = "100%";
        loadingIndicator.style.height = "100%";
        loadingIndicator.style.display = "flex";
        loadingIndicator.style.flexDirection = "column";
        loadingIndicator.style.alignItems = "center";
        loadingIndicator.style.justifyContent = "center";
        loadingIndicator.style.backgroundColor = "#fff";
        loadingIndicator.style.zIndex = "1";
        loadingIndicator.id = "loading-indicator";

        // 添加旋轉圖示
        const spinner = document.createElement("div");
        spinner.style.width = "40px";
        spinner.style.height = "40px";
        spinner.style.borderRadius = "50%";
        spinner.style.border = "4px solid #f3f3f3";
        spinner.style.borderTop = "4px solid #3498db";
        spinner.style.animation = "spin 1s linear infinite";
        spinner.style.marginBottom = "20px";

        // 添加動畫樣式
        const style = document.createElement("style");
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes dots {
                0% { content: ''; }
                25% { content: '.'; }
                50% { content: '..'; }
                75% { content: '...'; }
                100% { content: ''; }
            }
        `;
        document.head.appendChild(style);

        // 添加文字說明
        const loadingText = document.createElement("div");
        loadingText.style.fontSize = "16px";
        loadingText.style.color = "#333";
        loadingText.style.position = "relative";
        loadingText.style.width = "100px";
        loadingText.style.textAlign = "center";
        loadingText.textContent = "初始化中";
        loadingText.style.position = "relative";

        // 添加動態點的偽元素
        // const dotStyle = document.createElement("style");
        // dotStyle.textContent = `
        //     #loading-text-container::after {
        //         content: '';
        //         position: absolute;
        //         display: inline-block;
        //         animation: dots 1.5s infinite;
        //         margin-left: 2px;
        //     }
        // `;
        // document.head.appendChild(dotStyle);

        const textContainer = document.createElement("div");
        textContainer.id = "loading-text-container";
        textContainer.style.position = "relative";
        textContainer.style.display = "inline-block";
        textContainer.appendChild(loadingText);

        loadingIndicator.appendChild(spinner);
        loadingIndicator.appendChild(textContainer);

        // 先將 iframe 放到 container 中
        this.rectangle.appendChild(this.iframe);
        // 再添加載入指示器
        this.rectangle.appendChild(loadingIndicator);

        // 在 url 後面加上時間戳記
        url = url + (url.includes("?") ? "&" : "?") + "_t=" + new Date().getTime();

        setTimeout(() => {
            this.iframe.src = url;
        }, 2000);

        // iframe 載入完成後隱藏載入指示器
        this.iframe.onload = () => {
            // 如果 iframe 已經載入了 URL，則隱藏載入指示器
            if (this.iframe.src) {
                console.log("iframe 載入完成");
                const indicator = document.getElementById("loading-indicator");
                if (indicator) {
                    indicator.style.display = "none";
                }

                this.postMessage({
                    setShowExpert: {
                        showExpertIds: this.showExpertIds,
                        hideExpertIds: this.hideExpertIds,
                    },
                });

                if (this.targetExpert) {
                    this.postMessage({ setTargetExpert: this.targetExpert });
                }

                this.postMessage({ isOpenMenu: this.openMenu });
            }
        };

        // 將元素新增到頁面的 <body> 元素中
        document.body.appendChild(this.circle);
        document.body.appendChild(this.rectangle);

        // 讓手機的返回鍵可以關閉 iframe
        this.hasAddedHistoryEntry = false;
        window.addEventListener("popstate", (event) => {
            if (this.isOpen) {
                this.isOpen = false;
                this.switch();
                this.hasAddedHistoryEntry = false;
            }
        });

        addEventListener("resize", this.handleResize);

        addEventListener("message", this.handleIframeMessage);

        this.close_btn.addEventListener("click", this.handleCloseClick);

        document.addEventListener("mousemove", this.handleMousemove);
        document.addEventListener("mouseup", this.handleMouseup);
        this.circle.addEventListener("click", this.handleCircleClick);
        this.circle.addEventListener("mousedown", this.handleCircleMousedown);
        this.circle.addEventListener("touchmove", this.handleCircleTouchmove);
        this.circle.addEventListener("touchend", this.handleCircleTouchEnd);
        document.addEventListener("click", this.handleOutsideClick);
        // this.postMessage({ setShowExpert: this.experts });

        this.chatPrompt = document.createElement("div");
        if (this.circle) {
            this.circle.appendChild(this.chatPrompt);
        }
        //判斷是否顯示 AVA
        if (!this.showAVA) {
            this.hide();
        }

        // 只有在 innerText 是陣列時才建立聊天室提示元素
        if (Array.isArray(this.innerText)) {
            const arrowStyle = document.createElement("style");
            arrowStyle.textContent = `
                .chat-prompt::after {
                    content: '';
                    position: absolute;
                    right: -8px;
                    bottom: 1rem;
                    width: 0;
                    height: 0;
                    border-left: 8px solid white;
                    border-top: 6px solid transparent;
                    border-bottom: 6px solid transparent;
                    filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.1));
                }
            `;
            document.head.appendChild(arrowStyle);

            this.chatPrompt.style.position = "absolute";
            this.chatPrompt.style.bottom = "50%";
            this.chatPrompt.style.left = "-15px";
            this.chatPrompt.style.transform = "translate(-100%, 50%)";
            this.chatPrompt.style.backgroundColor = "#ffffff";
            this.chatPrompt.style.border = "1px solid rgba(0,0,0,0.1)";
            this.chatPrompt.style.opacity = this.iconOpacity;
            this.chatPrompt.style.color = "#333333";
            this.chatPrompt.style.fontWeight = "500";
            this.chatPrompt.style.padding = "0.5rem 1rem";
            this.chatPrompt.style.borderRadius = "0.5rem";
            this.chatPrompt.style.boxShadow = "2px 2px 4px rgba(0,0,0,0.5)";
            this.chatPrompt.style.transition = "opacity 0.3s ease";
            this.chatPrompt.style.zIndex = "9998";
            this.chatPrompt.style.width = "auto";
            this.chatPrompt.style.overflow = "visible";
            this.chatPrompt.classList.add("chat-prompt");

            // 建立文字元素
            this.textElement = document.createElement("div");
            this.textElement.style.display = "inline-block";
            this.textElement.style.whiteSpace = "nowrap";
            this.textElement.style.textAlign = "center";

            // 將文字元素新增到聊天室提示元素
            this.chatPrompt.appendChild(this.textElement);

            // 建立關閉按鈕
            const closeButton = document.createElement("span");
            closeButton.innerHTML = "&times;";
            closeButton.style.position = "absolute";
            closeButton.style.top = "-10px";
            closeButton.style.right = "-10px";
            closeButton.style.cursor = "pointer";
            closeButton.style.fontSize = "16px";
            closeButton.style.color = "#666";
            closeButton.style.backgroundColor = "#fff";
            closeButton.style.width = "20px";
            closeButton.style.height = "20px";
            closeButton.style.borderRadius = "50%";
            closeButton.style.display = "flex";
            closeButton.style.alignItems = "center";
            closeButton.style.justifyContent = "center";
            closeButton.style.border = "1px solid rgba(0,0,0,0.1)";
            closeButton.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

            // 添加提示文字的樣式
            const tipStyle = document.createElement("style");
            tipStyle.textContent = `
                .close-button-tip {
                    position: absolute;
                    top: -25px;
                    right: -10px;
                    background-color: rgba(0, 0, 0, this.iconOpacity);
                    color: white;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                }
                .close-button:hover .close-button-tip {
                    opacity: 1;
                }
            `;
            document.head.appendChild(tipStyle);

            // 建立提示元素
            const tip = document.createElement("div");
            tip.className = "close-button-tip";
            tip.textContent = "關閉後則不顯示提示";

            // 包裝關閉按鈕和提示
            const closeButtonWrapper = document.createElement("div");
            closeButtonWrapper.className = "close-button";
            closeButtonWrapper.appendChild(closeButton);
            closeButtonWrapper.appendChild(tip);

            closeButton.addEventListener("click", () => {
                this.chatPrompt.style.display = "none";
            });

            // 將關閉按鈕包裝器添加到 chatPrompt
            this.chatPrompt.appendChild(closeButtonWrapper);

            const revealTime = 5000;
            let currentIndex = 0;
            const totalTexts = this.innerText.length;

            const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            const updateText = async () => {
                this.chatPrompt.style.opacity = "0";
                await delay(1400);
                this.chatPrompt.style.opacity = this.iconOpacity;

                if (totalTexts > 0) {
                    if (!this.isOpen) {
                        // 只有在 iframe 關閉時才更新 chatPrompt
                        this.textElement.innerText = this.innerText[currentIndex];
                        // this.chatPrompt.style.width = `${this.textElement.scrollWidth + 1.5}px`;

                        if (currentIndex === totalTexts - 1) {
                            await delay(revealTime); // 最後一個文字
                            this.chatPrompt.style.opacity = "0";
                            await delay(8000); // 一輪結束後休息多久
                            this.chatPrompt.style.opacity = this.iconOpacity;
                        } else {
                            await delay(revealTime);
                        }
                        currentIndex = (currentIndex + 1) % totalTexts;
                    } else {
                        // 如果 iframe 開啟，確保 chatPrompt 隱藏
                        this.chatPrompt.style.opacity = "0";
                        await delay(revealTime);
                    }

                    // 在完成後再次調用 updateText
                    updateText();
                }
            };

            this.chatPrompt.style.transition = "opacity 0.3s ease-in-out";

            updateText();

            if (this.fullScreen) {
                this.setFullScreen();
            }
        }
    }
    setExpert(id) {
        this.postMessage({ setExpert: id });
    }

    setIframeSize(width, height) {
        this.rectangle.style.width = `${width}px`;
        this.rectangle.style.height = `${height}px`;
    }

    logout(cb) {
        return new Promise((resolve, reject) => {
            const context = {
                message: { logout: true },
                status: "pending",
            };

            try {
                // 執行核心登出邏輯
                this.postMessage(context.message);

                context.status = "success";

                // 如果有 callback，執行 callback
                if (typeof cb === "function") {
                    cb(null, context);
                }

                // 返回 Promise resolve
                resolve(context);
            } catch (error) {
                context.status = "failed";

                // 如果有 callback，將錯誤傳遞給 callback
                if (typeof cb === "function") {
                    cb(error, context);
                }

                // 返回 Promise reject
                reject(error);
            }
        });
    }

    getLocal(type) {
        if (type === "iframe") {
            let width_height = localStorage.getItem("plug-chat-iframe-width-height");
            if (width_height) {
                width_height = JSON.parse(width_height);
                let w = parseInt(width_height.width);
                let h = parseInt(width_height.height);
                this.rectangle.style.maxWidth = "";
                this.rectangle.style.minWidth = "";
                this.rectangle.style.maxHeight = "";
                this.rectangle.style.minHeight = "";
                this.rectangle.style.width = (w <= innerWidth - 32 ? w : innerWidth - 32) + "px";
                this.rectangle.style.height = (h <= innerHeight - 112 ? h : innerHeight - 112) + "px";
            }
        } else if (type === "icon") {
            let icon_bottom = localStorage.getItem("plug-chat-icon-bottom");
            if (icon_bottom) {
                icon_bottom = JSON.parse(icon_bottom);
                let bottom = parseInt(icon_bottom.bottom);
                const circleH = 64;
                const maxY = innerHeight - 16 - circleH;
                this.circle.style.bottom = `${bottom > maxY ? maxY : bottom}px`;
            }
        }
    }
    setLocal(type) {
        if (type === "iframe") {
            localStorage.setItem(
                "plug-chat-iframe-width-height",
                JSON.stringify({
                    width: this.rectangle.style.width.replace("px", ""),
                    height: this.rectangle.style.height.replace("px", ""),
                })
            );
        } else if (type === "icon") {
            localStorage.setItem(
                "plug-chat-icon-bottom",
                JSON.stringify({ bottom: this.circle.style.bottom.replace("px", "") })
            );
        }
    }

    chkPoint() {
        const circleH = parseInt(window.getComputedStyle(this.circle).height);
        const windowH = window.innerHeight;
        const minY = circleH / 2 + 16;
        const maxY = windowH - 16 - circleH / 2;
        if (this.circleY < minY) {
            this.circle.style.bottom = `${windowH - 16 - circleH}px`;
        }
        if (this.circleY > maxY) {
            this.circle.style.bottom = `${16}px`;
        }

        // 新增對 chatPrompt 的檢查和調整
        const chatPromptH = parseInt(window.getComputedStyle(this.chatPrompt).height);
        const chatPromptBottom = parseInt(window.getComputedStyle(this.chatPrompt).bottom);
        const chatPromptMaxY = windowH - 16 - chatPromptH;

        if (chatPromptBottom < 16) {
            this.chatPrompt.style.bottom = `${28}px`; // 增加彈回距離
        }
        if (chatPromptBottom > chatPromptMaxY) {
            this.chatPrompt.style.bottom = `${chatPromptMaxY - 28}px`; // 增加彈回距離
        }
    }

    getDirection = (event) => {
        let offsetX = event.offsetX;
        let offsetY = event.offsetY;
        if (offsetX >= 0 && offsetX < 16 && offsetY >= 0 && offsetY < 16) {
            return "top-left";
        } else if (offsetX < 3) {
            return "left";
        } else if (offsetY < 3) {
            return "top";
        } else {
            return null;
        }
    };
    setPosition() {
        const iframeWrapper = document.getElementById("iframeWrapper");
        if (!iframeWrapper) return;

        // 先把 transform、left、right、top、bottom 全部還原，避免互相影響
        iframeWrapper.style.transform = "none";
        iframeWrapper.style.left = "auto";
        iframeWrapper.style.right = "auto";
        iframeWrapper.style.top = "auto";
        iframeWrapper.style.bottom = "auto";

        // 再根據 position 決定要貼哪裡
        switch (this.position) {
            case "left":
                // 貼左：top 50%、left 0、transform: translateY(-50%)
                iframeWrapper.style.top = "50%";
                iframeWrapper.style.left = "0";
                iframeWrapper.style.transform = "translateY(-50%)";
                break;
            case "right":
                // 貼右：top 50%、right 0、transform: translateY(-50%)
                iframeWrapper.style.top = "50%";
                iframeWrapper.style.right = "0";
                iframeWrapper.style.transform = "translateY(-50%)";
                break;
            case "top":
                // 貼頂：left 50%、top 0、transform: translateX(-50%)
                iframeWrapper.style.top = "0";
                iframeWrapper.style.left = "50%";
                iframeWrapper.style.transform = "translateX(-50%)";
                break;
            case "bottom":
                // 貼底：left 50%、bottom 0、transform: translateX(-50%)
                iframeWrapper.style.bottom = "0";
                iframeWrapper.style.left = "50%";
                iframeWrapper.style.transform = "translateX(-50%)";
                break;
            case "center":
            default:
                // 完全置中：left 50%、top 50%、transform: translate(-50%, -50%)
                iframeWrapper.style.left = "50%";
                iframeWrapper.style.top = "50%";
                iframeWrapper.style.transform = "translate(-50%, -50%)";
                break;
        }
    }
    clampPosition() {
        const iframeWrapper = document.getElementById("iframeWrapper");
        if (!iframeWrapper) return;

        const rect = iframeWrapper.getBoundingClientRect();
        let offsetX = 0;
        let offsetY = 0;

        // 如果左邊超出螢幕，就往右推
        if (rect.left < 0) {
            offsetX = -rect.left;
        }
        // 如果右邊超出螢幕，就往左推
        else if (rect.right > window.innerWidth) {
            offsetX = window.innerWidth - rect.right;
        }

        // 如果上邊超出螢幕，就往下推
        if (rect.top < 0) {
            offsetY = -rect.top;
        }
        // 如果下邊超出螢幕，就往上推
        else if (rect.bottom > window.innerHeight) {
            offsetY = window.innerHeight - rect.bottom;
        }

        // 若有任何超出，就修正 transform
        if (offsetX !== 0 || offsetY !== 0) {
            const style = window.getComputedStyle(iframeWrapper);
            const matrix = new DOMMatrix(style.transform);
            const newX = matrix.m41 + offsetX;
            const newY = matrix.m42 + offsetY;
            iframeWrapper.style.transform = `translate(${newX}px, ${newY}px)`;
        }
    }

    handleResize = () => {
        console.log("handleResize");
        this.getLocal("iframe");
        this.getLocal("icon");
        const iframeWrapper = document.getElementById("iframeWrapper");
        if (!iframeWrapper) return;

        const currentWidth = iframeWrapper.offsetWidth;
        const currentHeight = iframeWrapper.offsetHeight;

        if (!this.fullScreen) {
            const maxWidth = window.innerWidth * (window.innerWidth <= this.mobileWidth ? 0.99 : 0.9);
            const maxHeight = window.innerHeight * (window.innerWidth <= this.mobileWidth ? 0.99 : 0.9);

            // 如果使用者把視窗調得太寬或太高，就先縮小
            if (currentWidth > maxWidth) {
                iframeWrapper.style.width = maxWidth + "px";
            }
            if (currentHeight > maxHeight) {
                iframeWrapper.style.height = maxHeight + "px";
            }
        }

        // 做完尺寸調整後，再進行「邊界修正」
        // this.clampPosition();

        // （以下是原本的 debounce 保存邏輯）
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            const currentTransform = window.getComputedStyle(iframeWrapper).transform;
            const matrix = new DOMMatrix(currentTransform);
            const currentX = matrix.m41;
            const currentY = matrix.m42;
            localStorage.setItem(`${this.userId}_iframeXY`, JSON.stringify({ x: currentX, y: currentY }));
        }, 500);
    };

    handleIframeMessage = (event) => {
        //之後若需要只接收event.origin指定來源
        let values = event.data.value;

        switch (event.data.type) {
            case "reqHtml":
                // const fullHTML = document.documentElement.outerHTML;
                const fullBody = document.body.outerHTML;

                this.postMessage({ resHtml: fullBody });
                break;
            case "fillHtml":
                for (let v of values) {
                    if (v.id) {
                        document.getElementById(v.id).value = v.value;
                    } else if (v.class) {
                        document.querySelector(`.${v.class}`).value = v.value;
                    }
                }
                break;
        }
    };

    handleCloseClick = () => {
        this.isOpen = false;
        this.switch();
    };
    handleMouseenter = (event) => {
        this.resize_tip.style.opacity = "1";
        this.resize_tip.style.transform = "translateY(0)"; // 恢復到原始位置
    };
    handleMouseleave = (event) => {
        this.resize_tip.style.opacity = "0";
        this.resize_tip.style.transform = "translateY(20px)"; // 再次向下移動
    };
    handleRectangleMousedown = (event) => {
        let tempDirection = this.getDirection(event);
        switch (tempDirection) {
            case "top-left":
                this.direction = "top-left";
                break;
            case "left":
                this.direction = "left";
                break;
            case "top":
                this.direction = "top";
                break;
        }
        this.downX = event.clientX;
        this.downY = event.clientY;
        this.move = true;

        this.rectangle.style.width = window.getComputedStyle(this.rectangle).width;
        this.rectangle.style.maxWidth = "";
        this.rectangle.style.minWidth = "";
        this.rectangle.style.height = window.getComputedStyle(this.rectangle).height;
        this.rectangle.style.maxHeight = "";
        this.rectangle.style.minHeight = "";

        this.rectangle.style.transition = "";
    };
    handleCircleMousedown = (event) => {
        this.circle_move = false;
        this.circleMouseDown = true;
        this.circleX = event.clientX;
        this.circleY = event.clientY;
    };
    handleMousemove = (event) => {
        if (!this.dragIcon) return;
        if (this.move) {
            let moveX = event.clientX - this.downX;
            let moveY = event.clientY - this.downY;
            let originalW = window.getComputedStyle(this.rectangle).width;
            let originalH = window.getComputedStyle(this.rectangle).height;
            let w = parseInt(originalW.replace("px", "")) - moveX;
            let h = parseInt(originalH.replace("px", "")) - moveY;

            if (w > 350 && w <= innerWidth - 32 && this.direction !== "top") {
                this.rectangle.style.width = `${w}px`;
                this.downX = event.clientX;
            }
            if (h > 300 && h <= innerHeight - 112 && this.direction !== "left") {
                this.rectangle.style.height = `${h}px`;
                this.downY = event.clientY;
            }
        }
        if (this.circleMouseDown) {
            this.circle_move = true;
            this.circle.style.cursor = "all-scroll";
            this.circle.style.transitionProperty = "opacity";
            let moveX = event.clientX - this.circleX;
            let moveY = event.clientY - this.circleY;
            let bottom = parseInt(window.getComputedStyle(this.circle).bottom.replace("px", ""));
            let right = parseInt(window.getComputedStyle(this.circle).right.replace("px", ""));
            this.circle.style.bottom = `${bottom - moveY}px`;
            this.circle.style.right = `${right - moveX}px`;
            this.circleX = event.clientX;
            this.circleY = event.clientY;

            // 更新 chatPrompt 的位置
            this.chatPrompt.style.opacity = "0";
        }
    };
    handleMouseup = () => {
        if (this.move) {
            this.setLocal("iframe");
            this.move = false;
            this.rectangle.style.transition = "all 0.3s ease-in-out";
            this.direction = "";
        }
        if (this.circleMouseDown) {
            this.circle.style.cursor = "pointer";
            this.circle.style.transitionProperty = "opacity,right,bottom";
            this.circleMouseDown = false;
            this.circle.style.right = "1rem";
            this.chkPoint();
            this.setLocal("icon");

            // 顯示 chatPrompt
            this.chatPrompt.style.opacity = this.iconOpacity; // 或者設置為其他你想要的透明度
        }
    };
    handleOutsideClick = (event) => {
        var targetElement = event.target;
        if (
            targetElement !== this.circle &&
            !this.circle.contains(targetElement) &&
            targetElement !== this.rectangle &&
            !this.rectangle.contains(targetElement) &&
            !this.dragIframeWrapper
        ) {
            this.isOpen = false;
            this.switch();
        }
    };
    handleCircleClick = () => {
        if (this.circle_move) return;
        this.isOpen = this.isOpen ? false : true;
        if (this.isOpen) {
            this.open();
        } else {
            this.close();
        }
    };

    handleCircleTouchmove = (event) => {
        // 預防觸發畫面滾動
        event.preventDefault();
        let touch = event.touches[0];

        if (!this.touchMove) {
            this.touchMove = true;

            // 與瀏覽器畫面更新頻率同步
            requestAnimationFrame(() => {
                // 32是依據chat-icon寬高進行微調
                let newBottom = window.innerHeight - touch.clientY - 32;
                let newRight = window.innerWidth - touch.clientX - 32;

                this.circle.style.bottom = `${newBottom}px`;
                this.circle.style.right = `${newRight}px`;

                this.touchMove = false; // 解除鎖定，允許下一次更新
            });
        }
    };

    handleCircleTouchEnd = async (event) => {
        let touch = event.changedTouches[0];
        if (!touch) return;

        // 32是依據chat-icon高度進行微調
        let newBottom = window.innerHeight - touch.clientY - 32;

        // 與瀏覽器畫面更新頻率同步
        requestAnimationFrame(() => {
            this.circle.style.bottom = `${newBottom}px`;
            this.circle.style.right = `1rem`; // 一律固定到右側 1rem
        });

        // 隱藏聊天室提示
        this.chatPrompt.style.opacity = "0";
    };

    open = () => {
        setTimeout(() => {
            this.isOpen = true;

            // 讓手機的返回鍵可以關閉 iframe
            if ("history" in window && "pushState" in history) {
                // 在開啟 iframe 之前先保存目前的狀態
                if (!this.hasAddedHistoryEntry) {
                    history.pushState({ avaOpen: true }, "");
                    this.hasAddedHistoryEntry = true;
                }
            }

            this.switch();
        }, 0);
    };
    close = () => {
        this.isOpen = false;

        // 手動關閉 iframe 時重置 history entry flag
        this.hasAddedHistoryEntry = false;

        this.switch();
    };

    switch = () => {
        const transformValue = this.getTranslateValue(false);
        this.rectangle.style.transition = "all 0.3s ease-in-out";
        if (this.isOpen) {
            this.postMessage({ focusInput: true });
            // 為了視覺上更流暢，先設定 transform，再顯示元素
            this.rectangle.style.transform = transformValue;

            // 在更改可見性前先設定樣式
            this.rectangle.style.opacity = "0";
            this.rectangle.style.visibility = "visible";

            // 強制重排，確保上面的樣式變更被應用
            void this.rectangle.offsetWidth;

            // 然後再改變透明度，開始淡入效果
            this.rectangle.style.opacity = "1";
            this.circle.style.opacity = this.iconOpacity;
            this.chatPrompt.style.opacity = "0"; // 隱藏聊天室提示
            this.adjustIframePosition();
        } else {
            this.rectangle.style.transform = transformValue;
            this.rectangle.style.opacity = "0";

            this.circle.style.opacity = this.iconOpacity;
            this.chatPrompt.style.opacity = this.iconOpacity; // 顯示聊天室提示
        }
    };
    postMessage(msg) {
        let message = {
            type: Object.keys(msg)[0],
            value: Object.values(msg)[0],
        };
        this.iframe.contentWindow.postMessage(message, "*"); //之後若需要"*"改成只送指定來源
    }
    adjustIframePosition = async () => {
        const iframeWrapper = document.getElementById("iframeWrapper");
        if (!iframeWrapper) return;

        // 1) 先關掉 transition，避免你還沒「設定初始位置」就開始動
        iframeWrapper.style.transition = "none";

        // 2) 呼叫 setPosition()，先把最終貼邊位置定好
        //    （此時 iframeWrapper 已經被定位在「最終」該在的位置上）
        this.setPosition();

        // 3) 讀取 setPosition() 後的 transform，這就是「最終」的 transform
        //    例如 position = left 會是 "translateY(-50%)"
        const finalTransform = iframeWrapper.style.transform || "translate(-50%, -50%)";

        // 4) 根據 this.IframeDirection，設定「起始」的 transform
        //    讓它比最終位置更遠一點，才能做「滑入」動畫
        let startTransform = finalTransform;
        switch (this.IframeDirection) {
            case "top":
                // 例：往上多移 100%，從上方滑入
                // final: translate(-50%, -50%) => start: translate(-50%, -150%)
                startTransform = finalTransform.replace("-50%)", "-150%)");
                break;
            case "bottom":
                // 往下多移 100%，從下方滑入
                // final: translate(-50%, -50%) => start: translate(-50%, 50%)
                startTransform = finalTransform.replace("-50%)", "50%)");
                break;
            case "left":
                // 往左多移 100%，從左邊滑入
                // final: translateY(-50%) => start: translate(-150%, -50%)
                // 如果 final 是 translate(-50%, -50%)，就改成 translate(-150%, -50%)
                // 如果 final 是 translateY(-50%) 就插在最前面
                if (finalTransform.includes("translate(")) {
                    // 例: "translate(-50%, -50%)" -> "translate(-150%, -50%)"
                    startTransform = finalTransform.replace("-50%,", "-150%,");
                } else if (finalTransform.includes("translateY(")) {
                    // 例: "translateY(-50%)" -> "translate(-100%, -50%)"
                    // 視實際需求而定
                    startTransform = `translate(-100%, -50%)`;
                }
                break;
            case "right":
                // 往右多移 100%，從右邊滑入
                if (finalTransform.includes("translate(")) {
                    startTransform = finalTransform.replace("-50%,", "50%,");
                } else if (finalTransform.includes("translateY(")) {
                    startTransform = `translate(100%, -50%)`;
                }
                break;
            default:
                // 預設不做偏移，直接從原地 fade in
                break;
        }

        // 把「起始位置」套用上去
        iframeWrapper.style.transform = startTransform;
        iframeWrapper.style.opacity = "0";

        // 5) 強制 reflow，讓瀏覽器先渲染「起始位置」
        void iframeWrapper.offsetWidth;

        // 6) 打開 transition，再把 transform & opacity 設回「最終位置」 -> 產生滑入動畫
        iframeWrapper.style.transition = "all 0.3s ease-in-out";
        iframeWrapper.style.transform = finalTransform;
        iframeWrapper.style.opacity = "1";

        // 7) 等待 transition 結束
        await new Promise((resolve) => {
            const handler = () => {
                iframeWrapper.removeEventListener("transitionend", handler);
                resolve();
            };
            iframeWrapper.addEventListener("transitionend", handler);
        });

        // 8) 動畫結束後，如果要再做其他事（如 handleResize()）可在這裡做
        this.handleResize();
    };

    setFullScreen() {
        const iframeWrapper = document.getElementById("iframeWrapper");
        if (!iframeWrapper) return;

        // 進入全屏：全螢幕、固定定位、移除 margin 與圓角
        iframeWrapper.style.position = "fixed";
        iframeWrapper.style.top = "0";
        iframeWrapper.style.left = "0";
        iframeWrapper.style.width = "100vw";
        if (window.innerWidth < this.mobileWidth) {
            // 手機版的高度要注意網址列、工具列、瀏覽器頁首、頁尾
            iframeWrapper.style.height = `${window.visualViewport?.height || window.innerHeight}px`;
        } else {
            iframeWrapper.style.height = "100vh";
        }
        iframeWrapper.style.margin = "0";
        iframeWrapper.style.borderRadius = "0";
        // 如有需要，關閉 transition 避免動畫影響
        iframeWrapper.style.transition = "none";
    }
}
export default AVALoader;

// 如果在一般 Script Tag 環境 (window) 就掛到全域
if (typeof window !== "undefined") {
    window.AVALoader = AVALoader;
}
