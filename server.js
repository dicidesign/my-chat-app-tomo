// 必要なライブラリを読み込む
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } = require('firebase/firestore');

// Expressサーバーを準備
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// cloudinaryライブラリ(画像保存庫)の読み込みを追加

// --- ↓↓↓ ここから追加 ↓↓↓ ---
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { Readable } = require('stream');
// --- ↑↑↑ ここまで追加 ---

// --- Firebaseの接続設定 ---
// トモが取得した、あなた専用の設定情報
const firebaseConfig = {
  apiKey: "AIzaSyCSXWUV4OnvDco44l14fGqT-IZawlWjdcQ",
  authDomain: "my-chat-app-tomo.firebaseapp.com",
  projectId: "my-chat-app-tomo",
  storageBucket: "my-chat-app-tomo.appspot.com", // ここだけ少し変更したよ
  messagingSenderId: "922389757998",
  appId: "1:922389757998:web:4907bcaaeeee7a7d4f9fbf"
};

// Firebaseを初期化して、データベースに接続
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
// --- ここまでがFirebaseの設定 ---

// Cloudinaryの設定（Renderの環境変数から読み込む）
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multerの設定（メモリに一時的にファイルを保存する設定）
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// --- ↑↑↑ ここまで追加 ---



// CSSやクライアント用JSファイルを配信できるようにする設定
app.use(express.static(__dirname));

// ルートURLにアクセスが来たら、login.htmlを返す
app.get('/', (req, res) => {
  res.redirect('/login.html');
});


// --- ↓↓↓ ここからが認証チェック機能 ↓↓↓ ---

// 1. 正解のユーザーリストを定義
const authorizedUsers = {
    "トモ": "pass123",
    "ディシ": "ai456",
    // ここに許可したいユーザーを追加していける
    "ゲスト": "guest789"
};

// 2. '/login' というURLへの問い合わせ（POSTリクエスト）に対応する設定
app.use(express.json()); // POSTリクエストのbodyを解析するのに必要
app.post('/login', (req, res) => {
    const { username, password } = req.body; // クライアントから送られてきたユーザー名とパスワード

    // ユーザー名が存在し、かつパスワードが一致するかチェック
    if (authorizedUsers[username] && authorizedUsers[username] === password) {
        // 認証成功
        console.log(`認証成功: ${username}`);
        res.json({ success: true });
    } else {
        // 認証失敗
        console.log(`認証失敗: ${username}`);
        res.json({ success: false, message: 'ユーザー名またはパスワードが違います。' });
    }
});
// --- ↑↑↑ ここまでが認証チェック機能 ---

// --- ↓↓↓ ここから追加 ↓↓↓ ---
// '/upload-image' というURLに画像がPOSTされたときの処理
app.post('/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '画像ファイルがありません。' });
    }

    // ファイルをCloudinaryにアップロード
    const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (error, result) => {
            if (error) {
                console.error('Cloudinaryへのアップロードエラー:', error);
                return res.status(500).json({ error: 'アップロードに失敗しました。' });
            }
            // 成功したら、画像のURLをクライアントに返す
            res.json({ imageUrl: result.secure_url });
        }
    );

    // メモリ上のファイルをストリームに変換してアップロードを実行
    const stream = Readable.from(req.file.buffer);
    stream.pipe(uploadStream);
});
// --- ↑↑↑ ここまで追加 ---

// WebSocketの接続があったときの処理
io.on('connection', async (socket) => {
  console.log('ユーザーが接続しました');

  // 接続時に、Firestoreから過去のメッセージを50件取得して送る
  try {
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const oldMessages = [];
    querySnapshot.forEach((doc) => {
      oldMessages.unshift(doc.data());
    });
    socket.emit('load old messages', oldMessages); // 接続した本人にだけ送信
  } catch (e) {
    console.error("過去のメッセージ取得エラー: ", e);
  }

  // 接続が切れたときの処理
  socket.on('disconnect', () => {
    console.log('ユーザーが切断しました');
  });

  // 'chat message'イベントを受け取ったときの処理
 // server.js の該当部分をこれに差し替え

socket.on('chat message', async (data) => {
  // 送信されてきたデータを、DBに保存する形に整える
  const messageToStore = {
    text: data.message,
    username: data.username,
    createdAt: new Date()
  };

  // 1. Firestoreにメッセージを保存
  try {
    await addDoc(collection(db, 'messages'), messageToStore);
  } catch (e) {
    console.error("メッセージ保存エラー: ", e);
  }
  
  // 2. 接続している全員に、DBと同じ形のデータを送信
  io.emit('chat message', messageToStore); // ←←← ここが修正ポイント！
});
});


// サーバーを3000番ポートで起動
server.listen(3000, () => {
  console.log('サーバーがポート3000で起動しました http://localhost:3000');
});
