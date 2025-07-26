// サーバーに接続
const socket = io();

// HTMLから操作したい要素を取得
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input'); // ←←← ここを追加！

// sessionStorageからユーザー名を取得
const storedUsername = sessionStorage.getItem('chatUsername');

if (!storedUsername) {
    // 【ユーザー名がない場合】
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html';
} else {
    // 【ユーザー名がある場合】
    
    let currentUsername = storedUsername;

    const displayMessage = (data) => {
    if (!data || typeof data.text !== 'string' || typeof data.username !== 'string') {
        console.error('[displayMessage] データ形式が不正です。スキップします。', data);
        return;
    }

    const item = document.createElement('li');

    // ★★★ここからが大きな変更点★★★
    if (data.isImage) {
        // メッセージが画像の場合
        const img = document.createElement('img');
        img.src = data.text; // data.text には画像のURLが入っている
        img.style.maxWidth = '100%'; // 吹き出しからはみ出ないように
        img.style.borderRadius = '10px'; // 少し角を丸く
        img.onload = () => {
            // 画像が読み込み終わったら、一番下までスクロール
            window.scrollTo(0, document.body.scrollHeight);
        };
        item.appendChild(img);
    } else {
        // メッセージがテキストの場合
        item.textContent = data.text;
    }
    // ★★★ここまでが大きな変更点★★★

    // 自分のメッセージか、相手のメッセージかでクラスを振り分け
    if (data.username === currentUsername) {
        item.classList.add('me');
        messages.appendChild(item);
    } else {
        const nameLabel = document.createElement('div');
        nameLabel.textContent = data.username;
        nameLabel.className = 'name-label';
        item.classList.add('opponent');
        messages.appendChild(nameLabel);
        messages.appendChild(item);
    }

    // テキストメッセージの場合は、すぐにスクロール
    if (!data.isImage) {
        window.scrollTo(0, document.body.scrollHeight);
    }
};

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
            const messageData = {
                message: input.value,
                username: currentUsername
                // isImage: false は不要（テキストには付けない）
            };
            socket.emit('chat message', messageData);
            input.value = '';
        }
    });

    socket.on('load old messages', (serverMessages) => {
        messages.innerHTML = '';
        serverMessages.forEach(msg => {
            displayMessage(msg);
        });
    });

    socket.on('chat message', (data) => {
        displayMessage(data);
    });

    // --- ↓↓↓ ここからが、まるごと追加する画像アップロード機能 ↓↓↓ ---
    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // FormDataオブジェクトを作成
        const formData = new FormData();
        formData.append('image', file); // 'image'という名前でファイルを追加

        // アップロード中は入力欄を無効にする
        input.disabled = true;
        input.placeholder = '画像をアップロード中...';

        try {
            // 1. サーバーの/upload-imageに画像を送信
            const response = await fetch('/upload-image', {
                method: 'POST',
                body: formData, // FormDataをbodyに設定
            });

            if (!response.ok) {
                // サーバーからのエラー応答を処理
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'サーバーでのアップロードに失敗しました。');
            }

            const result = await response.json();
            const imageUrl = result.imageUrl;

            // 2. 取得した画像URLをチャットメッセージとして送信
            const messageData = {
                message: imageUrl,
                username: currentUsername,
                isImage: true // 画像メッセージであるという目印
            };
            socket.emit('chat message', messageData);

        } catch (error) {
            console.error('画像アップロードに失敗しました:', error);
            alert('画像アップロードに失敗しました。');
        } finally {
            // 成功しても失敗しても、入力欄を元に戻す
            input.disabled = false;
            input.placeholder = 'メッセージを入力';
            imageInput.value = ''; // 次のファイルを選択できるようにリセット
        }
    });
    // --- ↑↑↑ ここまでが追加部分 ---
}