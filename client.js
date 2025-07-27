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
    // (データ形式のチェックはそのまま)
    if (!data || typeof data.text !== 'string') { /* ... */ }
    const username = data.username || '名無しさん';

    const item = document.createElement('li');

    // ★★★ここからが時刻表示の追加部分★★★
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const timeLabel = document.createElement('span');
    timeLabel.className = 'message-time';

    // createdAt が存在し、有効な日付かチェック
    if (data.createdAt && data.createdAt.seconds) {
        // Firestoreから送られてきた時刻データ（Timestampオブジェクト）をDateオブジェクトに変換
        const date = new Date(data.createdAt.seconds * 1000);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        timeLabel.textContent = `${hours}:${minutes}`;
    }

    if (data.isImage) {
        // (画像表示のロジックは変更なし)
        const img = document.createElement('img');
        /* ... */
        messageContent.appendChild(img);
    } else {
        // テキストを表示するspanを作成
        const textSpan = document.createElement('span');
        textSpan.textContent = data.text;
        messageContent.appendChild(textSpan);
    }
    
    // 吹き出し(item)の中に、[メッセージ内容]と[時刻]を入れる
    item.appendChild(messageContent);
    item.appendChild(timeLabel);
    // ★★★ここまでが時刻表示の追加部分★★★


    const scrollToBottom = () => item.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (username === currentUsername) {
        item.classList.add('me');
        messages.appendChild(item);
    } else {
        // (相手のメッセージ表示部分は変更なし)
        const nameLabel = document.createElement('div');
        /* ... */
        messages.appendChild(nameLabel);
        messages.appendChild(item);
    }

    if (!data.isImage) {
        scrollToBottom();
    } else {
        // 画像の場合は、少し遅れてスクロール（確実性のため）
        setTimeout(scrollToBottom, 100);
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