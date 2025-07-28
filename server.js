// 【server.js 完全版・最終確定】

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
const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, getDoc, deleteDoc } = require('firebase/firestore');

// --- 2. Expressサーバーの準備 ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ['websocket', 'polling'],
    pingInterval: 10000,
    pingTimeout: 5000,
});
app.use(express.json());

// --- 3. 外部サービスの設定 ---
const firebaseConfig = { apiKey: "AIzaSyCSXWUV4OnvDco44l14fGqT-IZawlWjdcQ",
authDomain: "my-chat-app-tomo.firebaseapp.com",
projectId: "my-chat-app-tomo",
storageBucket: "my-chat-app-tomo.appspot.com",
messagingSenderId: "922389757998",
appId: "1:922389757998:web:4907bcaaeeee7a7d4f9fbf"};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
cloudinary.config({cloud_name:"dmo5bvnlk",
api_key: "149631492483621",
api_secret: "LfHS3WuP90Nxpo_AmSf81h6Wuto",});
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- 4. 認証ユーザーリスト ---
const authorizedUsers = { "トモ": "pass123", "ディシ": "ai456", "ゲスト": "guest789" };

// --- 5. ファイル配信設定 ---
app.use(express.static(__dirname));
app.get('/', (req, res) => { res.redirect('/login.html'); });

// --- 6. 各種API（窓口）の設定 ---
app.post('/login', (req, res) => { /* ... (変更なし) ... */ });
app.post('/upload-image', upload.single('image'), (req, res) => { /* ... (変更なし) ... */ });
app.get('/download-image', async (req, res) => { /* ... (変更なし) ... */ });
app.get('/get-theme', async (req, res) => { /* ... (変更なし) ... */ });

// --- 7. WebSocket (Socket.IO) の処理 ---
// server.js のセクション7を、これでまるごと上書き

// --- 7. WebSocket (Socket.IO) の処理 ---
io.on('connection', (socket) => {
    console.log(`ユーザーが接続しました: ${socket.id}`);

    // 1. 接続時に、まず過去ログを送信する
    (async () => {
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
    })();

    // 2. これから発生するイベントに備えて、リスナーを登録する
    socket.on('chat message', async (data) => {
        const messagesRef = collection(db, 'messages');
        const newDocRef = doc(messagesRef);
        const messageToBroadcast = {
            id: newDocRef.id,
            text: data.message,
            username: data.username,
            createdAt: new Date(),
            isImage: data.isImage || false,
        };
        try {
            await setDoc(newDocRef, messageToBroadcast);
            io.emit('chat message', messageToBroadcast);
        } catch (e) {
            console.error("メッセージ保存エラー:", e);
        }
    });

    socket.on('theme change', async (newTheme) => {
        try {
            const themeRef = doc(db, 'settings', 'theme');
            await setDoc(themeRef, { text: newTheme, updatedAt: new Date() });
            io.emit('theme updated', newTheme);
            console.log(`テーマが "${newTheme}" に更新されました。`);
        } catch (e) {
            console.error("テーマの更新に失敗しました:", e);
        }
    });

    socket.on('delete message', async (messageId) => {
        if (!messageId) return;
        try {
            const messageRef = doc(db, 'messages', messageId);
            await deleteDoc(messageRef);
            io.emit('message deleted', messageId);
            console.log(`メッセージが削除されました: ${messageId}`);
        } catch (e) {
            console.error("メッセージの削除に失敗しました:", e);
        }
    });

    socket.on('disconnect', () => {
        console.log(`ユーザーが切断しました: ${socket.id}`);
    });
});

// --- 8. サーバーを起動 ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`サーバーがポート ${PORT} で起動しました`);
});
