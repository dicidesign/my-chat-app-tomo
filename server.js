// 【server.js 省略なし・偵察用・完全版】
require('dotenv').config();

// --- 1. 必要なライブラリ ---
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, limit, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');

// --- 2. Expressアプリとサーバー、Socket.IOを初期化 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] }, transports: ['websocket', 'polling'], pingInterval: 10000, pingTimeout: 5000 });

// --- 3. 外部サービスの設定 ---
const firebaseConfig = { apiKey: "AIzaSyCSXWUV4OnvDco44l14fGqT-IZawlWjdcQ", authDomain: "my-chat-app-tomo.firebaseapp.com", projectId: "my-chat-app-tomo", storageBucket: "my-chat-app-tomo.appspot.com", messagingSenderId: "922389757998", appId: "1:922389757998:web:4907bcaaeeee7a7d4f9fbf"};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
cloudinary.config({cloud_name:"dmo5bvnlk", api_key: "149631492483621", api_secret: "LfHS3WuP90Nxpo_AmSf81h6Wuto"});
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 4. ミドルウェアの設定 ---
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- 5. 認証ユーザーリスト ---
const authorizedUsers = { "トモ": "pass123", "ディシ": "ai456", "ゲスト": "guest789" };

// --- 6. HTTPルーティング ---
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.get('/get-summarized-news', async (req, res) => {
    console.log("========================================");
    console.log("[偵察開始] /get-summarized-news APIが呼び出されました。");
    try {
        const newsApiUrl = `https://newsapi.org/v2/top-headlines?country=jp&apiKey=${process.env.NEWS_API_KEY}`;
        console.log("[偵察] NewsAPIへのリクエストURL:", newsApiUrl.replace(process.env.NEWS_API_KEY, "【API_KEY_HIDDEN】"));
        const newsResponse = await axios.get(newsApiUrl);
        console.log("[偵察] NewsAPIからのレスポンスステータス:", newsResponse.status);
        console.log("[偵察] 取得した記事の数:", newsResponse.data.articles.length);
        const articles = newsResponse.data.articles.slice(0, 5);
        const titles = articles.map(article => article.title).join('\n');
        console.log("[偵察] Geminiに渡すタイトル群:\n---\n" + titles + "\n---");
        if (!titles || titles.trim() === '') {
            console.error("[エラー] NewsAPIから記事タイトルを取得できませんでした。");
            return res.status(500).json({ success: false, message: 'NewsAPIから記事タイトルを取得できませんでした。' });
        }
        console.log("[偵察] Geminiに要約を依頼します...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `以下のニュースタイトルリストを、それぞれ最大20文字程度の超短文に要約して、箇条書きで5つ返してください。\n\n${titles}`;
        const result = await model.generateContent(prompt);
        const summarizedText = await result.response.text();
        console.log("[偵察] Geminiからの要約結果:\n---\n" + summarizedText + "\n---");
        res.json({ success: true, summarizedNews: summarizedText.split('\n') });
        console.log("[偵察完了] クライアントにレスポンスを返しました。");
        console.log("========================================");
    } catch (error) {
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('[致命的エラー] ニュースの取得または要約中にエラーが発生しました:', error.message);
        if (error.response) { console.error('エラーレスポンス:', error.response.data); }
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ success: false, message: 'ニュースの取得に失敗しました。' });
    }
});
app.get('/', (req, res) => { res.redirect('/login.html'); });
app.post('/login', (req, res) => { const { username, password } = req.body; if (authorizedUsers[username] && authorizedUsers[username] === password) { res.json({ success: true }); } else { res.json({ success: false, message: 'ユーザー名またはパスワードが違います。' }); } });
app.get('/get-theme', async (req, res) => { try { const themeRef = doc(db, 'settings', 'theme'); const docSnap = await getDoc(themeRef); if (docSnap.exists()) { res.json({ success: true, theme: docSnap.data().text }); } else { res.json({ success: true, theme: 'リスとくるみ' }); } } catch (e) { res.status(500).json({ success: false, message: 'テーマの取得に失敗しました。' }); } });
app.post('/upload-file', upload.single('file'), (req, res) => { if (!req.file) return res.status(400).json({ error: 'ファイルがありません。' }); const uploadOptions = { resource_type: "auto" }; const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => { if (error) { return res.status(500).json({ error: 'アップロードに失敗しました。' }); } res.json({ secure_url: result.secure_url, resource_type: result.resource_type }); }); Readable.from(req.file.buffer).pipe(uploadStream); });
app.get('/download-image', async (req, res) => { const { url: imageUrl } = req.query; if (!imageUrl) return res.status(400).send('Image URL is required'); try { const response = await axios.get(imageUrl, { responseType: 'arraybuffer' }); res.setHeader('Content-Disposition', 'attachment; filename="download.jpg"'); res.setHeader('Content-Type', 'image/jpeg'); res.send(response.data); } catch (error) { console.error('Download error:', error); res.status(500).send('Failed to download image'); } });
io.on('connection', async (socket) => { try { const messagesRef = collection(db, 'messages'); const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50)); const querySnapshot = await getDocs(q); const oldMessages = []; querySnapshot.forEach((doc) => { oldMessages.unshift({ id: doc.id, ...doc.data() }); }); socket.emit('load old messages', oldMessages); } catch (e) { console.error("過去ログ取得エラー:", e); } socket.on('chat message', async (data) => { const messagesRef = collection(db, 'messages'); const newDocRef = doc(messagesRef); const messageToBroadcast = { id: newDocRef.id, text: data.message, username: data.username, createdAt: new Date(), isImage: data.isImage || false, isVoice: data.isVoice || false }; try { await setDoc(newDocRef, messageToBroadcast); io.emit('chat message', messageToBroadcast); } catch (e) { console.error("メッセージ保存エラー:", e); } }); socket.on('theme change', async (newTheme) => { try { const themeRef = doc(db, 'settings', 'theme'); await setDoc(themeRef, { text: newTheme, updatedAt: new Date() }); io.emit('theme updated', newTheme); } catch (e) { console.error("テーマの更新に失敗しました:", e); } }); socket.on('delete message', async (messageId) => { if (!messageId) return; try { const messageRef = doc(db, 'messages', messageId); await deleteDoc(messageRef); io.emit('message deleted', messageId); } catch (e) { console.error("メッセージの削除に失敗しました:", e); } }); socket.on('disconnect', () => { console.log(`ユーザーが切断しました: ${socket.id}`); }); });
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`サーバーがポート ${PORT} で起動しました`); });
