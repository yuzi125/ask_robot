const cheerio = require("cheerio");
const TurndownService = require("turndown");
const urlModule = require("url");

// 初始化 Turndown 服務
const turndownService = new TurndownService();

/**
 * 過濾 HTML 並轉換為 Markdown
 * @param {string} html - 要過濾的 HTML 字串
 * @returns {object} - 返回過濾後的 HTML 和轉換後的 Markdown
 */
function filterAndConvertHtml(html, baseUrl) {
    // 使用 cheerio 解析 HTML
    const $ = cheerio.load(html);

    // 移除所有帶有特定屬性的標籤，例如 onclick、onmouseover 等
    $("[onclick], [onmouseover], [onmousedown]").remove();

    // 移除 href 包含 "javascript:" 的 <a> 標籤
    $('a[href^="javascript:"]').remove();

    $("script").remove();

    // 移除所有 <style> 標籤
    $("style").remove();

    // 移除所有 <a> 標籤中 href 為 "#" 的標籤
    $('a[href="#"]').remove();

    // 移除所有 <meta> 標籤
    $("meta").remove();

    // 移除所有 <input> 標籤
    $("input").remove();

    // 移除所有 <link> 標籤
    $("link").remove();

    // 移除 class 為 "toplink nosnippet" 的 <div> 標籤
    $("div.toplink.nosnippet").remove();

    // 移除 class 為 "advanced_search " 的 <div> 標籤
    $("div.advanced_search").remove();

    // 過濾掉有 onmousedown 屬性的 <a> 標籤
    $("a[onmousedown]").remove();

    // 移除所有 noscript 標籤
    $("noscript").remove();

    // 移除所有 img 標籤
    $("img").remove();

    // 移除所有 類似廣告標籤
    $(".advertisement, .footer").remove();

    // 過濾掉可能是「回上頁」功能的 <a> 標籤
    $("a").each(function () {
        const href = $(this).attr("href");
        const title = $(this).attr("title");
        const alt = $(this).find("img").attr("alt");
        // 定義圖片與影音的檔案副檔名
        const mediaFileExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|mp3|mp4|avi|mov|wmv|mkv|flv|webm)$/i;

        if (href && href.match(/^#/)) {
            $(this).remove();
        }

        if (href && mediaFileExtensions.test(href)) {
            $(this).remove();
        }

        if (href && /html=|back|return/i.test(href)) {
            $(this).remove();
        }
        if (title && /回上頁|返回|back|return/i.test(title)) {
            $(this).remove();
        }
        if (alt && /回上頁|返回|back|return/i.test(alt)) {
            $(this).remove();
        }
        if (href) {
            const fullUrl = urlModule.resolve(baseUrl, href);
            $(this).attr("href", fullUrl);
        }
    });

    // 將 <iframe> 標籤替換為其 src URL
    $("iframe").each(function () {
        const src = $(this).attr("src");
        if (src && src.match(/^https:\/\/www\.google\.com\/maps\/embed/)) {
            $(this).remove();
        }
        if (src) {
            // 在 <iframe> 標籤後插入 src 連結或純文本
            $(this).replaceWith(`<p>${src}</p>`);
        }
    });

    // 移除 src 屬性中包含 data:image/ 的 <img> 標籤
    // $("img").each(function () {
    //     let src = $(this).attr("src");
    //     const parsedUrl = new URL(baseUrl);
    //     const realBaseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    //     if (src.startsWith('/')) {
    //         if(!src.match(/^https:\/\//)){
    //             src = realBaseUrl + src;
    //             $(this).attr("src", src);
    //         }
    //     } else {
    //         if(!src.match(/^https:\/\//)){
    //             src = realBaseUrl + "/" + src;
    //             $(this).attr("src", src);
    //         }
    //     }

    //     if (src && src.match(/^data:image\/.*;base64/)) {
    //         $(this).remove();
    //     }

    // });

    // 輸出過濾後的 HTML
    let filteredHtml = $.html();
    filteredHtml = filteredHtml.replace(/\n{2,}/g, "\n");
    // (?:點閱率|點閱數|點閱次|點閱人次|點閱人數|觀看人數|觀看人次|觀看率|觀看次)[：:]\s*\d+
    filteredHtml = filteredHtml.replace(
        /(?:總|目前|累積|累計|統計)?(?:點閱|點閱率|點閱數|點閱次|點閱人次|點閱人數|觀看|觀看率|觀看次|觀看數|觀看人數|觀看人次|瀏覽|瀏覽率|瀏覽次|瀏覽人次|瀏覽人數|查看|查看率|查看次|查看人次|查看人數|點擊|點擊率|點擊次|點擊人次|點擊人數|閱讀|閱讀率|閱讀次|閱讀人次|閱讀人數|累積|累積率|累積次|累積人次|累積人數|到站|到站率|到站次|到站人次|到站人數|到訪|到訪人數|到訪人次|到訪次|訪問|訪問人次|訪問人數|訪問數)(?:[：:－\-＞>]\s*|\s*)\d+/g,
        ""
    );
    // 將過濾後的 HTML 轉換為 Markdown
    let markdown = turndownService.turndown(filteredHtml);

    markdown = markdown
        .trim() // 先去除前後空白
        .replace(/(\r?\n\s*){2,}/g, "\n") // 連續兩個以上的換行變為單個
        .replace(/ {3,}/g, " "); // 三個以上的空格變為單個

    return {
        filteredHtml,
        markdown,
    };
}

/**
 * 將前端站點資料映射到 Crawler 模型的欄位格式
 * @param {Object} site - 前端傳來的站點資料
 * @returns {Object} - 映射後適合 Crawler 模型的資料
 */
function mapSiteToCrawler(site) {
    // 基本欄位映射

    const crawlerData = {
        id: site.id,
        is_show: site.active ? 1 : 0, // 將 boolean 轉換為 0/1
        domain: site.url,
        title: site.site_name,
        site_id: site.site_id,
        crawler_type_id: 1, // 固定值，根據需要調整
        use_selenium: 0, // 根據爬蟲模式判斷是否使用 selenium
        download_attachment: site.download_attachment ? 1 : 0,
    };

    // 如果存在別名，則加入映射
    if (site.alias) {
        crawlerData.alias = site.alias;
    }

    // 準備 config_jsonb 欄位
    const configJsonb = {};

    // 將所有沒有直接映射的欄位放入 config_jsonb
    const directMappingKeys = ["id", "active", "url", "site_name", "site_id", "alias"];
    Object.keys(site).forEach((key) => {
        if (!directMappingKeys.includes(key)) {
            configJsonb[key] = site[key];
        }
    });

    crawlerData.config_jsonb = configJsonb;

    return crawlerData;
}

module.exports = { filterAndConvertHtml, mapSiteToCrawler };
