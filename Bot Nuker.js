// ==UserScript==
// @name         X Bot Nuker
// @namespace    http://tampermonkey.net/
// @version      4.9
// @description  Hides non-media tweets, ANY tweets with links, spam keywords (including trans/femboy), and forces tab activity
// @author       Grok
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    const ALLOW_LINKS_IN_MEDIA_POSTS = false;

    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    const blockEvent = e => { e.stopImmediatePropagation(); e.stopPropagation(); };
    ['visibilitychange', 'webkitvisibilitychange', 'blur', 'pagehide'].forEach(eventName => {
        window.addEventListener(eventName, blockEvent, true);
        document.addEventListener(eventName, blockEvent, true);
    });
    window.addEventListener('focus', e => { e.stopImmediatePropagation(); e.stopPropagation(); }, true);
    setInterval(() => { window.dispatchEvent(new Event('focus')); }, 1000);

    const mediaSelectors = [
        '[data-testid="tweetPhoto"]',
        '[data-testid="videoPlayer"]',
        '[aria-label="Image"]'
    ].join(', ');

    const spamRegex = /(sexy chat|shemale|femboy|trans|natalie mars|\bts\b|privat sex|dating|click here)/i;

    const hide = el => {
        if (!el) return;
        el.style.cssText = 'display:none !important; visibility:hidden !important; opacity:0 !important; height:0 !important; margin:0 !important; padding:0 !important;';
    };

    const killTweet = tweet => {
        if (tweet._killed) return;
        tweet._killed = true;
        const cell = tweet.closest('div[data-testid="cellInnerDiv"]');
        if (cell) hide(cell);
    };

    const scan = () => {
        document.querySelectorAll('article[data-testid="tweet"]').forEach(tweet => {

            const hasMedia = tweet.querySelector(mediaSelectors);

            const isSensitiveHidden = tweet.innerText.includes("potentially sensitive content") || tweet.innerText.includes("Show");

            if (!hasMedia && !isSensitiveHidden) {
                killTweet(tweet);
                return;
            }

            const userNameNode = tweet.querySelector('[data-testid="User-Name"]');
            const tweetTextNode = tweet.querySelector('[data-testid="tweetText"]');
            const textContent = (userNameNode?.innerText + " " + tweetTextNode?.innerText).toLowerCase();

            if (spamRegex.test(textContent)) {
                killTweet(tweet);
                return;
            }

            if (!ALLOW_LINKS_IN_MEDIA_POSTS) {
                if (tweetTextNode && tweetTextNode.querySelector('a[href^="https://t.co/"]')) {
                    killTweet(tweet);
                    return;
                }
            }

            if (tweet.querySelector('[data-testid="card.wrapper"]')) {
                killTweet(tweet);
                return;
            }
        });
    };

    new MutationObserver(mutations => {
        let shouldScan = false;
        for (const m of mutations) {
            if (m.addedNodes.length) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) scan();
    }).observe(document, { childList: true, subtree: true });

    setInterval(scan, 1000);
})();
