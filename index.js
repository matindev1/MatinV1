import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import fs from 'fs';

const puppeteerConfig = {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new'
};

// Tokenی بۆتەکەت لێرە دابنێ
const token = '7439944549:AAHDZsF5SJXcCIqA9Zo5zvh_MZ6-iZjTJ0U';
const bot = new TelegramBot(token, { polling: true });

// زمانەکان
const languages = {
    en: {
        welcome: 'Welcome! Send a TikTok or Instagram video link to download.',
        invalidLink: 'The link is invalid or not supported.',
        videoDownloaded: 'Video downloaded successfully!',
        error: 'Error: Unable to download the video.',
        languageSet: 'Language set to English.',
        chooseLanguage: 'Choose your language:',
        downloadStarted: 'Starting download, please wait...',
        processingVideo: 'Processing video...',
        help: 'Send me any TikTok or Instagram video link to download it.'
    },
    ku: {
        welcome: 'بەخێربێیت! لینکی ڤیدیۆی TikTok یان Instagram بنێرە بۆ داگرتن.',
        invalidLink: 'لینکەکە نادروستە یان پشتگیری ناکرێت.',
        videoDownloaded: 'ڤیدیۆکە بەسەرکەوتووی دابەزێنرا!',
        error: 'هەڵە: نەتوانرا ڤیدیۆکە دابگیرێت.',
        languageSet: 'زمان گۆڕدرا بۆ کوردی.',
        chooseLanguage: 'زمانەکەت هەڵبژێرە:',
        downloadStarted: 'داگرتن دەستی پێکرد، تکایە چاوەڕێ بکە...',
        processingVideo: 'خەریکی پرۆسێسکردنی ڤیدیۆکەیە...',
        help: 'لینکی ڤیدیۆی TikTok یان Instagram بنێرە بۆ داگرتنی'
    },
    ar: {
        welcome: 'مرحبًا! أرسل رابط فيديو TikTok أو Instagram للتنزيل.',
        invalidLink: 'الرابط غير صالح أو غير مدعوم.',
        videoDownloaded: 'تم تنزيل الفيديو بنجاح!',
        error: 'خطأ: تعذر تنزيل الفيديو.',
        languageSet: 'تم تغيير اللغة إلى العربية.',
        chooseLanguage: 'اختر لغتك:',
        downloadStarted: 'بدأ التحميل، يرجى الانتظار...',
        processingVideo: 'جاري معالجة الفيديو...',
        help: 'أرسل لي رابط فيديو TikTok أو Instagram لتنزيله'
    },
};

// زمانەکانی بەکارهێنەران
let userLanguage = {};

// Commands menu
const commands = [
    { command: 'start', description: 'Start the bot' },
    { command: 'language', description: 'Change language (English/Kurdish/Arabic)' },
    { command: 'menu', description: 'Show all available commands' }
];

bot.setMyCommands(commands);

// فەرمانی /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userLanguage[chatId] = 'en'; // زمانێکی بنەڕەتی دیاری بکە
    bot.sendMessage(chatId, languages[userLanguage[chatId]].welcome);
});

// Menu command
bot.onText(/\/menu/, (msg) => {
    const chatId = msg.chat.id;
    const menuText = 'Available Commands:\n\n' +
        '/start - Start the bot\n' +
        '/language - Change language (English/Kurdish/Arabic)\n' +
        '/menu - Show this menu\n\n' +
        'You can also send any TikTok or Instagram video link to download it.';
    bot.sendMessage(chatId, menuText);
});

// فەرمانی /language
bot.onText(/\/language/, (msg) => {
    const chatId = msg.chat.id;
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'English', callback_data: 'en' }],
                [{ text: 'Kurdî', callback_data: 'ku' }],
                [{ text: 'العربية', callback_data: 'ar' }],
            ],
        },
    };
    bot.sendMessage(chatId, 'Choose your language / زمانەکەت هەڵبژێرە / اختر لغتك:', options);
});

// چاودێریکردنی هەڵبژاردنی زمان
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const language = query.data;
    userLanguage[chatId] = language;
    bot.sendMessage(chatId, languages[language].languageSet);
});

// چاودێریکردنی نامەکان
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const url = msg.text;

    // Set default language if not set
    if (!userLanguage[chatId]) {
        userLanguage[chatId] = 'en';
    }

    // ئەگەر نامەکە لینک نەبوو
    if (!url.startsWith('http')) return;

    if (url.includes('tiktok.com')) {
        try {
            // داگرتنی ڤیدیۆی TikTok
            const apiUrl = `https://www.tikwm.com/api/?url=${url}`;
            const response = await fetch(apiUrl);
            const data = await response.json();
            const videoUrl = data.data.play;

            const videoResponse = await fetch(videoUrl);
            const filePath = `tiktok_video.mp4`;
            const writer = fs.createWriteStream(filePath);

            videoResponse.body.pipe(writer);

            writer.on('finish', () => {
                bot.sendVideo(chatId, filePath).then(() => {
                    fs.unlinkSync(filePath); // فایلەکە بسڕەوە دوای ناردن
                    bot.sendMessage(chatId, languages[userLanguage[chatId]].videoDownloaded);
                });
            });

            writer.on('error', (err) => {
                bot.sendMessage(chatId, languages[userLanguage[chatId]].error);
            });
        } catch (err) {
            bot.sendMessage(chatId, `${languages[userLanguage[chatId]].error}: ${err.message}`);
        }
    } else if (url.includes('instagram.com')) {
        let browser;
        try {
            // داگرتنی ڤیدیۆی Instagram
            browser = await puppeteer.launch(puppeteerConfig);
            const page = await browser.newPage();
            
            // Set user agent to mimic real browser
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36');
            
            await page.setRequestInterception(true);
            
            let videoUrl = null;
            
            page.on('request', request => {
                if (request.resourceType() === 'media' || request.url().includes('.mp4')) {
                    videoUrl = request.url();
                }
                request.continue();
            });

            await page.goto(url, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            await page.waitForSelector('video', { timeout: 5000 });
            
            if (!videoUrl) {
                videoUrl = await page.evaluate(() => {
                    const videoElement = document.querySelector('video');
                    const sourceElement = document.querySelector('source');
                    return videoElement?.src || sourceElement?.src || null;
                });
            }

            if (!videoUrl) {
                throw new Error(languages[userLanguage[chatId]].error);
            }

            const videoResponse = await fetch(videoUrl);
            const filePath = `instagram_video_${Date.now()}.mp4`;
            const writer = fs.createWriteStream(filePath);

            videoResponse.body.pipe(writer);

            writer.on('finish', () => {
                bot.sendVideo(chatId, filePath).then(() => {
                    fs.unlinkSync(filePath);
                    bot.sendMessage(chatId, languages[userLanguage[chatId]].videoDownloaded);
                }).catch(err => {
                    bot.sendMessage(chatId, languages[userLanguage[chatId]].error);
                    fs.unlinkSync(filePath);
                });
            });

            writer.on('error', (err) => {
                bot.sendMessage(chatId, languages[userLanguage[chatId]].error);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });

            await browser.close();
        } catch (err) {
            await browser?.close();
            bot.sendMessage(chatId, languages[userLanguage[chatId]].error);
            console.error('Instagram download error:', err);
        }
    } else {
        bot.sendMessage(chatId, languages[userLanguage[chatId]].invalidLink);
    }
});

console.log('بۆتەکە دەستیپێکرد...');
