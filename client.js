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

    // client.js の displayMessage 関数をこれで上書き

const displayMessage = (data) => {
    if (!data || typeof data.text !== 'string' || typeof data.username !== 'string') {
        console.error('[displayMessage] データ形式が不正です。スキップします。', data);
        return;
    }

    const item = document.createElement('li');

    // ★★★ここが修正ポイント★★★
    // 新しいスクロール関数
    const scrollToBottom = () => {
        // --- ↓↓↓ ここからがデバッグコード ↓↓↓ ---
    console.log("--- スクロール実行 ---");
    console.log("新しいメッセージ(item)の高さ:", item.offsetHeight);
    console.log("メッセージリスト(#messages)の高さ:", messages.scrollHeight);
    console.log("ウィンドウの内側の高さ:", window.innerHeight);
    console.log("ページ全体の高さ:", document.body.scrollHeight);
    // --- ↑↑↑ ここまでがデバッグコード ---

    // item（新しく追加されたメッセージ要素）が画面に見えるようにスクロールする
        item.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };

    if (data.isImage) {
        const img = document.createElement('img');
        img.src = data.text;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';
        
        img.onload = scrollToBottom;
        if (img.complete) {
            scrollToBottom();
        }
        
        item.appendChild(img);
    } else {
        item.textContent = data.text;
    }

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

    if (!data.isImage) {
        scrollToBottom();
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

    // client.js の socket.on('load old messages', ...) をこれで上書き

    socket.on('load old messages', (serverMessages) => {
    messages.innerHTML = '';
    serverMessages.forEach(msg => {
        displayMessage(msg);
    });

    // ★★★ここが修正ポイント★★★
    // 最後のメッセージ要素を取得して、そこまでスクロール
    const lastMessage = messages.lastElementChild;
    if (lastMessage) {
        lastMessage.scrollIntoView({ block: 'end' });
    }
});

    socket.on('chat message', (data) => {
        displayMessage(data);
    });

    // --- ↓↓↓ ここからが、まるごと追加する画像アップロード機能 ↓↓↓ ---
    
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // FileReaderを使って、選択した画像をプレビュー用に読み込む
    const reader = new FileReader();
    reader.onload = (event) => {
        const previewImageUrl = event.target.result;

        // ★★★ここが確認ダイアログの部分★★★
        // sweetalert2 というライブラリを使うと、もっとオシャレにできるけど、
        // まずは標準のconfirm機能で実装してみよう。
        const confirmed = confirm(
            `この画像を送信しますか？\n（プレビューは表示できませんが、ファイル名: ${file.name}）`
        );
        // ↑ 標準のconfirmでは画像は表示できないので、まずは簡単なテキスト確認で。

        if (confirmed) {
            // 「はい」が押されたら、アップロード処理を実行
            uploadImage(file);
        } else {
            // 「いいえ」が押されたら、何もせずにファイル選択をリセット
            imageInput.value = '';
        }
    };
    reader.readAsDataURL(file);
});

// 画像アップロード処理を、独立した関数に切り出す
async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    input.disabled = true;
    input.placeholder = '画像をアップロード中...';

    try {
        const response = await fetch('/upload-image', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'サーバーでのアップロードに失敗しました。');
        }

        const result = await response.json();
        const imageUrl = result.imageUrl;

        const messageData = {
            message: imageUrl,
            username: currentUsername,
            isImage: true
        };
        socket.emit('chat message', messageData);

    } catch (error) {
        console.error('画像アップロードに失敗しました:', error);
        alert('画像アップロードに失敗しました。');
    } finally {
        input.disabled = false;
        input.placeholder = 'メッセージを入力';
        imageInput.value = '';
    }};
    // --- ↑↑↑ ここまでが追加部分 ---
}