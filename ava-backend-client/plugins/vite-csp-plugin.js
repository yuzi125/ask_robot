export function cspHashPlugin() {
    return {
        name: "vite-plugin-csp",
        transformIndexHtml(html, ctx) {
            const nonce = "rAnd0m123";

            const initScript = `
                <script nonce="${nonce}">
                    window.__CSP_NONCE__ = "${nonce}";
                    (function() {
                        // 替換原始的 createElement 方法來自動添加 nonce
                        const originalCreateElement = document.createElement;
                        document.createElement = function(tagName) {
                            const element = originalCreateElement.call(document, tagName);
                            if (tagName.toLowerCase() === 'style' || 
                                tagName.toLowerCase() === 'link' || 
                                tagName.toLowerCase() === 'script') {
                                element.setAttribute('nonce', "${nonce}");
                            }
                            return element;
                        };

                        // 監視 DOM 變化
                        const observer = new MutationObserver(function(mutations) {
                            mutations.forEach(function(mutation) {
                                mutation.addedNodes.forEach(function(node) {
                                    if (node.nodeType === 1) {
                                        if (node.tagName === 'STYLE' || 
                                            node.tagName === 'LINK' || 
                                            node.tagName === 'SCRIPT') {
                                            node.setAttribute('nonce', "${nonce}");
                                        }
                                        node.querySelectorAll('style, link[rel="stylesheet"], script')
                                            .forEach(el => el.setAttribute('nonce', "${nonce}"));
                                    }
                                });
                            });
                        });

                        observer.observe(document.documentElement, {
                            childList: true,
                            subtree: true
                        });

                        // 處理已存在的元素
                        document.querySelectorAll('style, link[rel="stylesheet"], script')
                            .forEach(el => el.setAttribute('nonce', "${nonce}"));

                        // 針對 Font Awesome 的特殊處理
                        if (window.FontAwesome) {
                            const originalAddCss = window.FontAwesome.dom.css;
                            window.FontAwesome.dom.css = function() {
                                const style = originalAddCss.apply(this, arguments);
                                if (style && style.setAttribute) {
                                    style.setAttribute('nonce', "${nonce}");
                                }
                                return style;
                            };
                        }
                    })();
                </script>
            `;

            const cspMeta = `
                <meta http-equiv="Content-Security-Policy" content="
                    default-src 'self';
                    style-src 'self' 
                        'nonce-${nonce}'
                        'unsafe-hashes'
                       
                        https://fonts.googleapis.com 
                        https://use.fontawesome.com 
                        https://*.kcg.gov.tw 
                        https://*.icsc.com.tw;
                    script-src 'self' 
                        'nonce-${nonce}' 
                        'unsafe-eval'
                        'unsafe-hashes'
                       
                        https://*.kcg.gov.tw 
                        https://*.icsc.com.tw;
                    font-src 'self' data: 
                        https://fonts.gstatic.com 
                        https://use.fontawesome.com;
                    img-src 'self' data: https: blob:;
                    connect-src 'self' https:;
                    worker-src 'self' blob:;
                    object-src 'none';
                    base-uri 'self';
                ">
            `;

            html = html.replace(/<style/g, `<style nonce="${nonce}"`);
            html = html.replace(/<script/g, `<script nonce="${nonce}"`);
            html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/g, (match) =>
                match.includes("nonce=") ? match : match.replace(">", ` nonce="${nonce}">`)
            );

            return html.replace(/<head>/i, `<head>${cspMeta}${initScript}`);
        },
    };
}
