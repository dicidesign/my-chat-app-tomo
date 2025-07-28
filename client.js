// 【client.js 最終確定版】

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
    let lastMessageDate = null; // 最後に表示したメッセージの日付を記憶する変数

    /**
     * メッセージを1件、画面に表示する総合関数
     * @param {object} data - サーバーから送られてくるメッセージオブジェクト
     */
    const displayMessage = (data) => {
    // 1. データ形式と日付情報の有無をチェック
    if (!data || typeof data.text !== 'string' || !data.createdAt) {
        return;
    }

    // --- 日付オブジェクトの生成 ---
    let messageDate;
    if (typeof data.createdAt === 'object' && data.createdAt.seconds) {
        messageDate = new Date(data.createdAt.seconds * 1000);
    } else {
        messageDate = new Date(data.createdAt);
    }
    if (isNaN(messageDate.getTime())) {
        return;
    }
    // --- 日付オブジェクトの生成ここまで ---

    // --- 日付スタンプの表示処理 ---
    const messageDateString = `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
    if (messageDateString !== lastMessageDate) {
        const dateStampContainer = document.getElementById('date-stamp-container');
        if (dateStampContainer) {
            dateStampContainer.innerHTML = '';
            const dateStamp = document.createElement('div');
            dateStamp.className = 'date-stamp';
            dateStamp.textContent = `${messageDate.getFullYear()}/${String(messageDate.getMonth() + 1).padStart(2, '0')}/${String(messageDate.getDate()).padStart(2, '0')}`;
            dateStampContainer.appendChild(dateStamp);
        }
        lastMessageDate = messageDateString;
    }
    // --- 日付スタンプの表示処理ここまで ---

    const username = data.username || '名無しさん';

    // 2. メッセージ表示用のHTML要素を作成
    const li = document.createElement('li');
    const bubble = document.createElement('div');
    const time = document.createElement('span');

    // 3. 吹き出しの中身を作成（画像かテキストかで分岐）
    if (data.isImage === true) {
        const img = document.createElement('img');
        img.src = data.text;
        
        // --- ↓↓↓ ここが復元＆アップグレードされた画像クリック処理 ↓↓↓ ---
        img.addEventListener('click', () => {
            Swal.fire({
                html: `
                    <div class="swal-custom-header">
                        <a href="/download-image?url=${encodeURIComponent(img.src)}" class="swal-download-button" title="ダウンロード">
                            <i class="fas fa-download"></i>
                        </a>
                        <button type="button" class="swal2-close swal-close-button" title="閉じる">×</button>
                    </div>
                `,
                imageUrl: img.src,
                imageAlt: '拡大画像',
                padding: 0,
                background: 'transparent',
                backdrop: `rgba(0,0,0,0.8)`,
                showConfirmButton: false,
                customClass: {
                    popup: 'fullscreen-swal',
                    htmlContainer: 'swal-html-container-custom'
                },
                didOpen: (modal) => {
                    modal.querySelector('.swal-close-button').addEventListener('click', () => {
                        Swal.close();
                    });
                }
            });
        });
        // --- ↑↑↑ ここまでが復元＆アップグレードされた画像クリック処理 ---

        bubble.appendChild(img);
    } else {
        bubble.textContent = data.text;
    }

    // 4. 時刻のテキストを設定
    time.textContent = `${String(messageDate.getHours()).padStart(2, '0')}:${String(messageDate.getMinutes()).padStart(2, '0')}`;
    
    // 5. スタイル用のクラスを設定
    bubble.className = 'bubble';
    time.className = 'message-time';

    // 6. 自分か相手かで、要素を組み立てる順番とクラスを変える
    if (username === currentUsername) {
        li.classList.add('me');
        li.appendChild(time);
        li.appendChild(bubble);
    } else {
        const nameLabel = document.createElement('div');
        nameLabel.textContent = username;
        nameLabel.className = 'name-label';
        messages.appendChild(nameLabel);
        
        li.classList.add('opponent');
        li.appendChild(bubble);
        li.appendChild(time);
    }

    // 7. 組み立てたメッセージ(li)を、チャット欄に追加
    messages.appendChild(li);
};

    /**
     * テキストメッセージ送信の処理
     */
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value) {
            socket.emit('chat message', {
                message: input.value, username: currentUsername, isImage: false
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
                }
                imageInput.value = ''; // 選択をリセット
            });
        };
        reader.readAsDataURL(file);
    });

    /**
     * 画像をサーバーにアップロードする関数
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
                message: result.imageUrl, username: currentUsername, isImage: true
            });
        } catch (error) {
            console.error('画像アップロードに失敗しました:', error);
            alert('画像アップロードに失敗しました。');
        } finally {
            input.disabled = false;
            input.placeholder = 'メッセージを入力';
        }
    }

    /**
     * Socket.IOのイベントリスナー
     */
    socket.on('connect', async () => {
        try {
            const response = await fetch('/get-theme'); // サーバーにテーマを問い合わせる
            const result = await response.json();
            if (result.success && result.theme) {
                const chatThemeElement = document.querySelector('.chat-theme');
                if (chatThemeElement) {
                    chatThemeElement.textContent = result.theme;
                }
            }
        } catch (e) {
            console.error("テーマの読み込みに失敗しました:", e);
        }
    });
    socket.on('load old messages', (serverMessages) => {
        messages.innerHTML = '';
        lastMessageDate = null;
        serverMessages.forEach(msg => displayMessage(msg));
        messages.scrollTop = messages.scrollHeight; // 確実に一番下までスクロール
    });

    socket.on('chat message', (data) => {
        displayMessage(data);
        messages.scrollTop = messages.scrollHeight; // 確実に一番下までスクロール
    });
}

// --- ヘッダーのテーマ変更機能 ---
    const chatThemeElement = document.querySelector('.chat-theme');

    if (chatThemeElement) {
        chatThemeElement.addEventListener('click', () => {
            Swal.fire({
                title: '新しいテーマを入力してください',
                input: 'text',
                inputValue: chatThemeElement.textContent,
                showCancelButton: true,
                confirmButtonText: '変更する',
                cancelButtonText: 'やめる',
                inputAttributes: {
                    maxlength: 10 // 少し余裕を持たせて10文字くらいに
                },
                // ↓↓↓ ここからが新しいバリデーションの書き方 ↓↓↓
                preConfirm: (value) => {
                    // 「変更する」ボタンが押された瞬間にチェックする
                    if (!value) {
                        Swal.showValidationMessage('テーマを入力してください！');
                        return false; // これで送信を防ぐ
                    }
                    if (value.length > 8) {
                        Swal.showValidationMessage('テーマは8文字以内で入力してください。');
                        return false; // これで送信を防ぐ
                    }
                    return value; // チェックを通過したら、入力値を返す
                },
                allowOutsideClick: () => !Swal.isLoading() // 処理中は外側クリックを無効化
                // ↑↑↑ ここまでが新しいバリデーションの書き方 ↑↑↑
            }).then((result) => {
                // preConfirmが成功した場合だけ、この中の処理が実行される
                if (result.isConfirmed && result.value) {
                    const newTheme = result.value;
                    socket.emit('theme change', newTheme);
                }
            });
        });
    }

    // サーバーからテーマ変更の通知を受け取った時の処理
    socket.on('theme updated', (newTheme) => {
        if (chatThemeElement) {
            chatThemeElement.textContent = newTheme;
        }
    });
