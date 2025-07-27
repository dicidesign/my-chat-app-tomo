// 【client.js 最新・決定版】

// サーバーに接続
const socket = io();

// HTMLから操作したい要素を取得
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input');

// sessionStorageからユーザー名を取得
const storedUsername = sessionStorage.getItem('chatUsername');

if (!storedUsername) {
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html';
} else {
    let currentUsername = storedUsername;



    // client.js の displayMessage 関数をこれで上書き

const displayMessage = (data) => {
    // 1. データが不正なら、即座に処理を中断
    if (!data || typeof data.text !== 'string') {
        console.error('[displayMessage] データ形式が不正です。スキップします。', data);
        return;
    }
    const username = data.username || '名無しさん';

    // 2. 必要なHTML要素をすべて事前に作成する
    const li = document.createElement('li'); // メッセージ一行全体を包むコンテナ
    const bubble = document.createElement('div'); // 吹き出し
    const time = document.createElement('span'); // 時刻

    // 3. 吹き出しの中身を作成（画像かテキストかで分岐）
    if (data.isImage === true) {
        // --- 画像の場合 ---
        const img = document.createElement('img');
        img.src = data.text;
        img.addEventListener('click', () => {
            Swal.fire({ /* ... (モーダルの設定は変更なし) ... */ });
        });
        bubble.appendChild(img);
    } else {
        // --- テキストの場合 ---
        bubble.textContent = data.text;
    }
    
    // 4. 時刻のテキストを設定
    if (data.createdAt && data.createdAt.seconds) {
        const date = new Date(data.createdAt.seconds * 1000);
        time.textContent = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // 5. スタイル用のクラスを設定
    bubble.className = 'bubble';
    time.className = 'message-time';

    // 6. 自分か相手かで、要素を組み立てる順番とクラスを変える
    if (username === currentUsername) {
        // --- 自分のメッセージの場合 ---
        li.classList.add('me');
        li.appendChild(time);   // [時刻]
        li.appendChild(bubble); // [吹き出し] の順番で追加
    } else {
        // --- 相手のメッセージの場合 ---
        li.classList.add('opponent');
        li.appendChild(bubble); // [吹き出し]
        li.appendChild(time);   // [時刻] の順番で追加
        
        // 相手の名前ラベルは、liの外側に追加する
        const nameLabel = document.createElement('div');
        nameLabel.textContent = username;
        nameLabel.className = 'name-label';
        messages.appendChild(nameLabel);
    }

    // 7. 組み立てたメッセージ(li)を、チャット欄に追加
    messages.appendChild(li);

    // 8. スクロール処理
    const scrollToBottom = () => li.scrollIntoView({ behavior: 'smooth', block: 'end' });
    if (data.isImage) {
        // 画像はロードを待ってからスクロール
        const img = bubble.querySelector('img');
        if (img) {
            img.onload = scrollToBottom;
            if (img.complete) scrollToBottom();
        }
    } else {
        // テキストはすぐにスクロール
        scrollToBottom();
    }
};

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
            const messageData = {
                message: input.value,
                username: currentUsername
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
        const lastMessage = messages.lastElementChild;
        if (lastMessage) lastMessage.scrollIntoView({ block: 'end' });
    });

    socket.on('chat message', (data) => {
        displayMessage(data);
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const previewImageUrl = event.target.result;
            Swal.fire({
                title: 'この画像を送信しますか？',
                imageUrl: previewImageUrl,
                imageWidth: '90%',
                imageAlt: '画像プレビュー',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: '送信する',
                cancelButtonText: 'やめる'
            }).then((result) => {
                if (result.isConfirmed) {
                    uploadImage(file);
                } else {
                    imageInput.value = '';
                }
            });
        };
        reader.readAsDataURL(file);
    });

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
        }
    }
}