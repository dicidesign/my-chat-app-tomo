// 【server.js 最終版・完全体 for Render】

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
const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } = require('firebase/firestore');

// --- 2. Expressサーバーの準備 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());

// --- 3. 外部サービスの設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyCSXWUV4OnvDco44l14fGqT-IZawlWjdcQ",
  authDomain: "my-chat-app-tomo.firebaseapp.com",
  projectId: "my-chat-app-tomo",
  storageBucket: "my-chat-app-tomo.appspot.com",
  messagingSenderId: "922389757998",
  appId: "1:922389757998:web:4907bcaaeeee7a7d4f9fbf"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

cloudinary.config({
    cloud_name:"dmo5bvnlk",
    api_key: "149631492483621",
    api_secret: "LfHS3WuP90Nxpo_AmSf81h6Wuto",
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 4. 認証ユーザーリスト ---
const authorizedUsers = { "トモ": "pass123", "ディシ": "ai456", "ゲスト": "guest789" };

// --- 5. ファイル配信設定（Render完全対応・改） ---
// このプロジェクトのルートフォルダを静的ファイルの配信元として設定
app.use(express.static(__dirname));

// ルートURL ('/') にアクセスがあったら、login.html にリダイレクト（転送）する
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// --- 6. 各種API（窓口）の設定 ---
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (authorizedUsers[username] && authorizedUsers[username] === password) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'ユーザー名またはパスワードが違います。' });
    }
});
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '画像ファイルがありません。' });
    const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
        if (error) return res.status(500).json({ error: 'アップロードに失敗しました。' });
        res.json({ imageUrl: result.secure_url });
    });
    Readable.from(req.file.buffer).pipe(uploadStream);
});
app.get('/download-image', async (req, res) => {
    const { url: imageUrl } = req.query;
    if (!imageUrl) return res.status(400).send('Image URL is required');
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        res.setHeader('Content-Disposition', 'attachment; filename="download.jpg"');
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(response.data);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).send('Failed to download image');
    }
});

// --- 7. WebSocket (Socket.IO) の処理 ---
io.on('connection', async (socket) => {
    try {
        const messagesRef = collection(db, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        const oldMessages = [];
        querySnapshot.forEach((doc) => oldMessages.unshift(doc.data()));
        socket.emit('load old messages', oldMessages);
    } catch (e) {
        console.error("過去ログ取得エラー:", e);
    }
    socket.on('chat message', async (data) => {
        const messageToBroadcast = {
            text: data.message,
            username: data.username,
            createdAt: new Date(),
            isImage: data.isImage || false,
        };
        try {
            await addDoc(collection(db, 'messages'), messageToBroadcast);
            io.emit('chat message', messageToBroadcast);
        } catch (e) {
            console.error("メッセージ保存エラー:", e);
        }
    });
});

// --- 8. サーバーを起動 ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});
