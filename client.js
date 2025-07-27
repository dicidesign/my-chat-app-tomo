// 【client.js 最終決定版・改】

// サーバーに接続
const socket = io();

// HTMLから操作したい要素を取得
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const imageInput = document.getElementById('image-input');

// sessionStorageからユーザー名を取得
const storedUsername = sessionStorage.getItem('chatUsername');

// ログインチェック
if (!storedUsername) {
    alert('ログインしていません。ログインページに戻ります。');
    window.location.href = '/login.html';
} else {
    // --- ログイン済みの場合、ここから下のコードが実行される ---

    let currentUsername = storedUsername;

    /**
     * メッセージを1件、画面に表示する総合関数
     * @param {object} data - サーバーから送られてくるメッセージオブジェクト
     */
    const displayMessage = (data) => {
        // 1. データが不正なら、即座に処理を中断
        if (!data || typeof data.text !== 'string') {
            console.error('[displayMessage] データ形式が不正です。スキップします。', data);
            return;
        }
        const username = data.username || '名無しさん';

        // 2. 必要なHTML要素をすべて事前に作成する
        const li = document.createElement('li');
        const bubble = document.createElement('div');
        const time = document.createElement('span');

        // 3. 吹き出しの中身を作成（画像かテキストかで分岐）
        if (data.isImage === true) {
            const img = document.createElement('img');
            img.src = data.text;
            img.addEventListener('click', () => {
                Swal.fire({
                    imageUrl: img.src,
                    imageAlt: '拡大画像',
                    background: '#000000a0',
                    backdrop: true,
                    showCloseButton: true,
                    showConfirmButton: true,
                    confirmButtonText: 'Download',
                    confirmButtonAriaLabel: 'Download',
                    showCancelButton: false,
                    preConfirm: () => {
                        window.location.href = `/download-image?url=${encodeURIComponent(img.src)}`;
                        return false;
                    },
                    customClass: {
                        popup: 'fullscreen-swal',
                        header: 'swal-header-custom',
                        actions: 'swal-actions-custom',
                        closeButton: 'swal-close-custom',
                        confirmButton: 'swal-confirm-custom'
                    }
                });
            });
            bubble.appendChild(img);
        } else {
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
            li.classList.add('me');
            li.appendChild(time);
            li.appendChild(bubble);
        } else {
            li.classList.add('opponent');
            li.appendChild(bubble);
            li.appendChild(time);
            
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
            const img = bubble.querySelector('img');
            if (img) {
                img.onload = scrollToBottom;
                if (img.complete) scrollToBottom();
            }
        } else {
            scrollToBottom();
        }
    };

    /**
     * テキストメッセージ送信の処理
     */
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
            socket.emit('chat message', {
                message: input.value,
                username: currentUsername,
                isImage: false
            });
            input.value = '';
        }
    });

    /**
     * 画像ファイル選択時の処理
     */
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            Swal.fire({
                title: 'この画像を送信しますか？', imageUrl: event.target.result, imageWidth: '90%',
                imageAlt: '画像プレビュー', showCancelButton: true, confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33', confirmButtonText: '送信する', cancelButtonText: 'やめる'
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

    /**
     * 画像をサーバーにアップロードする関数
     * @param {File} file - アップロードするファイル
     */
    async function uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        input.disabled = true;
        input.placeholder = '画像をアップロード中...';
        try {
            const response = await fetch('/upload-image', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || 'サーバーでのアップロードに失敗しました。');
            }
            const result = await response.json();
            socket.emit('chat message', {
                message: result.imageUrl,
                username: currentUsername,
                isImage: true
            });
        } catch (error) {
            console.error('画像アップロードに失敗しました:', error);
            alert('画像アップロードに失敗しました。');
        } finally {
            input.disabled = false;
            input.placeholder = 'メッセージを入力';
            imageInput.value = '';
        }
    }

    /**
     * Socket.IOのイベントリスナー
     */
    socket.on('load old messages', (serverMessages) => {
        messages.innerHTML = '';
        serverMessages.forEach(msg => displayMessage(msg));
        const lastMessage = messages.lastElementChild;
        if (lastMessage) lastMessage.scrollIntoView({ block: 'end' });
    });

    socket.on('chat message', (data) => {
        displayMessage(data);
    });
}